# Skill: `obsidian-daily-append`

Добавление новых записей в сегодняшнюю ежедневную заметку: мысль, событие, встреча, ссылка на атомарку, разбор-узел, TODO.

## Назначение

Ежедневная заметка имеет нетривиальную структуру — нельзя просто аппендить в конец. Скилл:

- определяет сегодняшнюю дату и путь к файлу: `<vault>/05. Дневник/YYYY/MM/YYYY-MM-DD.md`
- создаёт файл по шаблону `Ежедневная заметка.md`, если его нет
- классифицирует тип записи (мысль / событие / встреча / TODO / узел)
- задаёт 1–2 уточняющих вопроса для обогащения (связи, проект, эмоция, нужна ли атомарка)
- вставляет данные в правильный раздел (`### Мысли вслух`, `### Заметка дня`, `### Узел №N`, callout `> [!todo]` и т.п.)

## Триггеры

- «добавь в сегодняшнюю заметку»
- «запиши в дневник»
- «зафиксируй в today»
- «добавь в daily»
- «отметь в дневнике»

## Когда НЕ использовать

| Ситуация | Используй вместо |
|----------|-----------------|
| Нужна полноценная атомарная заметка с frontmatter | `obsidian-ingest` |
| Ревью недели/месяца | `obsidian-journal-review` |
| Запись касается прошедшего/будущего дня | вручную (скилл пишет только в сегодня) |
| Разобрать большую заметку | `obsidian-split-note` |

## Зависимости

**Правила:**

- [`vault-struct`](../rules/vault-struct.md) — папка `05. Дневник/`
- [`note-types-frontmatter`](../rules/note-types-frontmatter.md) — шаблон ежедневной
- [`tags`](../rules/tags.md) — `#journal/daily`
- [`template-usage`](../rules/template-usage.md)
- [`content-style`](../rules/content-style.md)

## Точечная установка

```bash
bear-skills install obsidian-daily-append \
  vault-struct note-types-frontmatter tags template-usage content-style
```

## Источник

[`skills/obsidian-daily-append/SKILL.md`](../../skills/obsidian-daily-append/SKILL.md)

## См. также

- [`obsidian-journal-review`](obsidian-journal-review.md) — обзоры периода
- [`journal-keeper`](../agents/journal-keeper.md) — агент-оркестратор
