#!/usr/bin/env python3
"""Сбор открытых PR/MR и issues с GitHub или GitLab в один нормализованный JSON.

Только чтение: скрипт делает GET-запросы через gh / glab и ничего не меняет
в трекере. Выкачивает все страницы и сверяет число полученных элементов
с общим счётчиком платформы, чтобы отчёт не строился на неполных данных.

Использование:
  collect.py                          # репозиторий из origin текущего каталога
  collect.py --repo owner/name        # GitHub (или GitLab, если не нашёлся на GitHub)
  collect.py --repo https://gitlab.com/group/sub/project
  collect.py --repo group/project --platform gitlab --hostname git.example.com

Печатает в stdout компактную сводку (по строке на элемент), полный JSON
с телами описаний пишет в файл и печатает путь к нему.
"""

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.parse
from datetime import datetime, timezone

BODY_LIMIT = 1500
NOW = datetime.now(timezone.utc)
BOT_RE = re.compile(r"(\[bot\]$|^dependabot|^renovate|-bot$|^bot-|_bot$)", re.I)


# ---------- утилиты ----------

RETRYABLE = re.compile(r"HTTP (429|502|503|504)|rate limit|secondary rate", re.I)


BACKOFF = (2, 4, 8, 16, 30)  # в сумме ~1 минута: дольше ждать нет смысла, лимит часовой


def run(cmd, check=True):
    for delay in BACKOFF + (None,):
        try:
            p = subprocess.run(cmd, capture_output=True, text=True)
        except FileNotFoundError:
            raise SystemExit(f"не найден бинарь {cmd[0]}: поставь его или выбери другую платформу")
        if p.returncode == 0 or not RETRYABLE.search(p.stderr + p.stdout):
            break
        if delay is None:
            # Упёрлись в лимит: молча вернуть None нельзя, иначе отчёт выйдет на дырявых данных.
            hint = ""
            if cmd[0] == "glab":
                host = cmd[cmd.index("--hostname") + 1] if "--hostname" in cmd else "gitlab.com"
                hint = (f"\nАнонимный лимит {host} на IP маленький и сбрасывается раз в час."
                        f" Авторизуйся: glab auth login --hostname {host}")
            raise RuntimeError(f"rate limit не отпустил за минуту: {' '.join(cmd[:5])} …{hint}")
        time.sleep(delay)
    if check and p.returncode != 0:
        raise RuntimeError(f"{' '.join(cmd[:4])} …: {p.stderr.strip()[:600]}")
    return p


def decode_stream(text):
    """Разбирает несколько JSON-документов подряд (так выглядит вывод --paginate)."""
    dec = json.JSONDecoder()
    out, i, text = [], 0, text.strip()
    while i < len(text):
        while i < len(text) and text[i].isspace():
            i += 1
        if i >= len(text):
            break
        obj, i = dec.raw_decode(text, i)
        out.append(obj)
    return out


def days_since(ts):
    if not ts:
        return None
    dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    return (NOW - dt).days


def clip(text, limit=BODY_LIMIT):
    text = (text or "").strip()
    return text if len(text) <= limit else text[:limit] + f"… [обрезано, всего {len(text)} симв.]"


def is_bot(login, typename=None):
    return typename == "Bot" or bool(login and BOT_RE.search(login))


def parse_remote(url):
    url = url.strip()
    if "://" in url:
        u = urllib.parse.urlparse(url)
        host, path = u.hostname, u.path
    else:
        m = re.match(r"^(?:[^@/]+@)?([^:/]+):(.+)$", url)
        if not m:
            raise ValueError(f"не понял адрес remote: {url}")
        host, path = m.group(1), m.group(2)
    path = path.strip("/")
    if path.endswith(".git"):
        path = path[:-4]
    return host, path


def origin_remote():
    p = run(["git", "remote", "get-url", "origin"], check=False)
    return p.stdout.strip() if p.returncode == 0 else None


def detect_platform(host):
    h = (host or "").lower()
    if h == "github.com" or h.endswith(".ghe.com") or "github" in h:
        return "github"
    if h == "gitlab.com" or "gitlab" in h:
        return "gitlab"
    for cli, plat in (("glab", "gitlab"), ("gh", "github")):
        try:
            if subprocess.run([cli, "auth", "status", "--hostname", host],
                              capture_output=True).returncode == 0:
                return plat
        except FileNotFoundError:
            continue
    return None


# ---------- GitHub ----------

PR_QUERY = """
query($owner:String!,$name:String!,$endCursor:String){
  repository(owner:$owner,name:$name){
    pullRequests(states:OPEN, first:30, after:$endCursor, orderBy:{field:CREATED_AT,direction:DESC}){
      totalCount
      pageInfo{hasNextPage endCursor}
      nodes{
        number title url isDraft createdAt updatedAt body
        author{login __typename}
        authorAssociation
        baseRefName headRefName isCrossRepository
        additions deletions changedFiles
        mergeable mergeStateStatus reviewDecision
        labels(first:20){nodes{name}}
        closingIssuesReferences(first:10){nodes{number}}
        latestOpinionatedReviews(first:20){nodes{state author{login}}}
        comments{totalCount}
        commits(last:1){nodes{commit{committedDate statusCheckRollup{state
          contexts(first:100){nodes{__typename
            ... on CheckRun{name status conclusion}
            ... on StatusContext{context state}}}}}}}
      }
    }
  }
}"""

ISSUE_QUERY = """
query($owner:String!,$name:String!,$endCursor:String){
  repository(owner:$owner,name:$name){
    issues(states:OPEN, first:50, after:$endCursor, orderBy:{field:CREATED_AT,direction:DESC}){
      totalCount
      pageInfo{hasNextPage endCursor}
      nodes{
        number title url createdAt updatedAt body
        author{login __typename}
        authorAssociation
        labels(first:20){nodes{name}}
        comments{totalCount}
        reactions{totalCount}
        assignees(first:5){nodes{login}}
        milestone{title}
        closedByPullRequestsReferences(first:5, includeClosedPrs:false){nodes{number}}
      }
    }
  }
}"""

REPO_QUERY = """
query($owner:String!,$name:String!){
  repository(owner:$owner,name:$name){
    nameWithOwner url isArchived viewerPermission
    defaultBranchRef{name target{... on Commit{statusCheckRollup{state
      contexts(first:100){nodes{__typename
        ... on CheckRun{name status conclusion}
        ... on StatusContext{context state}}}}}}}
    squashMergeAllowed mergeCommitAllowed rebaseMergeAllowed
  }
}"""

CLOSED_QUERY = """
query($owner:String!,$name:String!){
  repository(owner:$owner,name:$name){
    pullRequests(states:CLOSED, first:40, orderBy:{field:UPDATED_AT,direction:DESC}){
      nodes{number title closedAt author{login}
        comments(last:1){nodes{author{login} body}}}
    }
  }
}"""

CLOSED_WINDOW_DAYS = 90

MERGEABLE_QUERY = """
query($owner:String!,$name:String!,$n:Int!){
  repository(owner:$owner,name:$name){pullRequest(number:$n){mergeable mergeStateStatus}}
}"""


def gh_graphql(host, query, owner, name, paginate=False, extra=None):
    cmd = ["gh", "api", "--hostname", host, "graphql"]
    if paginate:
        cmd += ["--paginate", "--slurp"]
    cmd += ["-f", f"query={query}", "-F", f"owner={owner}", "-F", f"name={name}"]
    for k, v in (extra or {}).items():
        cmd += ["-F", f"{k}={v}"]
    pages = json.loads(run(cmd).stdout)
    return pages if paginate else [pages]


def gh_connection(host, query, owner, name, key):
    pages = gh_graphql(host, query, owner, name, paginate=True)
    nodes, total = [], None
    for page in pages:
        if page.get("errors"):
            raise RuntimeError(json.dumps(page["errors"])[:600])
        conn = page["data"]["repository"][key]
        total = conn["totalCount"]
        nodes += conn["nodes"]
    return nodes, total


def gh_checks(commit_nodes):
    rollup = None
    if commit_nodes:
        rollup = commit_nodes[0]["commit"].get("statusCheckRollup")
    if not rollup:
        return {"state": "none", "total": 0, "failed": [], "pending": []}
    failed, pending, total = [], [], 0
    for c in rollup["contexts"]["nodes"]:
        total += 1
        if c["__typename"] == "CheckRun":
            name = c["name"]
            if c["status"] != "COMPLETED":
                pending.append(name)
            elif c["conclusion"] in ("FAILURE", "TIMED_OUT", "CANCELLED", "ACTION_REQUIRED", "STARTUP_FAILURE"):
                failed.append(name)
        else:
            name = c["context"]
            if c["state"] in ("FAILURE", "ERROR"):
                failed.append(name)
            elif c["state"] in ("PENDING", "EXPECTED"):
                pending.append(name)
    state = {"SUCCESS": "success", "FAILURE": "failure", "ERROR": "failure",
             "PENDING": "pending", "EXPECTED": "pending"}.get(rollup["state"], rollup["state"].lower())
    return {"state": state, "total": total, "failed": failed, "pending": pending}


FAILED_RUN = ("failure", "timed_out", "startup_failure")


def gh_branch_workflows(host, path, branch):
    """Последний прогон каждого workflow на ветке, включая schedule и workflow_dispatch."""
    if not branch:
        return []
    p = run(["gh", "api", "--hostname", host,
             f"repos/{path}/actions/runs?branch={urllib.parse.quote(branch)}&per_page=100"], check=False)
    if p.returncode != 0:
        return []  # Actions выключены или нет доступа — молча без них
    latest = {}
    for r in json.loads(p.stdout).get("workflow_runs", []):
        if r.get("event") == "dynamic":  # служебные прогоны Dependabot
            continue
        key = r.get("path") or r.get("name")
        if key not in latest or r["created_at"] > latest[key]["created_at"]:
            latest[key] = r
    return sorted(({"name": r["name"], "event": r["event"], "status": r["status"],
                    "conclusion": r.get("conclusion"), "created_at": r["created_at"],
                    "url": r["html_url"]} for r in latest.values()), key=lambda w: w["name"])


def collect_github(host, path):
    owner, name = path.split("/", 1)
    repo = gh_graphql(host, REPO_QUERY, owner, name)[0]["data"]["repository"]
    pr_nodes, pr_total = gh_connection(host, PR_QUERY, owner, name, "pullRequests")

    # GitHub считает mergeable лениво: первый запрос часто даёт UNKNOWN.
    for attempt in range(2):
        unknown = [p for p in pr_nodes if p["mergeable"] == "UNKNOWN" and not p["isDraft"]]
        if not unknown:
            break
        time.sleep(3)
        for p in unknown:
            r = gh_graphql(host, MERGEABLE_QUERY, owner, name, extra={"n": p["number"]})[0]
            fresh = r["data"]["repository"]["pullRequest"]
            p["mergeable"], p["mergeStateStatus"] = fresh["mergeable"], fresh["mergeStateStatus"]

    prs = []
    for p in pr_nodes:
        reviews = p["latestOpinionatedReviews"]["nodes"]
        author = (p.get("author") or {})
        prs.append({
            "number": p["number"],
            "title": p["title"],
            "url": p["url"],
            "author": author.get("login"),
            "author_is_bot": is_bot(author.get("login"), author.get("__typename")),
            "author_association": p["authorAssociation"],
            "from_fork": p["isCrossRepository"],
            "draft": p["isDraft"],
            "base": p["baseRefName"],
            "head": p["headRefName"],
            "labels": [l["name"] for l in p["labels"]["nodes"]],
            "additions": p["additions"],
            "deletions": p["deletions"],
            "changed_files": p["changedFiles"],
            "conflicts": p["mergeable"] == "CONFLICTING",
            "merge_state": p["mergeStateStatus"],
            "review_decision": p["reviewDecision"],
            "approvals": sum(r["state"] == "APPROVED" for r in reviews),
            "changes_requested": [r["author"]["login"] for r in reviews
                                  if r["state"] == "CHANGES_REQUESTED" and r.get("author")],
            "checks": gh_checks(p["commits"]["nodes"]),
            "comments": p["comments"]["totalCount"],
            "closes_issues": [i["number"] for i in p["closingIssuesReferences"]["nodes"]],
            "age_days": days_since(p["createdAt"]),
            "idle_days": days_since(p["updatedAt"]),
            "last_commit_days": days_since(p["commits"]["nodes"][0]["commit"]["committedDate"])
            if p["commits"]["nodes"] else None,
            "body": clip(p["body"]),
        })

    # Закрытые без мержа PR — лучший источник политики проекта: что мейнтейнер
    # отклоняет и какими словами. Последний комментарий обычно и есть причина.
    closed = []
    for c in gh_graphql(host, CLOSED_QUERY, owner, name)[0]["data"]["repository"]["pullRequests"]["nodes"]:
        age = days_since(c["closedAt"])
        if age is None or age > CLOSED_WINDOW_DAYS:
            continue
        last = (c["comments"]["nodes"] or [None])[0]
        closed.append({"number": c["number"], "title": c["title"],
                       "author": (c.get("author") or {}).get("login"), "closed_days": age,
                       "last_comment_by": ((last or {}).get("author") or {}).get("login"),
                       "last_comment": clip((last or {}).get("body"), 240)})

    issue_nodes, issue_total = gh_connection(host, ISSUE_QUERY, owner, name, "issues")
    issues = []
    for i in issue_nodes:
        author = (i.get("author") or {})
        issues.append({
            "number": i["number"],
            "title": i["title"],
            "url": i["url"],
            "author": author.get("login"),
            "author_association": i["authorAssociation"],
            "labels": [l["name"] for l in i["labels"]["nodes"]],
            "comments": i["comments"]["totalCount"],
            "reactions": i["reactions"]["totalCount"],
            "assignees": [a["login"] for a in i["assignees"]["nodes"]],
            "milestone": (i.get("milestone") or {}).get("title"),
            "linked_prs": [p["number"] for p in i["closedByPullRequestsReferences"]["nodes"]],
            "age_days": days_since(i["createdAt"]),
            "idle_days": days_since(i["updatedAt"]),
            "body": clip(i["body"]),
        })

    # Связь issue → PR: GitHub знает её только по ключевым словам closes/fixes.
    by_issue = {}
    for p in prs:
        for n in p["closes_issues"]:
            by_issue.setdefault(n, []).append(p["number"])
    for i in issues:
        i["linked_prs"] = sorted(set(i["linked_prs"]) | set(by_issue.get(i["number"], [])))

    methods = [m for m, ok in (("squash", repo["squashMergeAllowed"]),
                               ("merge", repo["mergeCommitAllowed"]),
                               ("rebase", repo["rebaseMergeAllowed"])) if ok]
    dref = repo.get("defaultBranchRef") or {}
    base_checks = gh_checks([{"commit": dref["target"]}] if dref.get("target") else [])
    base_checks["workflows"] = gh_branch_workflows(host, path, dref.get("name"))
    # Rollup коммита не видит прогонов по расписанию: CI на main бывает «зелёным»,
    # пока еженедельный security-скан на нём же красный. Итог считаем по обоим.
    bad = [w["name"] for w in base_checks["workflows"] if w["conclusion"] in FAILED_RUN]
    if bad:
        base_checks["state"] = "failure"
        base_checks["failed"] = sorted(set(base_checks["failed"]) | {f"workflow:{n}" for n in bad})
    return {
        "platform": "github",
        "host": host,
        "repo": repo["nameWithOwner"],
        "url": repo["url"],
        "archived": repo["isArchived"],
        "default_branch": (repo.get("defaultBranchRef") or {}).get("name"),
        "viewer_permission": repo.get("viewerPermission"),
        "default_branch_checks": base_checks,
        "merge_methods": methods,
        "totals": {"prs": pr_total, "issues": issue_total},
        "prs": prs,
        "closed_unmerged": closed,
        "issues": issues,
    }


# ---------- GitLab ----------

def glab_get(host, endpoint, paginate=False, check=True):
    cmd = ["glab", "api", "--hostname", host]
    if paginate:
        cmd.append("--paginate")
    cmd.append(endpoint)
    p = run(cmd, check=check)
    if p.returncode != 0:
        return None
    docs = decode_stream(p.stdout)
    if not paginate:
        return docs[0] if docs else None
    items = []
    for d in docs:
        items += d if isinstance(d, list) else [d]
    return items


def glab_total(host, endpoint):
    p = run(["glab", "api", "--hostname", host, "--include", endpoint], check=False)
    m = re.search(r"^x-total:\s*(\d+)", p.stdout, re.I | re.M)
    return int(m.group(1)) if m else None


PIPELINE_STATE = {"success": "success", "failed": "failure", "canceled": "failure",
                  "running": "pending", "pending": "pending", "created": "pending",
                  "waiting_for_resource": "pending", "preparing": "pending",
                  "scheduled": "pending", "manual": "manual", "skipped": "none"}


def gitlab_diffstat(host, base, iid):
    diffs = glab_get(host, f"{base}/merge_requests/{iid}/diffs?per_page=100", paginate=True, check=False)
    if diffs is None:
        return None, None, None
    add = dele = 0
    partial = False
    for d in diffs:
        if d.get("too_large") or d.get("collapsed"):
            partial = True
        for line in (d.get("diff") or "").splitlines():
            if line.startswith("+") and not line.startswith("+++"):
                add += 1
            elif line.startswith("-") and not line.startswith("---"):
                dele += 1
    return add, dele, (len(diffs), partial)


def collect_gitlab(host, path):
    base = "projects/" + urllib.parse.quote(path, safe="")
    proj = glab_get(host, base)
    if not proj:
        raise RuntimeError(f"проект {path} на {host} не найден или нет доступа")

    mr_list = glab_get(host, f"{base}/merge_requests?state=opened&per_page=100", paginate=True)
    closed = []
    for c in glab_get(host, f"{base}/merge_requests?state=closed&order_by=updated_at&per_page=40", check=False) or []:
        age = days_since(c.get("closed_at"))
        if age is not None and age <= CLOSED_WINDOW_DAYS:
            closed.append({"number": c["iid"], "title": c["title"],
                           "author": (c.get("author") or {}).get("username"), "closed_days": age,
                           "last_comment_by": None, "last_comment": ""})
    prs = []
    for m in mr_list:
        iid = m["iid"]
        d = glab_get(host, f"{base}/merge_requests/{iid}", check=False) or m
        appr = glab_get(host, f"{base}/merge_requests/{iid}/approvals", check=False) or {}
        closes = glab_get(host, f"{base}/merge_requests/{iid}/closes_issues", check=False) or []
        pipe = d.get("head_pipeline")
        if not pipe:
            pl = glab_get(host, f"{base}/merge_requests/{iid}/pipelines?per_page=1", check=False) or []
            pipe = pl[0] if pl else None
        pstatus = (pipe or {}).get("status")
        add, dele, files = gitlab_diffstat(host, base, iid)
        author = (d.get("author") or {}).get("username")
        prs.append({
            "number": iid,
            "title": d["title"],
            "url": d["web_url"],
            "author": author,
            "author_is_bot": is_bot(author),
            "author_association": None,
            "from_fork": d.get("source_project_id") != d.get("target_project_id"),
            "draft": bool(d.get("draft") or d.get("work_in_progress")),
            "base": d.get("target_branch"),
            "head": d.get("source_branch"),
            "labels": d.get("labels", []),
            "additions": add,
            "deletions": dele,
            "changed_files": files[0] if files else d.get("changes_count"),
            "diff_partial": files[1] if files else None,
            "conflicts": bool(d.get("has_conflicts")),
            "merge_state": d.get("detailed_merge_status") or d.get("merge_status"),
            "review_decision": ("APPROVED" if appr.get("approved") and appr.get("approvals_required") else
                                "REVIEW_REQUIRED" if appr.get("approvals_left") else None),
            "approvals": len(appr.get("approved_by") or []),
            "approvals_left": appr.get("approvals_left"),
            "changes_requested": [],
            "blocking_discussions_resolved": d.get("blocking_discussions_resolved"),
            "checks": {"state": PIPELINE_STATE.get(pstatus, "none") if pstatus else "none",
                       "raw": pstatus, "total": None, "failed": [], "pending": []},
            "comments": d.get("user_notes_count"),
            "closes_issues": [c["iid"] for c in closes if isinstance(c, dict) and "iid" in c],
            "age_days": days_since(d.get("created_at")),
            "idle_days": days_since(d.get("updated_at")),
            "last_commit_days": None,
            "body": clip(d.get("description")),
        })

    issue_list = glab_get(host, f"{base}/issues?state=opened&per_page=100", paginate=True)
    by_issue = {}
    for p in prs:
        for n in p["closes_issues"]:
            by_issue.setdefault(n, []).append(p["number"])
    issues = []
    for i in issue_list:
        issues.append({
            "number": i["iid"],
            "title": i["title"],
            "url": i["web_url"],
            "author": (i.get("author") or {}).get("username"),
            "author_association": None,
            "labels": i.get("labels", []),
            "comments": i.get("user_notes_count"),
            "reactions": (i.get("upvotes") or 0) + (i.get("downvotes") or 0),
            "assignees": [a["username"] for a in i.get("assignees") or []],
            "milestone": (i.get("milestone") or {}).get("title"),
            "linked_prs": sorted(by_issue.get(i["iid"], [])),
            "related_mr_count": i.get("merge_requests_count"),
            "type": i.get("issue_type") or i.get("type"),
            "age_days": days_since(i.get("created_at")),
            "idle_days": days_since(i.get("updated_at")),
            "body": clip(i.get("description")),
        })

    base_pipe = glab_get(host, f"{base}/pipelines?ref={urllib.parse.quote(proj.get('default_branch') or '', safe='')}&per_page=1",
                         check=False) or []
    bstatus = base_pipe[0]["status"] if base_pipe else None
    base_checks = {"state": PIPELINE_STATE.get(bstatus, "none") if bstatus else "none",
                   "raw": bstatus, "total": None, "failed": [], "pending": []}

    access = ((proj.get("permissions") or {}).get("project_access") or {}).get("access_level") \
        or ((proj.get("permissions") or {}).get("group_access") or {}).get("access_level")
    perm = {50: "OWNER", 40: "MAINTAIN", 30: "WRITE", 20: "TRIAGE", 10: "READ"}.get(access, "NONE/ANONYMOUS")
    return {
        "platform": "gitlab",
        "host": host,
        "repo": proj["path_with_namespace"],
        "url": proj["web_url"],
        "archived": proj.get("archived"),
        "default_branch": proj.get("default_branch"),
        "viewer_permission": perm,
        "default_branch_checks": base_checks,
        "merge_methods": [proj.get("merge_method")] + (["squash:" + proj["squash_option"]]
                                                       if proj.get("squash_option") else []),
        "totals": {"prs": glab_total(host, f"{base}/merge_requests?state=opened&per_page=1"),
                   "issues": glab_total(host, f"{base}/issues?state=opened&per_page=1")},
        "prs": prs,
        "closed_unmerged": closed,
        "issues": issues,
    }


# ---------- сводка ----------

def checks_str(c):
    out = c["state"]
    if c.get("total"):
        out += f"({c['total']})"
    if c["failed"]:
        out += " failed:" + ",".join(c["failed"][:4])
    if c.get("raw") and c["raw"] != c["state"]:
        out += f" [{c['raw']}]"
    return out


def pr_line(p):
    who = f"{p['author']}{' bot' if p['author_is_bot'] else ''}"
    if not p["author_is_bot"] and p.get("author_association") \
            and p["author_association"] not in ("OWNER", "MEMBER", "COLLABORATOR"):
        who += f" {p['author_association'].lower()}"
    if p.get("from_fork"):
        who += " fork"
    checks = checks_str(p["checks"])
    size = f"+{p['additions']}/-{p['deletions']} {p['changed_files']}f" \
        if p["additions"] is not None else f"?/? {p['changed_files']}f"
    if p.get("diff_partial"):
        size += " partial"
    review = p["review_decision"] or "-"
    if p["approvals"]:
        review += f" approvals={p['approvals']}"
    if p["changes_requested"]:
        review += " changes_requested=" + ",".join(p["changes_requested"])
    flags = []
    if p["draft"]:
        flags.append("DRAFT")
    if p["conflicts"]:
        flags.append("CONFLICTS")
    labels = f" [{', '.join(p['labels'])}]" if p["labels"] else ""
    closes = f" closes:{','.join('#' + str(n) for n in p['closes_issues'])}" if p["closes_issues"] else ""
    return (f"#{p['number']} {' '.join(flags) + ' ' if flags else ''}{p['title']}{labels}"
            f" | by {who} | merge={p['merge_state']} checks={checks} review={review}"
            f" | {size} | age {p['age_days']}d idle {p['idle_days']}d{closes}")


def issue_line(i):
    labels = f" [{', '.join(i['labels'])}]" if i["labels"] else ""
    extra = []
    if i["assignees"]:
        extra.append("assignee " + ",".join(i["assignees"]))
    if i["milestone"]:
        extra.append("milestone " + i["milestone"])
    if i["linked_prs"]:
        extra.append("PR " + ",".join("#" + str(n) for n in i["linked_prs"]))
    elif i.get("related_mr_count"):
        extra.append(f"related MR {i['related_mr_count']}")
    tail = (" | " + "; ".join(extra)) if extra else ""
    return (f"#{i['number']} {i['title']}{labels} | by {i['author']}"
            f" | comments {i['comments']} reactions {i['reactions']}"
            f" | age {i['age_days']}d idle {i['idle_days']}d{tail}")


def safe_write(path, text):
    """Пишем только в обычный файл: отказ, если цель или её каталог — симлинк."""
    parent = os.path.dirname(os.path.abspath(path)) or "."
    if os.path.islink(path) or os.path.islink(parent):
        raise SystemExit(f"отказ: {path} или его каталог — симлинк")
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | getattr(os, "O_NOFOLLOW", 0), 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(text)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--repo", help="owner/name, group/sub/project или URL; по умолчанию origin текущего каталога")
    ap.add_argument("--platform", choices=["github", "gitlab"])
    ap.add_argument("--hostname", help="хост для self-hosted GitHub Enterprise / GitLab")
    ap.add_argument("--out", help="куда писать полный JSON (по умолчанию — новый временный каталог)")
    args = ap.parse_args()

    origin = origin_remote()
    in_checkout = False
    if args.repo and ("://" in args.repo or "@" in args.repo):
        host, path = parse_remote(args.repo)
    elif args.repo:
        path = args.repo.strip("/")
        host = args.hostname
    elif origin:
        host, path = parse_remote(origin)
    else:
        raise SystemExit("не в git-репозитории и --repo не задан")
    if args.hostname:
        host = args.hostname

    platform = args.platform or (detect_platform(host) if host else None)
    if not host and not platform:
        # owner/name без хоста: сначала GitHub, потом gitlab.com
        ok = path.count("/") == 1 and run(["gh", "api", f"repos/{path}"], check=False).returncode == 0
        platform, host = ("github", "github.com") if ok else ("gitlab", "gitlab.com")
    if not host:
        host = "github.com" if platform == "github" else "gitlab.com"
    if not platform:
        raise SystemExit(f"не смог определить платформу для {host}: передай --platform github|gitlab")

    if origin:
        try:
            o_host, o_path = parse_remote(origin)
            in_checkout = (o_host.lower(), o_path.lower()) == (host.lower(), path.lower())
        except ValueError:
            pass

    data = collect_github(host, path) if platform == "github" else collect_gitlab(host, path)
    data["fetched_at"] = NOW.strftime("%Y-%m-%dT%H:%M:%SZ")
    data["in_checkout"] = in_checkout
    t = data["totals"]
    data["complete"] = (t["prs"] in (None, len(data["prs"]))) and (t["issues"] in (None, len(data["issues"])))

    if args.out:
        out = args.out
    else:
        out = os.path.join(tempfile.mkdtemp(prefix="git-backlog-triage-"), "backlog.json")
    safe_write(out, json.dumps(data, ensure_ascii=False, indent=1))

    print(f"repo: {data['repo']} ({data['platform']}, {data['host']}) default={data['default_branch']}"
          f" archived={data['archived']} viewer={data['viewer_permission']}"
          f" merge_methods={','.join(m for m in data['merge_methods'] if m)} in_checkout={in_checkout}")
    print(f"default branch checks: {checks_str(data['default_branch_checks'])}")
    for w in data["default_branch_checks"].get("workflows", []):
        print(f"  workflow {w['name']}: {w['conclusion'] or w['status']} ({w['event']}, {w['created_at'][:16]}Z) {w['url']}")
    print(f"fetched_at: {data['fetched_at']}  data: {out}")
    for kind in ("prs", "issues"):
        got, total = len(data[kind]), t[kind]
        status = "OK" if total in (None, got) else f"НЕПОЛНО: платформа говорит {total}"
        print(f"{kind}: получено {got}, всего {total if total is not None else '?'} — {status}")
    print("\n== PR/MR ==")
    for p in data["prs"]:
        print(pr_line(p))
    if data.get("closed_unmerged"):
        print(f"\n== ЗАКРЫТЫ БЕЗ МЕРЖА за {CLOSED_WINDOW_DAYS} дней (политика проекта) ==")
        for c in data["closed_unmerged"]:
            tail = ""
            if c["last_comment_by"]:
                text = " ".join(c["last_comment"].split())[:160]
                tail = f" | последний комментарий {c['last_comment_by']}: {text}"
            print(f"#{c['number']} {c['title']} | by {c['author']} | закрыт {c['closed_days']}d назад{tail}")
    print("\n== ISSUES ==")
    for i in data["issues"]:
        print(issue_line(i))
    if not data["complete"]:
        print("\nВНИМАНИЕ: данные неполные, отчёт обязан это назвать", file=sys.stderr)


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as e:
        raise SystemExit(f"ошибка: {e}")
