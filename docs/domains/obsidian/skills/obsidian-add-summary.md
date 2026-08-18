# Skill: `obsidian-add-summary`

Батч-заполнение поля `summary` в существующих заметках.

## Назначение

Проходит пачку из 10–20 заметок за сессию, показывает план и после подтверждения проставляет `summary` — одно-три предложения сути на русском, claim-стилем, plain text без wikilinks и markdown.

Поле работает как сигнал релевантности при семантическом поиске и как колонка в Bases-срезах: по нему видно, о чём заметка, не открывая её.

## Триггеры

- «добавь summary»
- «заполни summary»
- «проставь summary»
- «прогон по summary»
- проект «Обогащение базы знаний»

## Границы

Меняет только `summary`, тела заметок не трогает. Проектам вместо него ставится `description`. До-генерация в авторской заметке не помечает её как сгенерированную — `ai_generated` не появляется.

## Зависимости

**Правила:**

- [`note-types-frontmatter`](../rules/note-types-frontmatter.md) — политика `summary`, главнее самого скилла при расхождении
- [`content-style`](../rules/content-style.md) — язык и тон
- [`workflows`](../rules/workflows.md) — план → подтверждение → действие

## Точечная установка

```bash
bear-skills install skill:obsidian-add-summary \
  rule:note-types-frontmatter rule:content-style rule:workflows
```

## Источник

[`domains/obsidian/skills/obsidian-add-summary/SKILL.md`](../../../../domains/obsidian/skills/obsidian-add-summary/SKILL.md)

## См. также

- [`obsidian-enrich-note`](obsidian-enrich-note.md) — точечное обогащение связей одной заметки
- [`note-density`](../rules/note-density.md) — почему `summary` и тело не должны дублировать друг друга
