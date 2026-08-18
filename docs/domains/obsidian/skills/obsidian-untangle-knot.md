# Skill: `obsidian-untangle-knot`

Разгрузка hub-заметки в Obsidian — узла с десятками или сотнями входящих ссылок, который из «карты» превратился в свалку backlinks.

## Назначение

В графе есть hub-узлы (типа `[[DevOps]]`, `[[SRE]]`, `[[Linux]]`), на которые стихийно ссылаются десятки заметок-источников. В какой-то момент карта перестаёт быть полезной — открываешь и тонешь в шуме.

Скилл:

1. Находит/принимает hub и считает in/out
2. Опирается на **существующую структуру** hub (подзаголовки, явные категории)
3. Создаёт под-MOC под каждую категорию
4. **Перепривязывает входящие ссылки** из ресурсных заметок: переключает с общего MOC на подходящий под-MOC
5. Оригинальный hub **остаётся** как точка входа «не знаю точнее куда»

## Триггеры

- «распутай клубок»
- «разгрузи MOC X»
- «слишком много ссылок на X»
- «X разросся»
- «карта стала помойкой»
- «найди мои hub-заметки»
- «карта-помойка»

## Когда НЕ использовать

| Ситуация | Используй вместо |
|----------|-----------------|
| Большая заметка с несколькими темами | `obsidian-split-note` |
| Inbox-заметки разобрать | `obsidian-refactor-inbox` |
| Конспект лекции | `obsidian-refactor-lecture` |

## Зависимости

**Правила:**

- [`vault-struct`](../rules/vault-struct.md)
- [`note-types-frontmatter`](../rules/note-types-frontmatter.md)
- [`file-naming`](../rules/file-naming.md)
- [`tags`](../rules/tags.md)
- [`workflows`](../rules/workflows.md) — план → подтверждение → действие

**Навыки:**

- [`knowledge-structures`](knowledge-structures.md) — структура MOC и под-MOC
- [`note-templates`](note-templates.md) — заведение под-MOC через Templater
- [`vault-mermaid`](vault-mermaid.md) — если рисуешь схемы в новых MOC

## Точечная установка

```bash
bear-skills install skill:obsidian-untangle-knot \
  skill:knowledge-structures skill:note-templates skill:vault-mermaid \
  rule:vault-struct rule:note-types-frontmatter \
  rule:file-naming rule:tags rule:workflows
```

## Источник

[`domains/obsidian/skills/obsidian-untangle-knot/SKILL.md`](../../../../domains/obsidian/skills/obsidian-untangle-knot/SKILL.md)

## См. также

- [`obsidian-split-note`](obsidian-split-note.md) — разбивает текст, не связи
- [`obsidian-knowledge-cartographer`](../agents/obsidian-knowledge-cartographer.md)
