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

### Качество заметок

| Скилл | Что делает |
|-------|-----------|
| [`obsidian-note-critic`](obsidian-note-critic.md) | Peer review: похожие, противоположные, противоречия |

### Дневник

| Скилл | Что делает |
|-------|-----------|
| [`obsidian-daily-append`](obsidian-daily-append.md) | Добавление записи в сегодняшнюю ежедневную |
| [`obsidian-journal-review`](obsidian-journal-review.md) | Weekly / monthly / yearly review |

## Точечная установка

```bash
# Один скилл
bear-skills install obsidian-ingest

# С его правилами
bear-skills install obsidian-ingest vault-struct note-types-frontmatter knowledge-structures file-naming tags content-style workflows

# Несколько через флаг
bear-skills install --skills obsidian-ingest,obsidian-split-note,obsidian-note-critic
```

Зависимости каждого скилла — на его docs-странице в разделе «Зависимости».

## Сценарии — типовые наборы

- Только дневник → `obsidian-daily-append`, `obsidian-journal-review`
- Только источники → `obsidian-ingest`, `book-highlights-processor`, `obsidian-refactor-lecture`
- Только inbox → `obsidian-inbox-review`, `obsidian-refactor-inbox`, `obsidian-enrich-note`
- Только граф/MOC → `obsidian-split-note`, `obsidian-untangle-knot`
- Только критика → `obsidian-note-critic`, `obsidian-enrich-note`

Подробнее с правилами — [partial.md → Сценарии](../installation/partial.md#сценарии).

## Связь со скиллами через агентов

Каждый агент оркестрирует подмножество скиллов. Если хочешь сразу «коробочный» уровень — поставь агента, скиллы пойдут как зависимость, но не автоматически — добавь вручную:

```bash
bear-skills install inbox-triager \
  obsidian-inbox-review obsidian-refactor-inbox obsidian-enrich-note
```

Подробнее: [Обзор агентов](../agents/README.md).

## См. также

- [Правила](../rules/README.md)
- [Агенты](../agents/README.md)
- [Точечная установка](../installation/partial.md)
