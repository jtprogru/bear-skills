# Skill: `obsidian-journal-review`

Ревью ежедневных заметок и формирование еженедельных, ежемесячных, ежегодных обзоров дневника.

## Назначение

Собирает ежедневные заметки за период, группирует по типам записей, выделяет повторяющиеся темы, эмоциональные пики, нерешённые узлы, статус TODO. Создаёт сводную заметку (`Еженедельная заметка.md` / `Ежемесячная заметка.md` / `Ежегодная заметка.md`).

Атомарки-кандидаты на вынос **не создаются автоматически** — только подсвечиваются в обзоре, решение за пользователем.

## Триггеры

- «сделай еженедельный обзор»
- «weekly review»
- «разбери дневник»
- «что было на этой неделе»
- «саммари недели/месяца»
- «journal review»

## Когда НЕ использовать

| Ситуация | Используй вместо |
|----------|-----------------|
| Добавить запись в сегодня | `obsidian-daily-append` |
| Создать атомарку из мысли в дневнике | `obsidian-ingest` или вручную |

## Зависимости

**Правила:**

- [`vault-struct`](../rules/vault-struct.md) — `05. Дневник/`
- [`tags`](../rules/tags.md) — `#journal/weekly`, `#journal/monthly`
- [`note-types-frontmatter`](../rules/note-types-frontmatter.md)
- [`template-usage`](../rules/template-usage.md) — шаблоны еженедельной/ежемесячной/ежегодной
- [`content-style`](../rules/content-style.md)

## Точечная установка

```bash
bear-skills install obsidian-journal-review \
  vault-struct tags note-types-frontmatter template-usage content-style
```

## Источник

[`skills/obsidian-journal-review/SKILL.md`](../../skills/obsidian-journal-review/SKILL.md)

## См. также

- [`obsidian-daily-append`](obsidian-daily-append.md)
- [`journal-keeper`](../agents/journal-keeper.md)
