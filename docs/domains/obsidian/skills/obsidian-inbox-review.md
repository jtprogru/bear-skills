# Skill: `obsidian-inbox-review`

Только осмотр и отчёт по заметкам в `00. Входящие/`. **Файлы не меняются.** Результат — структурированный список с рекомендациями.

## Назначение

Понять, что лежит в inbox, без преждевременных действий. Скилл сканирует все заметки в `00. Входящие/`, классифицирует каждую (атомарная мысль, ресурс, человек, проект, конспект) и предлагает действие: переместить, обогатить, разбить, заархивировать.

## Триггеры

- «разбери входящие» (для осмотра — не для действия)
- «inbox review»
- «что у меня в инбоксе»
- «помоги с #inbox/review»
- «сделай ревью заметок»

## Когда НЕ использовать

| Ситуация | Используй вместо |
|----------|-----------------|
| Нужно реально обработать (переместить, тегировать) | `obsidian-refactor-inbox` |
| Нужно только обогатить frontmatter одной заметки | `obsidian-enrich-note` |

## Зависимости

**Правила:**

- [`vault-struct`](../rules/vault-struct.md) — где находится inbox
- [`tags`](../rules/tags.md) — таксономия для классификации
- [`note-types-frontmatter`](../rules/note-types-frontmatter.md) — какие типы заметок различает

## Точечная установка

```bash
bear-skills install obsidian-inbox-review vault-struct tags note-types-frontmatter
```

## Источник

[`skills/obsidian-inbox-review/SKILL.md`](../../skills/obsidian-inbox-review/SKILL.md)

## См. также

- [`obsidian-refactor-inbox`](obsidian-refactor-inbox.md) — следующий шаг после ревью
- [`inbox-triager`](../agents/inbox-triager.md) — агент, оркестрирующий весь inbox-пайплайн
