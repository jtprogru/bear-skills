# Skill: `obsidian-split-note`

Разбивает одну большую заметку на несколько меньших (атомарных или тематических), сохраняя связность графа.

## Назначение

Когда заметка разрослась и содержит несколько самостоятельных тем:

- оригинал **остаётся**, его разделы заменяются на краткое описание + `[[wikilink]]`
- каждая новая заметка создаётся в правильной папке по PARA
- frontmatter оригинала и новых заметок согласованы (`up`/`down` проставлены)

## Триггеры

- «разбей заметку»
- «раздели заметку»
- «рефакторинг [[заметка]]»
- «заметка стала слишком большой»

## Когда НЕ использовать

| Ситуация | Используй вместо |
|----------|-----------------|
| Это конспект лекции (с дисциплинарным контекстом) | `obsidian-refactor-lecture` |
| Заметка перегружена ссылками (hub-узел) | `obsidian-untangle-knot` |
| Заметка ещё не в базе (inbox или внешний файл) | `obsidian-ingest` / `obsidian-refactor-inbox` |

## Зависимости

**Правила:**

- [`vault-struct`](../rules/vault-struct.md)
- [`tags`](../rules/tags.md) — структурные теги для маршрутизации
- [`note-types-frontmatter`](../rules/note-types-frontmatter.md)
- [`knowledge-structures`](../rules/knowledge-structures.md) — критерии «выделять / оставить»
- [`file-naming`](../rules/file-naming.md)
- [`workflows`](../rules/workflows.md)

## Точечная установка

```bash
bear-skills install obsidian-split-note \
  vault-struct tags note-types-frontmatter \
  knowledge-structures file-naming workflows
```

## Источник

[`skills/obsidian-split-note/SKILL.md`](../../skills/obsidian-split-note/SKILL.md)

## См. также

- [`obsidian-untangle-knot`](obsidian-untangle-knot.md) — разбивает **связи** (граф), не текст
- [`knowledge-cartographer`](../agents/knowledge-cartographer.md) — агент-оркестратор графа
