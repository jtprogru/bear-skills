# Skill: `obsidian-refactor-inbox`

Полный цикл обработки заметки из `00. Входящие/`: типизация → frontmatter → связи → перемещение в правильную папку PARA.

## Назначение

Превращает сырую inbox-заметку в полноценный артефакт базы знаний: определяет тип (мысль/ресурс/человек/проект/конспект), добавляет соответствующие теги и aliases, расставляет wikilinks на людей и MOC, перемещает в нужную папку. Заметки **никогда не удаляются** — максимум архивируются с тегом `#archive`.

## Триггеры

- «обработай входящие»
- «разбери заметки из inbox»
- «обработай папку 00. Входящие»
- «прочистите inbox»
- «перенеси из inbox в нужные папки»

## Когда НЕ использовать

| Ситуация | Используй вместо |
|----------|-----------------|
| Только посмотреть, что в inbox | `obsidian-inbox-review` |
| Только обогатить frontmatter (без перемещения) | `obsidian-enrich-note` |
| Заметка большая, нужно разбить | `obsidian-split-note` |

## Зависимости

**Правила:**

- [`vault-struct`](../rules/vault-struct.md) — куда перемещать
- [`tags`](../rules/tags.md) — структурные теги маршрутизируют по PARA
- [`note-types-frontmatter`](../rules/note-types-frontmatter.md) — поля frontmatter
- [`content-style`](../rules/content-style.md) — стиль текста
- [`workflows`](../rules/workflows.md) — протокол план → подтверждение → действие

## Точечная установка

```bash
bear-skills install skill:obsidian-refactor-inbox rule:vault-struct rule:tags rule:note-types-frontmatter rule:content-style rule:workflows
```

## Источник

[`domains/obsidian/skills/obsidian-refactor-inbox/SKILL.md`](../../../../domains/obsidian/skills/obsidian-refactor-inbox/SKILL.md)

## См. также

- [`obsidian-inbox-review`](obsidian-inbox-review.md) — предварительный осмотр
- [`obsidian-enrich-note`](obsidian-enrich-note.md) — точечное обогащение
- [`obsidian-inbox-triager`](../agents/obsidian-inbox-triager.md)
