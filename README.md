# bear-skills

Мульти-доменная коллекция правил, скиллов и агентов для Claude Code. Личные инструменты для **Obsidian PKB**, **Git workflow**, **SRE/Kubernetes** и **контента**, упакованные в один npm-пакет.

📚 **Полная документация:** [`docs/`](docs/README.md)

## Быстрый старт

```bash
curl -fsSL https://raw.githubusercontent.com/jtprogru/bear-skills/main/install.sh | bash
```

Скрипт найдёт установленные AI-агенты (Claude Code, Codex, Cursor, opencode) и разложит по ним скиллы. Дальше можно просто попросить агента «напиши постмортем» или «разбери входящие» — нужный скилл подхватится сам.

## Три способа установки

Выбери **один**. Два канала разом кладут файлы в одно место и дают дубли — установщик об этом предупредит.

| Способ | Кому | Команда |
|---|---|---|
| **Симлинки** | себе, если правишь скиллы | `npx github:jtprogru/bear-skills install` |
| **Плагин Claude Code** | если нужен только Claude Code | `claude plugin marketplace add jtprogru/bear-skills` |
| **Копии** | на чужую машину или другой агент | `curl … \| bash` (см. выше) |

Симлинк-канал ставит ссылки на репозиторий: правишь скилл — изменение видно сразу, без переустановки. Остальные два копируют файлы.

```bash
# Если нужен obsidian-домен — сначала путь к хранилищу:
export BEAR_VAULT="$HOME/Obsidian/MyVault"

npx github:jtprogru/bear-skills install
```

Домены, у которых не выполнены требования, пропускаются с предупреждением, а не роняют установку.

Подробнее: [docs/installation/README.md](docs/installation/README.md).

## Домены

| Домен | требует | Что внутри |
|-------|---------|-----------|
| **[`obsidian`](docs/domains/obsidian/)** | env `BEAR_VAULT` | PKB на Obsidian по PARA — ингест, разбор inbox, untangle hub, ежедневник. **9 правил, 11 скиллов, 5 агентов.** |
| **[`git`](docs/domains/git/README.md)** | — | Git workflow — Conventional Commits, описания PR, semver-релизы, релиз монорепо. **1 правило, 4 скилла, 1 агент.** |
| **[`sre`](docs/domains/sre/README.md)** | bin `srekit` для части скиллов | SRE / Kubernetes — постмортемы и runbook'и через srekit, k8s-триаж. **2 правила, 4 скилла, 1 агент.** |
| **[`content`](docs/domains/content/README.md)** | — | Контент — Telegram-посты, статьи, туториалы, очеловечивание. **2 правила, 4 скилла, 1 агент.** |
| **[`agentops`](docs/domains/agentops/README.md)** | — | Гигиена работы с агентом — сжатие memory-файлов, канарейка контекста, делегирование, краткость. **1 правило, 4 скилла, 3 агента.** |
| **[`code`](docs/domains/code/README.md)** | — | Допрос плана, состязательное ревью, построчные комментарии, последние 20%. **4 скилла.** |
| **[`bear`](docs/domains/bear/README.md)** | — | Мета — справка по коллекции, диагностика установки, создание скилла, статистика. **4 скилла.** |

Требования проверяются на установке. Нет `BEAR_VAULT` — пропускается весь домен `obsidian`. Нет CLI `srekit` — пропускаются только скиллы `srekit*`, остальной SRE-домен ставится.

## Структура репозитория

```
bear-skills/
├── domains/                # ← ЕДИНСТВЕННЫЙ источник правды
│   ├── obsidian/
│   │   ├── manifest.yaml   ← targets, requires_env, requires_bin
│   │   ├── rules/
│   │   ├── skills/<имя>/{SKILL.md, README.md, evals/, references/}
│   │   └── agents/
│   ├── git/     {manifest, rules, skills, agents}
│   ├── sre/     {manifest, rules, skills, agents}
│   └── content/ {manifest, rules, skills, agents}
│
├── skills/ agents/ rules/  # ← ЗЕРКАЛО, генерируется bin/mirror.js, не править
├── .claude-plugin/         # plugin.json + marketplace.json
├── bin/
│   ├── cli.js              # симлинк-установка по доменам
│   ├── install.js          # копирующая установка с детектом агентов
│   └── mirror.js           # генератор зеркала
├── tests/                  # node --test
├── docs/                   # Документация для человека → docs/README.md
├── AGENTS.md               # Точка входа для AI-агента
├── install.sh
├── LICENSE
├── package.json
└── Makefile
```

Правится только `domains/`. Каталоги `skills/`, `agents/`, `rules/` в корне генерируются из него для плагина и `npx skills add`; CI проверяет, что они не разошлись.

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
bear-skills lock-check      # сверка локального skills-lock.json с чужими скиллами на диске
bear-skills doctor          # диагностика: битые симлинки, дубли, пересечения триггеров
bear-skills stats           # какие скиллы реально срабатывают (по логам сессий)
```

## Что ещё есть

**[Runtime](docs/runtime.md)** — необязательный слой: `SessionStart`-хук инжектит общий контракт вместо повторения его в каждой сессии, statusline рисует бейдж, слэш-команды `/bear`, `/bear-doctor`, `/bear-stats`. Хук молча падает при любой ошибке и пишет symlink-safe — иначе ему нельзя доверять запуск сессии.

**[Evals](evals/README.md)** — трёхрукий прогон: `baseline` / `terse` / `skill`. Честная дельта считается против terse, а не против пустоты: половину эффекта любого скилла даёт обычная просьба отвечать кратко, и приписывать её скиллу нечестно. Токены берутся из `usage` ответа API — это замер, а не оценка.

Флаги: `--vault <path>` (или env `BEAR_VAULT`), `--claude-home <path>`, `--dry-run`, `--source <path>`, `--no-clone`.

## Документация

- **[Обзор всей документации](docs/README.md)**
- **[Установка](docs/installation/README.md)** — полная и точечная
- **[Решение проблем](docs/installation/troubleshooting.md)**
- **[Как править](CONTRIBUTING.md)** — правила репозитория, добавление скилла и домена
- **[Безопасность](SECURITY.md)** — что делают установщики и что скиллы делают с данными
- **[Изменения](CHANGELOG.md)**
- **Per-domain:** [obsidian](docs/domains/obsidian/), [git](docs/domains/git/README.md), [sre](docs/domains/sre/README.md), [content](docs/domains/content/README.md)

У каждого скилла есть свой `README.md` рядом с `SKILL.md` — что делает, когда срабатывает, где границы.

## Добавление нового домена

Один шаг:

1. Создай `domains/<new-name>/{manifest.yaml, rules/, skills/, agents/}`
2. В `manifest.yaml` укажи `name`, `description`, `requires_env`, `targets`; если что-то из домена требует внешний CLI — добавь `requires_bin`
3. `make check` — проверка фронтматтера

`requires_bin` бывает двух форм. Список на верхнем уровне — бинарь нужен всему домену, без него домен пропускается целиком. Ключ с вложенным списком компонентов — пропускаются только они:

```yaml
requires_bin:
  srekit:
    - skill:srekit-postmortem
    - skill:srekit-runbook
```

CLI подхватит новый домен автоматически.

## Лицензия

MIT — см. [`LICENSE`](LICENSE).
