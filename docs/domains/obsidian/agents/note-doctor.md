# Agent: `note-doctor`

Специализированный агент для работы с одной конкретной заметкой: обогащение frontmatter, критика, поиск противоречий, peer review.

## Назначение

Лечит одну заметку, не двигая её с места:

- проверяет frontmatter (`aliases`, `up`, `down`, `other`) и обогащает по необходимости
- ищет похожие и противоположные заметки в базе
- выявляет противоречия с конкретными цитатами
- критикует аргументацию, формулировки, полноту охвата

Тело заметки и теги не трогает массово. Тяжёлый рефакторинг — это `knowledge-cartographer` (split) или `inbox-triager` (перенос).

## Триггеры

- «обогати эту заметку»
- «дозаполни frontmatter»
- «добавь aliases»
- «покритикуй эту заметку»
- «что я упустил»
- «найди дыры»
- «peer review»
- «противоречит ли это другим заметкам»

## Что оркестрирует

| Сигнал | Скилл |
|--------|-------|
| Только обогатить frontmatter | `obsidian-enrich-note` |
| Только покритиковать | `obsidian-note-critic` |
| Оба | Сначала `obsidian-enrich-note`, потом `obsidian-note-critic` (критика по уже связанной заметке точнее) |

## Когда передаёт другому агенту

| Сигнал | Кому |
|--------|------|
| После критики стало ясно, что заметка должна быть разбита | `knowledge-cartographer` |
| Заметка должна быть в другой папке PARA | `inbox-triager` (если из inbox) |
| Критика нашла недостаток источников | `source-ingester` |

## Зависимости

**Скиллы:** `obsidian-enrich-note`, `obsidian-note-critic`

**Правила:** `content-style`, `note-types-frontmatter`, `vault-struct`, `workflows`, `tags`

## Точечная установка

```bash
bear-skills install \
  note-doctor \
  obsidian-enrich-note obsidian-note-critic \
  content-style note-types-frontmatter vault-struct workflows tags
```

## Источник

[`agents/note-doctor.md`](../../agents/note-doctor.md)

## См. также

- [Обзор агентов](README.md)
- [Точечная установка](../installation/partial.md)
