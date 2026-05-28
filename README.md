# bear-skills

Мульти-доменная коллекция правил, скиллов и агентов для Claude Code. Личные инструменты для **Obsidian PKB**, **Git workflow**, **SRE/Kubernetes** и **контента**, упакованные в один npm-пакет.

📚 **Полная документация:** [`docs/`](docs/README.md)

## Быстрый старт

```bash
# Если нужен obsidian-домен:
export BEAR_VAULT="$HOME/Obsidian/MyVault"

# Поставить всё, что возможно с текущим окружением:
npx github:jtprogru/bear-skills install
```

Что произойдёт: CLI склонирует репо в `~/.bear-skills/`, прочитает `manifest.yaml` каждого домена и расставит симлинки. Домены, у которых не выполнены требования (например, `obsidian` без `BEAR_VAULT`) — пропустит с warning'ом.

Подробнее: [docs/installation/full.md](docs/installation/full.md).

## Домены

| Домен | requires_env | Что внутри |
|-------|-------------|-----------|
| **[`obsidian`](docs/domains/obsidian/)** | `BEAR_VAULT` | PKB на Obsidian по PARA — ингест, разбор inbox, untangle hub, ежедневник. **9 правил, 11 скиллов, 5 агентов.** |
| **[`git`](docs/domains/git/README.md)** | — | Git workflow — Conventional Commits, описания PR, semver-релизы. **1 правило, 3 скилла, 1 агент.** |
| **[`sre`](docs/domains/sre/README.md)** | — | SRE / Kubernetes — incident postmortem, runbooks, k8s-триаж. **2 правила, 3 скилла, 1 агент.** |
| **[`content`](docs/domains/content/README.md)** | — | Контент — Telegram-посты, статьи, технические туториалы, очеловечивание текста. **2 правила, 4 скилла, 1 агент.** |

## Структура репозитория

```
bear-skills/
├── domains/
│   ├── obsidian/
│   │   ├── manifest.yaml   ← targets, requires_env
│   │   ├── rules/
│   │   ├── skills/
│   │   └── agents/
│   ├── git/    {manifest, rules, skills, agents}
│   ├── sre/    {manifest, rules, skills, agents}
│   └── content/{manifest, rules, skills, agents}
│
├── docs/                   # Документация для человека → docs/README.md
├── AGENTS.md               # Точка входа для AI-агента
├── LICENSE
├── package.json
├── bin/cli.js              # CLI
└── Makefile
```

## Точечная установка

Не нужен весь набор? Поставь только конкретный домен или компонент:

```bash
# Только один домен:
bear-skills install git

# Несколько доменов:
bear-skills install obsidian git sre

# Конкретный скилл из любого домена:
bear-skills install skill:sre-k8s-triage

# Список всех доменов и компонентов:
bear-skills list
```

Подробнее: [docs/installation/partial.md](docs/installation/partial.md).

## CLI

```bash
bear-skills help            # справка
bear-skills install         # все домены, у которых выполнены требования
bear-skills install <дом>   # один или несколько доменов
bear-skills uninstall       # снять симлинки
bear-skills sync            # git pull + relink
bear-skills status          # что развёрнуто, по доменам
bear-skills list            # дерево домен → компоненты
bear-skills check           # валидация манифестов и фронтматтера
```

Флаги: `--vault <path>` (или env `BEAR_VAULT`), `--claude-home <path>`, `--dry-run`, `--source <path>`, `--no-clone`.

## Документация

- **[Обзор всей документации](docs/README.md)**
- **[Установка](docs/installation/README.md)** — полная и точечная
- **[Решение проблем](docs/installation/troubleshooting.md)**
- **Per-domain:** [obsidian](docs/domains/obsidian/), [git](docs/domains/git/README.md), [sre](docs/domains/sre/README.md), [content](docs/domains/content/README.md)

## Добавление нового домена

Один шаг:

1. Создай `domains/<new-name>/{manifest.yaml, rules/, skills/, agents/}`
2. В `manifest.yaml` укажи `name`, `description`, `requires_env`, `targets`
3. `make check` — проверка фронтматтера

CLI подхватит новый домен автоматически.

## Лицензия

MIT — см. [`LICENSE`](LICENSE).
