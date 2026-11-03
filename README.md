# bear-skills

Мульти-доменная коллекция правил, скиллов и агентов для Claude Code, Codex, Cursor и OpenCode. Личные инструменты для **Obsidian PKB**, **Git workflow**, **SRE/Kubernetes** и **контента**, упакованные в один npm-пакет.

📚 **Полная документация:** [`docs/`](docs/README.md)

## Быстрый старт

```bash
curl -fsSL https://raw.githubusercontent.com/jtprogru/bear-skills/main/install.sh | bash
```

Скрипт найдёт установленные AI-агенты (Claude Code, Codex, Cursor, opencode) и разложит по ним скиллы. После установки проверь загрузку компонентов и требования выбранного провайдера через `doctor`. Затем можно попросить агента «напиши постмортем» или «разбери входящие».

## Три способа установки

Выбери **один**. Два канала разом кладут файлы в одно место и дают дубли — установщик об этом предупредит.

| Способ | Кому | Команда |
|---|---|---|
| **Симлинки** | себе, если правишь скиллы | `npx github:jtprogru/bear-skills install` |
| **Плагин Claude Code** | если нужен только Claude Code | `claude plugin marketplace add jtprogru/bear-skills` |
| **Копии** | на чужую машину или другой агент | `curl … \| bash` (см. выше) |

Оба режима CLI доставляют полные пакеты скиллов. В symlink-режиме напрямую связываются только файлы без преобразований; generated-инструкции обновляются через `sync`. Копирующий entrypoint использует то же ядро и проверки владения.

```bash
# Если нужен obsidian-домен — сначала путь к хранилищу:
export BEAR_VAULT="$HOME/Obsidian/MyVault"

npx github:jtprogru/bear-skills install
```

Домены, у которых не выполнены требования, пропускаются с предупреждением, а не роняют установку.

Подробнее: [docs/installation/README.md](docs/installation/README.md).

## Провайдеры и домены

[Таблицы возможностей, состава и несовместимых компонентов](docs/providers.md) генерируются из каталога и адаптеров. [Фактические проверки](docs/compatibility.md) отделяют проверку файлов от live-загрузки инструментом.

```bash
bear-skills providers
bear-skills install git --provider codex --scope project --project ./app --mode copy
bear-skills install skill:git-conventional-commit --provider cursor --dry-run
bear-skills migrate --provider claude-code --source . --dry-run
```

Точечная установка включает зависимости. Отсутствие CLI/env или неподдерживаемое обязательное ограничение пропускает компонент и его потребителей с объяснением. Явный выбор недоступного компонента завершается ошибкой до записи.

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
├── skills/ agents/ rules/ commands/  # ← ЗЕРКАЛО, генерируется bin/mirror.js, не править
├── .claude-plugin/         # plugin.json + marketplace.json
├── bin/
│   ├── cli.js              # общее ядро установки + provider-адаптеры
│   ├── install.js          # совместимая copy-обёртка общего ядра
│   └── mirror.js           # генератор зеркала
├── tests/                  # node --test
├── docs/                   # Документация для человека → docs/README.md
├── AGENTS.md               # Точка входа для AI-агента
├── install.sh
├── LICENSE
├── package.json
└── Makefile
```

Правится только `domains/`. Каталоги `skills/`, `agents/`, `rules/`, `commands/` в корне генерируются из него для плагина и `npx skills add`; CI проверяет, что они не разошлись.

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
bear-skills uninstall       # удалить по описи, сохраняя ручные правки
bear-skills sync            # обновить принадлежащие установке файлы
bear-skills status          # целостность файлов; загрузка провайдером отдельно
bear-skills list            # дерево домен → компоненты
bear-skills check           # валидация манифестов и фронтматтера
bear-skills lock-check      # сверка локального skills-lock.json с чужими скиллами на диске
bear-skills doctor          # диагностика: битые симлинки, дубли, пересечения триггеров
bear-skills stats           # какие скиллы реально срабатывают (по логам сессий)
```

## Что ещё есть

**[Runtime](docs/runtime.md)** — адаптеры автоматически регистрируют native runtime: `SessionStart`-хук инжектит общий контракт вместо повторения его в каждой сессии, statusline рисует бейдж, слэш-команды `/bear`, `/bear-doctor`, `/bear-stats`. Общий контракт хранится в одном файле. Статус live-загрузки остаётся «не проверен» до отдельного запуска инструмента; installer не меняет trust.

**[Evals](evals/README.md)** — трёхрукий прогон: `baseline` / `terse` / `skill`. Честная дельта считается против terse, а не против пустоты: половину эффекта любого скилла даёт обычная просьба отвечать кратко, и приписывать её скиллу нечестно. Токены берутся из `usage` ответа API — это замер, а не оценка.

Флаги: `--provider <id>`, `--scope global|project`, `--project <path>`, `--mode copy|symlink`, `--overwrite`, `--home <path>`, `--json`, `--vault <path>` (или env `BEAR_VAULT`), `--claude-home <path>`, `--dry-run`, `--source <path>`, `--no-clone`.

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
