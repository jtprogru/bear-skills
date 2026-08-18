# Агенты (`agents/`)

Специализированные оркестраторы. Каждый агент отвечает за одну вертикаль работы с базой знаний: анализирует запрос пользователя, выбирает подходящий скилл, оркестрирует пайплайн, отчитывается.

После установки агенты лежат в `~/.claude/agents/<name>.md` (конвенция Claude Code). Claude автоматически делегирует им задачи, когда запрос совпадает с триггерами из `description`-поля.

## Список агентов

| Агент | Вертикаль | Какие скиллы оркестрирует |
|-------|-----------|--------------------------|
| [`obsidian-inbox-triager`](obsidian-inbox-triager.md) | Разбор `00. Входящие/` | `obsidian-inbox-review`, `obsidian-refactor-inbox`, `obsidian-enrich-note` |
| [`obsidian-source-ingester`](obsidian-source-ingester.md) | Внешние источники → база | `obsidian-ingest`, `book-highlights-processor`, `obsidian-refactor-lecture` |
| [`obsidian-knowledge-cartographer`](obsidian-knowledge-cartographer.md) | Здоровье графа: MOC, hub, split | `obsidian-untangle-knot`, `obsidian-split-note` |
| [`obsidian-note-doctor`](obsidian-note-doctor.md) | Качество одной заметки | `obsidian-enrich-note`, `obsidian-note-critic` |
| [`obsidian-journal-keeper`](obsidian-journal-keeper.md) | Дневник | `obsidian-daily-append`, `obsidian-journal-review` |

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
  agent:obsidian-inbox-triager \
  skill:obsidian-inbox-review skill:obsidian-refactor-inbox skill:obsidian-enrich-note \
  rule:vault-struct rule:tags rule:note-types-frontmatter rule:content-style rule:workflows
```

Минимальные правила для каждого агента указаны на его docs-странице.

## Какой агент когда вызывается

Claude автоматически выбирает агента по триггерам в `description`. Подскажи ему явно, если хочешь:

```
Делегируй это obsidian-inbox-triager: разбери мой inbox.
Через obsidian-source-ingester: положи эту статью в базу.
Через obsidian-knowledge-cartographer: распутай [[DevOps]].
```

## См. также

- [Скиллы](../skills/README.md)
- [Правила](../rules/README.md)
- [Точечная установка](../../../installation/partial.md)
