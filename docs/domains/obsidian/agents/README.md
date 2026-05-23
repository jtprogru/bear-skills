# Агенты (`agents/`)

Специализированные оркестраторы. Каждый агент отвечает за одну вертикаль работы с базой знаний: анализирует запрос пользователя, выбирает подходящий скилл, оркестрирует пайплайн, отчитывается.

После установки агенты лежат в `~/.claude/agents/<name>.md` (конвенция Claude Code). Claude автоматически делегирует им задачи, когда запрос совпадает с триггерами из `description`-поля.

## Список агентов

| Агент | Вертикаль | Какие скиллы оркестрирует |
|-------|-----------|--------------------------|
| [`inbox-triager`](inbox-triager.md) | Разбор `00. Входящие/` | `obsidian-inbox-review`, `obsidian-refactor-inbox`, `obsidian-enrich-note` |
| [`source-ingester`](source-ingester.md) | Внешние источники → база | `obsidian-ingest`, `book-highlights-processor`, `obsidian-refactor-lecture` |
| [`knowledge-cartographer`](knowledge-cartographer.md) | Здоровье графа: MOC, hub, split | `obsidian-untangle-knot`, `obsidian-split-note` |
| [`note-doctor`](note-doctor.md) | Качество одной заметки | `obsidian-enrich-note`, `obsidian-note-critic` |
| [`journal-keeper`](journal-keeper.md) | Дневник | `obsidian-daily-append`, `obsidian-journal-review` |

## Зачем агенты, если есть скиллы

Скиллы — атомарные операции с понятным входом-выходом. Агенты — это «персонажи», которые:

- понимают расплывчатый запрос пользователя («разбери входящие», «положи в базу»)
- выбирают, какой скилл (или несколько подряд) применить
- хранят протокол работы: план → подтверждение → действие → отчёт
- умеют передавать задачу другому агенту, если она вышла за их вертикаль

Если ты явно знаешь, какой скилл нужен — Claude применит его напрямую. Если нет — попадёшь в агента, и он сам разрулит.

## Точечная установка

Агент без скиллов, которые он оркестрирует, бесполезен. CLI не разрешает зависимости автоматически — указывай явно.

```bash
# Только триаж inbox: агент + все его скиллы + правила
bear-skills install \
  inbox-triager \
  obsidian-inbox-review obsidian-refactor-inbox obsidian-enrich-note \
  vault-struct tags note-types-frontmatter content-style workflows
```

Минимальные правила для каждого агента указаны на его docs-странице.

## Какой агент когда вызывается

Claude автоматически выбирает агента по триггерам в `description`. Подскажи ему явно, если хочешь:

```
Делегируй это inbox-triager: разбери мой inbox.
Через source-ingester: положи эту статью в базу.
Через knowledge-cartographer: распутай [[DevOps]].
```

## См. также

- [Скиллы](../skills/README.md)
- [Правила](../rules/README.md)
- [Точечная установка](../installation/partial.md)
