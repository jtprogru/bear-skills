# bear-skills — документация

Пользовательская документация к мульти-доменной коллекции правил, скиллов и агентов для Claude Code. Сейчас в репозитории четыре домена: **Obsidian PKB**, **Git workflow**, **SRE/Kubernetes**, **Контент**.

Файлы в `domains/<name>/{rules,skills,agents}/` — это **исходники для AI-агентов**, не пользовательская документация. Эта документация описывает их человекочитаемо.

## Содержание

### Установка

- **[Обзор способов установки](installation/README.md)** — какие есть способы, что выбрать
- **[Полная установка](installation/full.md)** — поставить всё разом
- **[Точечная установка](installation/partial.md)** — поставить только нужные домены или компоненты
- **[Решение проблем](installation/troubleshooting.md)** — что делать, если что-то не работает

### Домены

- **[`obsidian`](domains/obsidian/)** — PKB на Obsidian по PARA (требует `BEAR_VAULT`)
- **[`git`](domains/git/README.md)** — Git workflow, релизы
- **[`sre`](domains/sre/README.md)** — SRE / Kubernetes
- **[`content`](domains/content/README.md)** — Telegram-посты, статьи, туториалы

## Архитектура

```
bear-skills/
└── domains/
    └── <domain-name>/
        ├── manifest.yaml     ← targets, requires_env
        ├── rules/            ← долговечные правила домена
        ├── skills/           ← атомарные операции
        └── agents/           ← оркестраторы
```

Зависимости только сверху вниз: агент → скилл → правило.

| Слой | Меняется | Что хранит |
|------|----------|-----------|
| **manifest** | Только при изменении модели развёртывания | Имя, requires_env, targets |
| **rules** | Редко, по явному запросу | Долгосрочные правила домена. Источник правды. |
| **skills** | Когда выявлен повторяющийся pattern | Атомарные операции. Один SKILL.md = одна операция. |
| **agents** | Когда нужна новая вертикаль | Оркестрация скиллов под определённую задачу. |

## Что разворачивается куда

После `bear-skills install`:

| Домен | rules | skills | agents |
|-------|-------|--------|--------|
| `obsidian` | `$BEAR_VAULT/.agents/rules/` | `~/.claude/skills/` | `~/.claude/agents/` |
| `git`, `sre`, `content` | `~/.claude/rules/` | `~/.claude/skills/` | `~/.claude/agents/` |

Цель развёртывания — симлинки: правишь в репо — изменения сразу видны в Claude Code.

Если у домена не выполнен `requires_env` (например, нет `BEAR_VAULT` для obsidian) — он скипается с предупреждением, остальные ставятся нормально.

## Источники vs документация

| Файл | Аудитория | Содержит |
|------|-----------|----------|
| `domains/<d>/manifest.yaml` | CLI | Конфигурация развёртывания |
| `domains/<d>/rules/<name>.md` | AI-агент | Само правило |
| `domains/<d>/skills/<name>/SKILL.md` | AI-агент | Системный промпт скилла |
| `domains/<d>/agents/<name>.md` | AI-агент | Системный промпт агента |
| `docs/domains/<d>/...` | Человек | Что это, кто применяет, как поставить |

## Быстрый старт

```bash
# Если нужен obsidian-домен:
export BEAR_VAULT="$HOME/Obsidian/MyVault"

# Поставить всё, что возможно с текущим окружением:
npx github:jtprogru/bear-skills install

# Проверить:
npx github:jtprogru/bear-skills status
```

Без `BEAR_VAULT` — поставятся `git`, `sre`, `content`. Obsidian скипнется с warning.

Подробнее: [installation/README.md](installation/README.md).

## Команды CLI

```
install     Развернуть все домены, у которых выполнены requires_env
            (или конкретные домены / компоненты, если переданы)
uninstall   Снять симлинки (все или точечно)
sync        uninstall + git pull + install
status      Что развёрнуто, по доменам
list        Дерево домен → компоненты
check       Валидация манифестов и фронтматтера
```

См. `bear-skills help` или [installation/partial.md](installation/partial.md) для примеров.

## Добавление нового домена

См. секцию «Добавление нового домена» в [AGENTS.md](../AGENTS.md).
