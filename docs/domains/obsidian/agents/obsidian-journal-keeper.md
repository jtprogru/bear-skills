# Agent: `obsidian-journal-keeper`

Специализированный агент по дневнику: добавление записей в сегодняшнюю заметку и периодические обзоры (неделя/месяц/год).

## Назначение

Ведёт дневник как живой инструмент:

- быстро записывает в сегодняшнюю заметку (мысль, событие, встреча, TODO, узел)
- периодически делает сводные обзоры по периоду
- не создаёт атомарных заметок (это область других агентов), но **подсвечивает кандидатов** в обзорах

## Триггеры

- «добавь в сегодняшнюю заметку»
- «запиши в дневник»
- «зафиксируй в today»
- «отметь в дневнике»
- «weekly review»
- «обзор недели»
- «что было на этой неделе»
- «саммари месяца»

## Что оркестрирует

| Что нужно | Скилл |
|-----------|-------|
| Аппенд в сегодня | `obsidian-daily-append` |
| Обзор недели / месяца / года | `obsidian-journal-review` |

## Когда передаёт другому агенту

| Сигнал | Кому |
|--------|------|
| В дневнике родилась полноценная атомарная мысль | пользователь сам или `note-doctor` |
| Узел в дневнике превратился в обработку заметки | соответствующий специализированный агент |
| Пользователь хочет «положить в базу» статью из дневника | `source-ingester` |

## Зависимости

**Скиллы:** `obsidian-daily-append`, `obsidian-emotion-log`, `obsidian-journal-review`, `note-templates`

**Правила:** `vault-struct`, `note-types-frontmatter`, `tags`, `content-style`

## Точечная установка

```bash
bear-skills install \
  agent:obsidian-journal-keeper \
  skill:obsidian-daily-append skill:obsidian-emotion-log skill:obsidian-journal-review \
  skill:note-templates \
  rule:vault-struct rule:note-types-frontmatter rule:tags rule:content-style
```

## Источник

[`domains/obsidian/agents/obsidian-journal-keeper.md`](../../../../domains/obsidian/agents/obsidian-journal-keeper.md)

## См. также

- [Обзор агентов](README.md)
- [Точечная установка](../../../installation/partial.md)
