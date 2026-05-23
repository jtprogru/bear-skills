# Agent: `inbox-triager`

Специализированный агент по обработке inbox (`00. Входящие/`). Полный цикл триажа: осмотр → план → выполнение → отчёт.

## Назначение

Когда в inbox накопилось десятки заметок и нужно их разобрать, агент:

1. Осматривает все заметки (через `obsidian-inbox-review`)
2. Группирует по действию: обогатить frontmatter / полный рефакторинг / разбить / архивировать / передать другому агенту
3. Показывает план, дожидается подтверждения
4. Выполняет по порядку (обогащения → рефакторинги → разбивки → архивации)
5. Внешние источники, оказавшиеся в inbox, передаёт `source-ingester`

## Триггеры

- «разбери входящие»
- «прочисти inbox»
- «разложи #inbox/review»
- «обработай заметки из инбокса»

## Что оркестрирует

| Этап | Скилл |
|------|-------|
| Осмотр | `obsidian-inbox-review` |
| Обогащение frontmatter | `obsidian-enrich-note` |
| Полный рефакторинг | `obsidian-refactor-inbox` |
| Разбивка большой заметки | `obsidian-split-note` (опционально) |

## Когда передаёт другому агенту

| Сигнал | Кому |
|--------|------|
| Внешний источник (статья, видео, конспект) | `source-ingester` |
| Перегруженный hub-узел | `knowledge-cartographer` |
| Запрос покритиковать заметку | `note-doctor` |
| Запись касается сегодняшнего дня | `journal-keeper` |

## Зависимости

**Скиллы:** `obsidian-inbox-review`, `obsidian-refactor-inbox`, `obsidian-enrich-note`

**Правила:** `vault-struct`, `tags`, `note-types-frontmatter`, `workflows`, `content-style`

## Точечная установка

```bash
bear-skills install \
  inbox-triager \
  obsidian-inbox-review obsidian-refactor-inbox obsidian-enrich-note \
  vault-struct tags note-types-frontmatter content-style workflows
```

## Источник

[`agents/inbox-triager.md`](../../agents/inbox-triager.md)

## См. также

- [Обзор агентов](README.md)
- [Точечная установка](../installation/partial.md)
