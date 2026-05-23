#!/usr/bin/env node
/* eslint-disable no-console */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const HOME = os.homedir();
const REPO_URL = 'https://github.com/jtprogru/bear-skills.git';
const DEFAULT_SOURCE = path.join(HOME, '.bear-skills');
const DEFAULT_CLAUDE_HOME = path.join(HOME, '.claude');

// ─────────────────────────────────────────────────────────────────────────────
// Парсинг аргументов
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      let key, val;
      if (eq > -1) {
        key = a.slice(2, eq);
        val = a.slice(eq + 1);
      } else {
        key = a.slice(2);
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith('--')) {
          val = next;
          i++;
        } else {
          val = true;
        }
      }
      args.flags[key] = val;
    } else {
      args._.push(a);
    }
  }
  return args;
}

function resolveOpts(args) {
  return {
    vault: args.flags.vault
      ? path.resolve(String(args.flags.vault))
      : process.env.BEAR_VAULT
        ? path.resolve(process.env.BEAR_VAULT)
        : null,
    claudeHome: args.flags['claude-home']
      ? path.resolve(String(args.flags['claude-home']))
      : DEFAULT_CLAUDE_HOME,
    dryRun: !!args.flags['dry-run'],
    noClone: !!args.flags['no-clone'] || !!args.flags.source,
    force: !!args.flags.force,
  };
}

function resolveSource(args) {
  if (args.flags.source) return path.resolve(String(args.flags.source));
  return DEFAULT_SOURCE;
}

// ─────────────────────────────────────────────────────────────────────────────
// Git source-management
// ─────────────────────────────────────────────────────────────────────────────

function isGitRepo(dir) {
  return fs.existsSync(path.join(dir, '.git'));
}

function git(args, cwd) {
  execFileSync('git', args, { stdio: 'inherit', cwd });
}

function ensureSource(source, opts) {
  if (isGitRepo(source)) {
    if (opts.noClone) return;
    console.log(`📥 git pull в ${source}...`);
    try {
      git(['-C', source, 'pull', '--ff-only'], undefined);
    } catch {
      console.warn('  ⚠️  git pull не удался, продолжаю с локальной копией');
    }
    return;
  }
  if (opts.noClone) {
    if (!fs.existsSync(source)) {
      throw new Error(
        `source ${source} не существует, --no-clone/--source не позволяет клонировать`,
      );
    }
    return;
  }
  if (fs.existsSync(source) && fs.readdirSync(source).length > 0) {
    throw new Error(
      `${source} существует и не пустой, но не git-репо. Удали вручную или укажи --source`,
    );
  }
  console.log(`📥 git clone ${REPO_URL} → ${source}...`);
  git(['clone', REPO_URL, source]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Манифесты доменов
// ─────────────────────────────────────────────────────────────────────────────

// Простой YAML-парсер для нашего узкого формата:
//   name: <string>
//   description: <string>
//   requires_env:
//     - VAR1
//     - VAR2
//   targets:
//     rules:  <path-with-${vars}>
//     skills: <path>
//     agents: <path>
function parseManifestYaml(text) {
  const m = { name: null, description: null, requires_env: [], targets: {} };
  const lines = text.split('\n');
  let section = null;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.replace(/#.*$/, '').trimEnd();
    if (!line.trim()) continue;

    // Top-level: key: value
    const topMatch = line.match(/^([a-z_]+):\s*(.*)$/);
    const isIndented = /^\s+/.test(raw);

    if (!isIndented && topMatch) {
      const [, k, v] = topMatch;
      if (k === 'name') {
        m.name = v.trim();
        section = null;
      } else if (k === 'description') {
        m.description = v.trim();
        section = null;
      } else if (k === 'requires_env') {
        section = 'requires_env';
      } else if (k === 'targets') {
        section = 'targets';
      } else {
        section = null;
      }
      continue;
    }

    if (section === 'requires_env') {
      const itemMatch = line.match(/^\s*-\s+(.+)$/);
      if (itemMatch) m.requires_env.push(itemMatch[1].trim());
    } else if (section === 'targets') {
      const subMatch = line.match(/^\s+([a-z_]+):\s*(.+)$/);
      if (subMatch) m.targets[subMatch[1]] = subMatch[2].trim();
    }
  }
  if (!m.name) throw new Error('manifest: нет поля name');
  if (!m.targets.rules && !m.targets.skills && !m.targets.agents) {
    throw new Error(`manifest ${m.name}: ни одного targets.<rules|skills|agents>`);
  }
  return m;
}

// Подстановка ${VAR} из process.env + специальные переменные.
function expandPath(p, env) {
  return p.replace(/\$\{([A-Z_][A-Z0-9_]*)\}/g, (_, key) => {
    if (env[key] === undefined) {
      throw new Error(`не задана переменная ${key} для пути "${p}"`);
    }
    return env[key];
  });
}

function loadDomain(domainDir) {
  const manifestPath = path.join(domainDir, 'manifest.yaml');
  if (!fs.existsSync(manifestPath)) return null;
  const text = fs.readFileSync(manifestPath, 'utf8');
  const m = parseManifestYaml(text);
  return {
    name: m.name,
    description: m.description || '',
    requires_env: m.requires_env || [],
    targets: m.targets,
    dir: domainDir,
    rulesSrc: path.join(domainDir, 'rules'),
    skillsSrc: path.join(domainDir, 'skills'),
    agentsSrc: path.join(domainDir, 'agents'),
  };
}

function loadAllDomains(source) {
  const domainsDir = path.join(source, 'domains');
  if (!fs.existsSync(domainsDir)) return [];
  return fs
    .readdirSync(domainsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => loadDomain(path.join(domainsDir, d.name)))
    .filter(Boolean);
}

function resolveTargets(domain, opts) {
  const env = {
    ...process.env,
    CLAUDE_HOME: opts.claudeHome,
    BEAR_VAULT: opts.vault || process.env.BEAR_VAULT || '',
  };
  const missing = domain.requires_env.filter((v) => !env[v]);
  if (missing.length > 0) {
    return { error: `требует env: ${missing.join(', ')}` };
  }
  const targets = {};
  for (const [k, v] of Object.entries(domain.targets)) {
    targets[k] = path.resolve(expandPath(v, env));
  }
  return { targets };
}

// ─────────────────────────────────────────────────────────────────────────────
// FS-операции
// ─────────────────────────────────────────────────────────────────────────────

function listSubdirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

function listFiles(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && (!ext || d.name.endsWith(ext)))
    .map((d) => d.name);
}

function ensureDir(dir, dryRun) {
  if (fs.existsSync(dir)) return;
  if (dryRun) {
    console.log(`  [dry] mkdir -p ${dir}`);
    return;
  }
  fs.mkdirSync(dir, { recursive: true });
}

function linkOne(src, dst, dryRun) {
  if (dryRun) {
    console.log(`  [dry] ln -sfn ${src} ${dst}`);
    return;
  }
  try {
    const st = fs.lstatSync(dst);
    if (st.isSymbolicLink() || st.isFile()) {
      fs.unlinkSync(dst);
    } else if (st.isDirectory()) {
      fs.rmSync(dst, { recursive: true, force: true });
    }
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  fs.symlinkSync(src, dst);
}

function unlinkSymlink(dst, dryRun) {
  let st;
  try {
    st = fs.lstatSync(dst);
  } catch {
    return false;
  }
  if (!st.isSymbolicLink()) return false;
  if (dryRun) {
    console.log(`  [dry] rm ${dst}`);
    return true;
  }
  fs.unlinkSync(dst);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Каталог компонентов
// ─────────────────────────────────────────────────────────────────────────────

function listDomainComponents(domain) {
  return {
    rules: listFiles(domain.rulesSrc, '.md').map((f) => f.replace(/\.md$/, '')),
    skills: listSubdirs(domain.skillsSrc),
    agents: listFiles(domain.agentsSrc, '.md').map((f) =>
      f.replace(/\.md$/, ''),
    ),
  };
}

// Из позиционных аргументов делаем фильтр {domains: Set, items: Set}.
// items могут быть строками "skill:name", "rule:name", "agent:name", "name".
function parseSelection(args, allDomains) {
  const positional = args._.slice(1); // первый — команда
  const domainNames = new Set(allDomains.map((d) => d.name));
  const sel = { domains: new Set(), items: [] };
  let explicit = false;

  // Поддержка флага --domains=a,b
  const flagDomains = args.flags.domains;
  if (flagDomains && flagDomains !== true) {
    for (const d of String(flagDomains).split(',').map((s) => s.trim()).filter(Boolean)) {
      if (!domainNames.has(d)) throw new Error(`Домен "${d}" не найден.`);
      sel.domains.add(d);
      explicit = true;
    }
  }

  for (const p of positional) {
    explicit = true;
    if (p.includes(':')) {
      const [type, name] = p.split(':', 2);
      if (!['skill', 'rule', 'agent'].includes(type)) {
        throw new Error(`Неизвестный тип "${type}". Используй skill:/rule:/agent:`);
      }
      sel.items.push({ type, name });
    } else if (domainNames.has(p)) {
      sel.domains.add(p);
    } else {
      sel.items.push({ type: null, name: p }); // авто-детект позже
    }
  }

  return { selection: sel, explicit };
}

// Применяем selection к домену: возвращаем что именно ставить из него.
function pickFromDomain(domain, selection, explicit) {
  const all = listDomainComponents(domain);
  if (!explicit) {
    return all;
  }

  // Если домен явно перечислен — ставим из него всё.
  if (selection.domains.has(domain.name)) {
    return all;
  }

  // Иначе — ищем items, которые ссылаются на компоненты этого домена.
  const picked = { rules: [], skills: [], agents: [] };
  for (const it of selection.items) {
    const tryAdd = (cat, name) => {
      if (all[cat].includes(name) && !picked[cat].includes(name)) {
        picked[cat].push(name);
        return true;
      }
      return false;
    };
    if (it.type === 'skill') tryAdd('skills', it.name);
    else if (it.type === 'rule') tryAdd('rules', it.name);
    else if (it.type === 'agent') tryAdd('agents', it.name);
    else {
      // авто-детект
      tryAdd('skills', it.name) ||
        tryAdd('rules', it.name) ||
        tryAdd('agents', it.name);
    }
  }
  return picked;
}

// ─────────────────────────────────────────────────────────────────────────────
// Команды
// ─────────────────────────────────────────────────────────────────────────────

function cmdInstall(args) {
  const opts = resolveOpts(args);
  const source = resolveSource(args);
  ensureSource(source, opts);
  const domains = loadAllDomains(source);
  if (domains.length === 0) {
    throw new Error(`В ${source} нет доменов (папки domains/<name>/manifest.yaml)`);
  }

  const { selection, explicit } = parseSelection(args, domains);

  // Валидация: явные имена должны где-то существовать
  if (explicit) {
    const allItems = new Set();
    for (const d of domains) {
      const c = listDomainComponents(d);
      c.rules.forEach((n) => allItems.add(`rule:${n}`));
      c.skills.forEach((n) => allItems.add(`skill:${n}`));
      c.agents.forEach((n) => allItems.add(`agent:${n}`));
    }
    for (const it of selection.items) {
      if (it.type) {
        if (!allItems.has(`${it.type}:${it.name}`)) {
          throw new Error(`Компонент ${it.type}:${it.name} не найден.`);
        }
      } else {
        const candidates = ['skill', 'rule', 'agent'].filter((t) =>
          allItems.has(`${t}:${it.name}`),
        );
        if (candidates.length === 0) {
          throw new Error(
            `Компонент "${it.name}" не найден. Запусти "bear-skills list".`,
          );
        }
        if (candidates.length > 1) {
          throw new Error(
            `Имя "${it.name}" неоднозначно (${candidates.join(', ')}). Уточни префиксом.`,
          );
        }
      }
    }
  }

  let totalLinked = 0;
  let skippedDomains = [];

  for (const d of domains) {
    // если явный отбор и этот домен не задействован — пропускаем
    if (explicit) {
      const picked = pickFromDomain(d, selection, explicit);
      if (
        picked.rules.length === 0 &&
        picked.skills.length === 0 &&
        picked.agents.length === 0
      ) {
        continue;
      }
    }

    const r = resolveTargets(d, opts);
    if (r.error) {
      skippedDomains.push({ name: d.name, reason: r.error });
      continue;
    }

    const picked = pickFromDomain(d, selection, explicit);
    console.log(`\n📦 ${d.name}`);
    console.log(`   rules  → ${r.targets.rules || '—'}`);
    console.log(`   skills → ${r.targets.skills || '—'}`);
    console.log(`   agents → ${r.targets.agents || '—'}`);

    if (picked.rules.length > 0 && r.targets.rules) {
      ensureDir(r.targets.rules, opts.dryRun);
      for (const n of picked.rules) {
        const src = path.join(d.rulesSrc, `${n}.md`);
        const dst = path.join(r.targets.rules, `${n}.md`);
        linkOne(src, dst, opts.dryRun);
        console.log(`   rule:  ${n}`);
        totalLinked++;
      }
    }
    if (picked.skills.length > 0 && r.targets.skills) {
      ensureDir(r.targets.skills, opts.dryRun);
      for (const n of picked.skills) {
        const src = path.join(d.skillsSrc, n);
        const dst = path.join(r.targets.skills, n);
        linkOne(src, dst, opts.dryRun);
        console.log(`   skill: ${n}`);
        totalLinked++;
      }
    }
    if (picked.agents.length > 0 && r.targets.agents) {
      ensureDir(r.targets.agents, opts.dryRun);
      for (const n of picked.agents) {
        const src = path.join(d.agentsSrc, `${n}.md`);
        const dst = path.join(r.targets.agents, `${n}.md`);
        linkOne(src, dst, opts.dryRun);
        console.log(`   agent: ${n}`);
        totalLinked++;
      }
    }
  }

  console.log('');
  if (skippedDomains.length > 0) {
    console.log('⚠️  Пропущены домены:');
    for (const s of skippedDomains) {
      console.log(`   ${s.name}: ${s.reason}`);
    }
  }
  console.log(`\n✅ Развёрнуто компонентов: ${totalLinked}`);
}

function cmdUninstall(args) {
  const opts = resolveOpts(args);
  const source = resolveSource(args);
  if (!fs.existsSync(source)) {
    console.log(`Source ${source} не существует — сканирую цели на симлинки в bear-skills.`);
    return cmdUninstallByScan(opts);
  }
  const domains = loadAllDomains(source);
  const { selection, explicit } = parseSelection(args, domains);

  let removed = 0;
  for (const d of domains) {
    const r = resolveTargets(d, opts);
    if (r.error) continue;
    const picked = pickFromDomain(d, selection, explicit);

    for (const n of picked.rules) {
      if (r.targets.rules) {
        const dst = path.join(r.targets.rules, `${n}.md`);
        if (unlinkSymlink(dst, opts.dryRun)) {
          console.log(`  unlinked: ${dst}`);
          removed++;
        }
      }
    }
    for (const n of picked.skills) {
      if (r.targets.skills) {
        const dst = path.join(r.targets.skills, n);
        if (unlinkSymlink(dst, opts.dryRun)) {
          console.log(`  unlinked: ${dst}`);
          removed++;
        }
      }
    }
    for (const n of picked.agents) {
      if (r.targets.agents) {
        const dst = path.join(r.targets.agents, `${n}.md`);
        if (unlinkSymlink(dst, opts.dryRun)) {
          console.log(`  unlinked: ${dst}`);
          removed++;
        }
      }
    }
  }
  console.log(`✅ Снято симлинков: ${removed}`);
}

function cmdUninstallByScan(opts) {
  const candidates = new Set();
  if (opts.vault) {
    candidates.add(path.join(opts.vault, '.agents', 'rules'));
  }
  candidates.add(path.join(opts.claudeHome, 'rules'));
  candidates.add(path.join(opts.claudeHome, 'skills'));
  candidates.add(path.join(opts.claudeHome, 'agents'));

  let removed = 0;
  for (const dir of candidates) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      const dst = path.join(dir, name);
      let target;
      try {
        const st = fs.lstatSync(dst);
        if (!st.isSymbolicLink()) continue;
        target = fs.readlinkSync(dst);
      } catch {
        continue;
      }
      if (target.includes('bear-skills')) {
        if (unlinkSymlink(dst, opts.dryRun)) {
          console.log(`  unlinked: ${dst}`);
          removed++;
        }
      }
    }
  }
  console.log(`✅ Снято симлинков: ${removed}`);
}

function cmdSync(args) {
  cmdUninstall(args);
  cmdInstall(args);
}

function cmdStatus(args) {
  const opts = resolveOpts(args);
  const source = resolveSource(args);
  if (!fs.existsSync(source)) {
    console.log(`Source ${source} не существует. Запусти "bear-skills install".`);
    return;
  }
  const domains = loadAllDomains(source);
  console.log(`📍 Source: ${source}`);
  console.log(`📍 CLAUDE_HOME: ${opts.claudeHome}`);
  console.log(`📍 BEAR_VAULT:  ${opts.vault || '(не задан)'}\n`);

  for (const d of domains) {
    const r = resolveTargets(d, opts);
    if (r.error) {
      console.log(`📦 ${d.name}  ⚠️  ${r.error}\n`);
      continue;
    }
    const all = listDomainComponents(d);
    console.log(`📦 ${d.name}`);
    const checkCat = (label, names, dstBase, suffix) => {
      if (names.length === 0) return;
      console.log(`  ${label} (${names.length}):`);
      for (const n of names) {
        const dst = path.join(dstBase, n + (suffix || ''));
        let ok = false;
        try {
          ok = fs.lstatSync(dst).isSymbolicLink();
        } catch {}
        console.log(`    ${ok ? '✅' : '❌'} ${n}`);
      }
    };
    if (r.targets.rules) checkCat('rules', all.rules, r.targets.rules, '.md');
    if (r.targets.skills) checkCat('skills', all.skills, r.targets.skills, '');
    if (r.targets.agents) checkCat('agents', all.agents, r.targets.agents, '.md');
    console.log('');
  }
}

function cmdList(args) {
  const source = resolveSource(args);
  if (!fs.existsSync(source)) {
    console.error(`Source ${source} не существует.`);
    process.exit(1);
  }
  const domains = loadAllDomains(source);
  console.log(`📦 Домены в ${source}\n`);
  for (const d of domains) {
    const all = listDomainComponents(d);
    const reqEnv = d.requires_env.length
      ? ` [requires: ${d.requires_env.join(', ')}]`
      : '';
    console.log(`▸ ${d.name}${reqEnv}`);
    if (d.description) console.log(`  ${d.description}`);
    if (all.rules.length) {
      console.log(`  rules (${all.rules.length}):`);
      for (const n of all.rules) console.log(`    rule:${n}`);
    }
    if (all.skills.length) {
      console.log(`  skills (${all.skills.length}):`);
      for (const n of all.skills) console.log(`    skill:${n}`);
    }
    if (all.agents.length) {
      console.log(`  agents (${all.agents.length}):`);
      for (const n of all.agents) console.log(`    agent:${n}`);
    }
    console.log('');
  }
}

function readFrontmatter(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  if (lines[0] !== '---') return { error: 'нет YAML-фронтматтера' };
  let close = -1;
  for (let i = 1; i < Math.min(lines.length, 40); i++) {
    if (lines[i] === '---') {
      close = i;
      break;
    }
  }
  if (close < 0) return { error: 'фронтматтер не закрыт' };
  const fm = lines.slice(1, close).join('\n');
  if (!/^name:/m.test(fm)) return { error: 'нет поля name' };
  if (!/^description:/m.test(fm)) return { error: 'нет поля description' };
  return { ok: true };
}

function cmdCheck(args) {
  const source = resolveSource(args);
  if (!fs.existsSync(source)) {
    console.error(`Source ${source} не существует`);
    process.exit(1);
  }
  const domains = loadAllDomains(source);
  let fail = 0;

  for (const d of domains) {
    console.log(`🔍 [${d.name}] manifest`);
    if (!d.targets.rules && !d.targets.skills && !d.targets.agents) {
      console.log(`  ❌ нет ни одного targets`);
      fail = 1;
    } else {
      console.log(`  ✅ manifest OK`);
    }

    console.log(`🔍 [${d.name}] skills:`);
    for (const s of listSubdirs(d.skillsSrc)) {
      const f = path.join(d.skillsSrc, s, 'SKILL.md');
      if (!fs.existsSync(f)) {
        console.log(`  ❌ ${s}: нет SKILL.md`);
        fail = 1;
        continue;
      }
      const r = readFrontmatter(f);
      if (r.error) {
        console.log(`  ❌ ${s}: ${r.error}`);
        fail = 1;
      } else console.log(`  ✅ ${s}`);
    }

    console.log(`🔍 [${d.name}] agents:`);
    for (const a of listFiles(d.agentsSrc, '.md')) {
      const r = readFrontmatter(path.join(d.agentsSrc, a));
      if (r.error) {
        console.log(`  ❌ ${a}: ${r.error}`);
        fail = 1;
      } else console.log(`  ✅ ${a}`);
    }
    console.log('');
  }

  if (fail) {
    console.log('❌ Проверка не прошла.');
    process.exit(1);
  } else {
    console.log('✅ Всё валидно.');
  }
}

function cmdHelp() {
  const pkgPath = path.join(PACKAGE_ROOT, 'package.json');
  let version = '?';
  try {
    version = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version || '?';
  } catch {}
  console.log(`bear-skills ${version} — мульти-доменная коллекция правил, скиллов и агентов для Claude Code

Использование:
  npx github:jtprogru/bear-skills <команда> [домены|компоненты...] [флаги]
  bear-skills <команда> [домены|компоненты...] [флаги]   # если установлено глобально

Команды:
  install     Клонирует репо в ~/.bear-skills (если ещё нет) и разворачивает симлинки.
              Без аргументов — все домены, у которых выполнены requires_env.
              С именем домена — только этот домен (целиком).
              С компонентами skill:/rule:/agent: — точечно.
  uninstall   Снимает симлинки. Без аргументов — все. С компонентами — точечно.
  sync        uninstall + git pull + install
  status      Показать, что и куда развёрнуто, по доменам
  list        Список всех доменов и их компонентов
  check       Валидация манифестов и фронтматтера
  help        Эта справка

Домены (примеры; точный список — bear-skills list):
  obsidian    PKB на Obsidian (требует BEAR_VAULT)
  git         Git workflow, релизы
  sre         SRE/Kubernetes — incident, runbooks, k8s-triage
  content     Контент-pipeline — TG-посты, статьи, туториалы

Примеры:
  # Полная установка всех доменов, где выполнены требования:
  npx github:jtprogru/bear-skills install --vault "$HOME/Obsidian/MyVault"

  # Только один домен:
  npx github:jtprogru/bear-skills install git

  # Несколько доменов:
  npx github:jtprogru/bear-skills install obsidian git --vault "$HOME/Obsidian/MyVault"

  # Точечная установка одного скилла:
  npx github:jtprogru/bear-skills install skill:obsidian-ingest --vault ...

  # Удалить домен целиком:
  npx github:jtprogru/bear-skills uninstall sre

Флаги:
  --vault <path>         Путь к Obsidian vault. Может быть задан env BEAR_VAULT.
  --claude-home <path>   Путь к ~/.claude (по умолчанию \$HOME/.claude)
  --domains <list>       Альтернативный способ выбора доменов (через запятую)
  --source <path>        Локальный source вместо ~/.bear-skills. Подразумевает --no-clone.
  --no-clone             Не делать git clone/pull
  --dry-run              Показать действия, ничего не меняя

Домены, у которых не выполнен requires_env, пропускаются с warning'ом —
например, без BEAR_VAULT obsidian-домен скипнется, но git/sre/content поставятся.
`);
}

const COMMANDS = {
  install: cmdInstall,
  uninstall: cmdUninstall,
  sync: cmdSync,
  status: cmdStatus,
  list: cmdList,
  check: cmdCheck,
  help: cmdHelp,
  '--help': cmdHelp,
  '-h': cmdHelp,
};

function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0] || 'help';
  const fn = COMMANDS[cmd];
  if (!fn) {
    console.error(`Неизвестная команда: ${cmd}\n`);
    cmdHelp();
    process.exit(1);
  }
  try {
    fn(args);
  } catch (e) {
    console.error('❌', e.message);
    process.exit(1);
  }
}

main();
