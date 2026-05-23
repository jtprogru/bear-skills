# Skill: `obsidian-enrich-note`

Точечное обогащение frontmatter одной заметки **без перемещения и без изменения тегов**. Меняются только: `aliases`, `up`, `down`, `other`.

## Назначение

Когда заметка уже на своём месте, но её frontmatter недозаполнен — добавить aliases (синонимы для поиска), связи `up` (родительские), `down` (дочерние), `other` (горизонтальные). Тело заметки, теги, `links`, `sources` — не трогает.

## Триггеры

- «обогати эту заметку»
- «дозаполни frontmatter»
- «добавь aliases»
- «добавь связи к этой заметке»
- «обогати [[заметка]]»

## Когда НЕ использовать

| Ситуация | Используй вместо |
|----------|-----------------|
| Нужно сменить теги и/или переместить | `obsidian-refactor-inbox` |
| Сначала понять, что в inbox | `obsidian-inbox-review` |
| Заметку нужно разбить | `obsidian-split-note` |
| Покритиковать содержание | `obsidian-note-critic` |

## Зависимости

**Правила:**

- [`content-style`](../rules/content-style.md) — семантика `up`/`down`/`links`/`other`
- [`vault-struct`](../rules/vault-struct.md) — структура хранилища (для поиска родителей/детей)
- [`note-types-frontmatter`](../rules/note-types-frontmatter.md) — какие поля есть в frontmatter

## Точечная установка

```bash
bear-skills install obsidian-enrich-note content-style vault-struct note-types-frontmatter
```

## Источник

[`skills/obsidian-enrich-note/SKILL.md`](../../skills/obsidian-enrich-note/SKILL.md)

## См. также

- [`note-doctor`](../agents/note-doctor.md) — оркестратор для работы с одной заметкой
- [`obsidian-refactor-inbox`](obsidian-refactor-inbox.md) — если нужно ещё и переместить
