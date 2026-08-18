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
- [`file-naming`](../rules/file-naming.md)
- [`workflows`](../rules/workflows.md)
- [`note-density`](../rules/note-density.md) — плотность выделяемых атомарок

**Навыки:**

- [`knowledge-structures`](knowledge-structures.md) — критерии «выделять / оставить»
- [`note-templates`](note-templates.md) — заведение файла через Templater

## Точечная установка

```bash
bear-skills install skill:obsidian-split-note \
  skill:knowledge-structures skill:note-templates \
  rule:vault-struct rule:tags rule:note-types-frontmatter \
  rule:file-naming rule:workflows rule:note-density
```

## Источник

[`domains/obsidian/skills/obsidian-split-note/SKILL.md`](../../../../domains/obsidian/skills/obsidian-split-note/SKILL.md)

## См. также

- [`obsidian-untangle-knot`](obsidian-untangle-knot.md) — разбивает **связи** (граф), не текст
- [`obsidian-knowledge-cartographer`](../agents/obsidian-knowledge-cartographer.md) — агент-оркестратор графа
