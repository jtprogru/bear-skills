# AGENTS.md

Этот файл — точка входа для любого AI-агента, который работает со скиллами `bear-skills`. Прочитай его целиком до первого действия.

## Что такое bear-skills

Это мульти-доменная коллекция правил, скиллов и агентов для Claude Code. Каждый домен — самодостаточная вертикаль (Obsidian PKB, Git workflow, SRE/Kubernetes, контент). Структура единая, контракт работы общий.

## Архитектура

```
bear-skills/
└── domains/
    ├── <domain-name>/
    │   ├── manifest.yaml      ← name, description, requires_env, targets
    │   ├── rules/             ← долговечные правила домена
    │   ├── skills/            ← атомарные операции
    │   └── agents/            ← оркестраторы
    └── ...
```

Каждый домен в `domains/<name>/` имеет свой `manifest.yaml`, который объявляет:
- `name`, `description` — что это за домен
- `requires_env` — переменные окружения, без которых домен не разворачивается (например, `BEAR_VAULT` для obsidian)
- `targets` — куда уезжают rules/skills/agents после `install`

Зависимости — только сверху вниз: агент знает про скилл, скилл знает про правило. Обратное не допускается.

## Текущие домены

| Домен | requires_env | Что делает |
|-------|-------------|-----------|
| `obsidian` | `BEAR_VAULT` | PKB на Obsidian по PARA — ингест, разбор inbox, untangle hub, ежедневник |
| `git` | — | Git workflow — Conventional Commits, PR-описания, semver-релизы |
| `sre` | — | SRE — incident postmortem, runbook authoring, Kubernetes triage |
| `content` | — | Контент — Telegram-посты, статьи, технические туториалы |

Детали — в `domains/<name>/manifest.yaml` и в файлах внутри.

## Куда что разворачивается

После `bear-skills install`:
- `obsidian` rules → `$BEAR_VAULT/.agents/rules/` (vault-local, скиллы ссылаются как `.agents/rules/<file>.md`)
- `git`, `sre`, `content` rules → `~/.claude/rules/` (глобально, скиллы ссылаются как `~/.claude/rules/<file>.md`)
- все skills → `~/.claude/skills/`
- все agents → `~/.claude/agents/`

Если у домена не выполнен `requires_env` — он скипается с warning, остальные ставятся.

## Что делать до первого действия

1. **Опознай, к какому домену относится задача.** Имя скилла обычно начинается с префикса домена (`obsidian-ingest`, `git-conventional-commit`, `sre-k8s-triage`, `content-tg-post`).
2. **Прочитай правила своего домена.** Скиллы и агенты в начале файла указывают, какие правила нужны.
3. **Если задача затрагивает несколько доменов** (например, написать постмортем и опубликовать как Telegram-пост) — последовательно подключай скиллы из разных доменов, соблюдая правила каждого.
4. **Если задача не попадает ни под скилл, ни под агента** — действуй вручную, опираясь на общие принципы ниже. После — спроси пользователя, не превратить ли это в скилл.

## Общие принципы (всеми доменами соблюдаются)

### Контракт работы с пользователем

**План → подтверждение → действие → отчёт.** Если задача — пачка изменений или необратимое действие (push, tag, delete, публикация) — сначала покажи план, дождись подтверждения, потом выполняй.

### Язык и тон

- Русский, технические термины — английские (`SRE`, `Kubernetes`, `goroutine`, `Pod`)
- Обращение «ты» или безличные конструкции
- Не канцелярский тон, не Wikipedia-стиль

### Не делай в любом домене

- **Не удаляй заметки / коммиты / ресурсы** без явного запроса
- **Не выдумывай числа, имена, команды** — если данных не хватает, спроси
- **Не пиши «человеческая ошибка» как root cause** — это всегда системная проблема (правило из sre, применимо везде)
- **Не публикуй / не пушь / не тегай** без явного «делай»
- **Не теряй авторский голос** — это личные инструменты, не безличный продакшн

### Когда домен пересекается с другим

Примеры пересечений:
- **Постмортем (sre)** → попадает в **базу знаний (obsidian)**: пишем по `sre-incident-postmortem`, потом ингестим через `obsidian-ingest`.
- **Релизные заметки (git-release-tag)** → могут стать **Telegram-постом (content-tg-post)** для канала.
- **Туториал (content-tutorial-structure)** → может содержать **runbook-логику (sre-runbook-template)**.

В таких случаях соблюдай правила обоих доменов — они дополняют, не противоречат.

## Карта компонентов

### domain: obsidian

**Skills:**
- `obsidian-inbox-review` — осмотр `00. Входящие/`, без изменений
- `obsidian-refactor-inbox` — типизация → frontmatter → связи → PARA
- `obsidian-enrich-note` — точечное обновление frontmatter одной заметки
- `obsidian-ingest` — внешний источник → литературная заметка + атомарки
- `book-highlights-processor` — экспорт цитат из iBooks/Zotero → Obsidian callouts
- `obsidian-refactor-lecture` — конспект лекции → оглавление + атомарные концепты
- `obsidian-split-note` — большая заметка → атомарные + ссылки в оригинале
- `obsidian-untangle-knot` — hub-узел с десятками входящих → под-MOC и перепривязка
- `obsidian-note-critic` — критика заметки: похожие, противоположные, противоречия
- `obsidian-daily-append` — добавление записи в сегодняшнюю ежедневную заметку
- `obsidian-journal-review` — еженедельные/ежемесячные обзоры дневника

**Agents:**
- `obsidian-inbox-triager` — разобрать `00. Входящие/`
- `obsidian-source-ingester` — внешний источник в базу
- `obsidian-knowledge-cartographer` — здоровье графа (hub, split, MOC)
- `obsidian-note-doctor` — поправить и/или покритиковать одну заметку
- `obsidian-journal-keeper` — дневник, обзоры

### domain: git

**Skills:**
- `git-conventional-commit` — commit-message по Conventional Commits для текущего diff
- `git-pr-description` — описание PR из diff ветки против main
- `git-release-tag` — semver-тег с changelog из коммитов

**Agents:**
- `git-flow` — оркестратор GitHub Flow (ветка → коммиты → PR → тег)

### domain: sre

**Skills:**
- `sre-incident-postmortem` — структурированный blameless-постмортем
- `sre-runbook-author` — исполняемый runbook для алерта или сценария
- `sre-k8s-triage` — диагностика Pod/Deployment/Service от симптома к причине

**Agents:**
- `sre-oncall-engineer` — оркестратор on-call реакции (алерт → митигация → resolved → постмортем)

### domain: content

**Skills:**
- `content-tg-post` — пост в Telegram (500-1500 символов, тезис первым)
- `content-article-draft` — драфт статьи (Habr / Medium / личный блог)
- `content-tutorial-structure` — скелет технического туториала

**Agents:**
- `content-editor` — редактор контент-pipeline от идеи до публикации

## Развёртывание

```bash
# Всё, что можно установить с текущим окружением:
npx github:jtprogru/bear-skills install --vault "$HOME/Obsidian/MyVault"

# Только один домен:
npx github:jtprogru/bear-skills install git

# Точечно один скилл:
npx github:jtprogru/bear-skills install skill:sre-k8s-triage

# Что развёрнуто:
npx github:jtprogru/bear-skills status

# Список всего доступного:
npx github:jtprogru/bear-skills list
```

Без `BEAR_VAULT` — `obsidian` скипается, остальные ставятся.

## Добавление нового домена

1. Создай `domains/<new-domain>/{rules,skills,agents}/`
2. Создай `domains/<new-domain>/manifest.yaml` с `name`, `description`, `requires_env`, `targets`
3. Добавь rules/skills/agents с префиксом `<new-domain>-` в именах файлов
4. Прогони `make check` — должно быть зелёным
5. Закоммить и опубликуй

CLI и Makefile автоматически подхватят новый домен без правок.
