# Skill: `knowledge-structures`

Справочник по структурам знаний хранилища: когда тема созрела до MOC, когда сравнение тянет на синтез, а когда вывод остаётся одной атомарной мыслью.

## Назначение

Отвечает на три вопроса, которые иначе решаются на глаз:

- **MOC (`#MapOfContent`)** — навигационная заметка по теме. Главная карта — `README.md` в корне, тематические лежат в `03. Ресурсы/07. Карты/`. Новая карта рождается в `00. Входящие/` с `#MapOfContent` + `#review` и переезжает в Карты после ревью.
- **Синтез (`#synthesis`)** — сравнение или кросс-анализ нескольких источников, а не пересказ одного.
- **Атомарная заметка** — одна мысль, которая опознаётся по имени вне контекста источника.

Плюс критерии «выделять / оставить в оригинале» для разделов большой заметки — их читают `obsidian-split-note` и `obsidian-refactor-lecture`, когда решают, что вынести.

## Триггеры

- «создай карту по теме»
- «нужен MOC»
- «сравни эти концепты»
- «раздроби конспект на атомарки»
- «это тянет на отдельную заметку?»

## Границы

Само ничего не создаёт. Это правило, на которое опираются другие скиллы. Раньше жило как `rules/knowledge-structures.md` — стало навыком, чтобы не занимать контекст в каждой сессии.

## Зависимости

**Правила:**

- [`vault-struct`](../rules/vault-struct.md) — где лежат карты
- [`file-naming`](../rules/file-naming.md) — именование MOC без префикса `Карта – `
- [`tags`](../rules/tags.md) — `#MapOfContent`, `#synthesis`, `#thought`
- [`note-types-frontmatter`](../rules/note-types-frontmatter.md) — поля `up`/`down`/`sources`

## Точечная установка

```bash
bear-skills install skill:knowledge-structures \
  rule:vault-struct rule:file-naming rule:tags rule:note-types-frontmatter
```

## Источник

[`domains/obsidian/skills/knowledge-structures/SKILL.md`](../../../../domains/obsidian/skills/knowledge-structures/SKILL.md)

## См. также

- [`obsidian-split-note`](obsidian-split-note.md) — применяет критерии выделения
- [`obsidian-untangle-knot`](obsidian-untangle-knot.md) — создаёт под-MOC по этим правилам
- [`obsidian-knowledge-cartographer`](../agents/obsidian-knowledge-cartographer.md) — агент-оркестратор
