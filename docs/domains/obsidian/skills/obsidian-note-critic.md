# Skill: `obsidian-note-critic`

Критический анализ одной заметки в Obsidian: гибридный поиск похожих и противоположных тем в базе, выявление противоречий, аргументированная критика логики и полноты охвата.

## Назначение

Peer review одной заметки по четырём осям:

1. **Похожие знания** — что уже есть в базе по этой теме (через hybrid-search)
2. **Противоположные взгляды** — альтернативные подходы, конкурирующие идеи
3. **Противоречия** — где заметка расходится с существующими знаниями (с конкретными цитатами)
4. **Аргументированная критика** — слабые места в аргументации, формулировках, полноте охвата

Результат — либо callout `> [!warning]` / `> [!question]` прямо в заметке (для ≤ 3 точек), либо отдельная ревью-заметка (для серьёзных проблем).

## Триггеры

- «покритикуй эту заметку»
- «разбери [[заметка]]»
- «найди противоречия»
- «проверь аргументацию»
- «peer review»
- «что я упустил»
- «найди дыры»
- «что не так»

## Когда НЕ использовать

| Ситуация | Используй вместо |
|----------|-----------------|
| Только обогатить frontmatter | `obsidian-enrich-note` |
| Заметка должна быть разбита | `obsidian-split-note` |
| Заметка перегружена ссылками | `obsidian-untangle-knot` |

## Требование

Для гибридного поиска используется MCP-сервер `mcp__obsidian-hybrid-search`. Если его нет — скилл всё равно даст критику, но без поиска похожих.

## Зависимости

**Правила:**

- [`content-style`](../rules/content-style.md) — оценка стиля
- [`note-types-frontmatter`](../rules/note-types-frontmatter.md) — оценка `confidence` и `sources`
- [`vault-struct`](../rules/vault-struct.md)
- [`workflows`](../rules/workflows.md)
- [`tags`](../rules/tags.md)

## Точечная установка

```bash
bear-skills install skill:obsidian-note-critic \
  rule:content-style rule:note-types-frontmatter rule:vault-struct rule:workflows rule:tags
```

## Источник

[`domains/obsidian/skills/obsidian-note-critic/SKILL.md`](../../../../domains/obsidian/skills/obsidian-note-critic/SKILL.md)

## См. также

- [`obsidian-enrich-note`](obsidian-enrich-note.md) — точечное обогащение frontmatter
- [`obsidian-note-doctor`](../agents/obsidian-note-doctor.md) — агент, оркестрирующий enrich + critic
