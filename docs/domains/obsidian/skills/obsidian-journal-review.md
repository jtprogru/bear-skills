# Skill: `obsidian-journal-review`

Ревью ежедневных заметок и формирование еженедельных, ежемесячных, ежегодных обзоров дневника.

## Назначение

Собирает ежедневные заметки за период, группирует по типам записей, выделяет повторяющиеся темы, эмоциональные пики, нерешённые узлы. Создаёт сводную заметку (`Еженедельная заметка.md` / `Ежемесячная заметка.md` / `Ежегодная заметка.md`).

Строки задач из ежедневных в сводку **не копируются**: для плагина Tasks копия — вторая задача. Незакрытое за неделю показывает `tasks`-блок «Разбор задач недели» из шаблона, правила — навык [`vault-tasks`](vault-tasks.md).

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
- [`content-style`](../rules/content-style.md)

**Навыки:**

- [`note-templates`](note-templates.md) — шаблоны еженедельной, ежемесячной и годовой
- [`vault-tasks`](vault-tasks.md) — почему строки задач не копируются в сводку

## Точечная установка

```bash
bear-skills install skill:obsidian-journal-review skill:note-templates \
  rule:vault-struct rule:tags rule:note-types-frontmatter rule:content-style
```

## Источник

[`domains/obsidian/skills/obsidian-journal-review/SKILL.md`](../../../../domains/obsidian/skills/obsidian-journal-review/SKILL.md)

## См. также

- [`obsidian-daily-append`](obsidian-daily-append.md)
- [`obsidian-journal-keeper`](../agents/obsidian-journal-keeper.md)
