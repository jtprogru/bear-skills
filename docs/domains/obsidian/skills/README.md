# Скиллы (`skills/`)

Атомарные операции с заметками в Obsidian. Каждый скилл = одна задача с понятными триггерами и алгоритмом.

После установки скиллы лежат в `~/.claude/skills/<name>/SKILL.md` (конвенция Claude Code). Claude видит их автоматически после перезапуска и применяет, когда пользовательский запрос совпадает с триггерами из `description`-поля скилла.

## Список скиллов

### Inbox

| Скилл | Что делает |
|-------|-----------|
| [`obsidian-inbox-review`](obsidian-inbox-review.md) | Только осмотр inbox, без изменений |
| [`obsidian-refactor-inbox`](obsidian-refactor-inbox.md) | Полный цикл: типизация → frontmatter → связи → PARA |
| [`obsidian-enrich-note`](obsidian-enrich-note.md) | Точечное обогащение frontmatter (aliases, up, down, other) |
| [`obsidian-add-summary`](obsidian-add-summary.md) | Батч-заполнение `summary` в существующих заметках |

### Внешние источники

| Скилл | Что делает |
|-------|-----------|
| [`obsidian-ingest`](obsidian-ingest.md) | Внешний markdown → литературная заметка + атомарки |
| [`book-highlights-processor`](book-highlights-processor.md) | Экспорт цитат из iBooks/Zotero → Obsidian callouts |
| [`obsidian-refactor-lecture`](obsidian-refactor-lecture.md) | Конспект лекции → оглавление + извлечённые концепты |

### Структура графа

| Скилл | Что делает |
|-------|-----------|
| [`obsidian-split-note`](obsidian-split-note.md) | Большая заметка → атомарки + ссылки в оригинале |
| [`obsidian-untangle-knot`](obsidian-untangle-knot.md) | Hub-узел с десятками входящих → под-MOC и перепривязка |
| [`knowledge-structures`](knowledge-structures.md) | Когда MOC, когда синтез, когда атомарка; критерии выделения |

### Качество заметок

| Скилл | Что делает |
|-------|-----------|
| [`obsidian-note-critic`](obsidian-note-critic.md) | Peer review: похожие, противоположные, противоречия |
| [`vault-stats`](vault-stats.md) | Статистика хранилища и поиск мёртвых заметок |

### Дневник

| Скилл | Что делает |
|-------|-----------|
| [`obsidian-daily-append`](obsidian-daily-append.md) | Добавление записи в сегодняшнюю ежедневную |
| [`obsidian-emotion-log`](obsidian-emotion-log.md) | Фиксация одной эмоции в разделе `### Эмоции` |
| [`obsidian-journal-review`](obsidian-journal-review.md) | Weekly / monthly / yearly review |

### Механика хранилища

Справочные навыки — сами ничего не создают, их читают другие скиллы и ручные правки.

| Скилл | Что делает |
|-------|-----------|
| [`note-templates`](note-templates.md) | Выбор шаблона Templater и рецепт его вызова |
| [`vault-archiving`](vault-archiving.md) | Перенос в `04. Архив/`: плоско, без удаления |
| [`vault-mermaid`](vault-mermaid.md) | Init-строка `useMaxWidth` в mermaid-блоках |

## Точечная установка

```bash
# Один скилл
bear-skills install skill:obsidian-ingest

# С его зависимостями
bear-skills install skill:obsidian-ingest \
  rule:vault-struct rule:note-types-frontmatter rule:file-naming \
  rule:content-style rule:tags rule:workflows rule:note-density \
  skill:knowledge-structures skill:note-templates skill:vault-mermaid

# Несколько скиллов
bear-skills install skill:obsidian-ingest skill:obsidian-split-note skill:obsidian-note-critic
```

Зависимости каждого скилла — на его docs-странице в разделе «Зависимости».

## Сценарии — типовые наборы

- Только дневник → `obsidian-daily-append`, `obsidian-emotion-log`, `obsidian-journal-review`, `note-templates`
- Только источники → `obsidian-ingest`, `book-highlights-processor`, `obsidian-refactor-lecture`, `knowledge-structures`
- Только inbox → `obsidian-inbox-review`, `obsidian-refactor-inbox`, `obsidian-enrich-note`, `vault-archiving`
- Только граф/MOC → `obsidian-split-note`, `obsidian-untangle-knot`, `knowledge-structures`
- Только критика → `obsidian-note-critic`, `obsidian-enrich-note`, `vault-stats`

Подробнее с правилами — [partial.md → Сценарии](../../../installation/partial.md#сценарии).

## Связь со скиллами через агентов

Каждый агент оркестрирует подмножество скиллов. Если хочешь сразу «коробочный» уровень — поставь агента, но скиллы он за собой не тянет, добавь вручную:

```bash
bear-skills install agent:obsidian-inbox-triager \
  skill:obsidian-inbox-review skill:obsidian-refactor-inbox skill:obsidian-enrich-note
```

Подробнее: [Обзор агентов](../agents/README.md).

## См. также

- [Правила](../rules/README.md)
- [Агенты](../agents/README.md)
- [Точечная установка](../../../installation/partial.md)
