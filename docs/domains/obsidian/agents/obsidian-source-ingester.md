# Agent: `obsidian-source-ingester`

Специализированный агент по ингесту внешних источников: статья, книга, видео, доклад, транскрипт, конспект лекции, экспорт цитат.

## Назначение

Превращает один внешний источник в граф связанных заметок:

- литературная заметка-источник в `03. Ресурсы/03. Литературные заметки/`
- 3–8 атомарных заметок-инсайтов
- обновлённые существующие концепты со ссылкой на новый источник
- запись в `_Система/wiki-log.md`

Агент сам определяет тип источника и выбирает скилл.

## Триггеры

- «обработай статью»
- «положи книгу в базу»
- «выжми знания из видео»
- «обработай конспект лекции»
- «разбери цитаты из iBooks/Zotero»
- «ингест»

## Что оркестрирует

| Тип источника | Скилл |
|---------------|-------|
| Статья / вебклип / транскрипт / произвольный markdown | `obsidian-ingest` |
| Экспорт цитат из iBooks или Zotero (🎯) | `book-highlights-processor` → `obsidian-ingest` |
| Видео / доклад | `obsidian-ingest` (с соответствующим шаблоном) |
| Конспект лекции с учёбы | `obsidian-refactor-lecture` |
| Книга в свободной форме | `obsidian-ingest` |

## Когда передаёт другому агенту

| Сигнал | Кому |
|--------|------|
| Источник лежит в inbox среди других | `inbox-triager` → потом обратно |
| Ингест перегрузил MOC | `knowledge-cartographer` |
| Пользователь хочет покритиковать литературную заметку | `note-doctor` |

## Зависимости

**Скиллы:** `obsidian-ingest`, `book-highlights-processor`, `obsidian-refactor-lecture`, `knowledge-structures`, `note-templates`, `vault-mermaid`

**Правила:** `vault-struct`, `note-types-frontmatter`, `file-naming`, `content-style`, `tags`, `workflows`, `note-density`

## Точечная установка

```bash
bear-skills install \
  agent:obsidian-source-ingester \
  skill:obsidian-ingest skill:book-highlights-processor skill:obsidian-refactor-lecture \
  skill:knowledge-structures skill:note-templates skill:vault-mermaid \
  rule:vault-struct rule:note-types-frontmatter rule:file-naming \
  rule:content-style rule:tags rule:workflows rule:note-density
```

## Источник

[`domains/obsidian/agents/obsidian-source-ingester.md`](../../../../domains/obsidian/agents/obsidian-source-ingester.md)

## См. также

- [Обзор агентов](README.md)
- [Точечная установка](../../../installation/partial.md)
