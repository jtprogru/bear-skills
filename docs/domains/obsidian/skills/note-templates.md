# Skill: `note-templates`

Выбор шаблона Templater под ситуацию и рецепт его технического применения.

## Назначение

Держит таблицу «ситуация → шаблон» для `_Система/1. Шаблоны/` и разбирает пары, которые путают чаще всего:

- мысль против идеи против концепта
- тезисы по источнику против литературной заметки
- карта против топика

Отдельный раздел — вызов `obsidian templater:create-from-template` и его грабли: молчаливый дубль вместо перезаписи, невидимая свежесозданная папка, интерактивные шаблоны, которые через CLI не работают.

## Триггеры

- «заведи заметку по шаблону»
- «какой шаблон взять»
- «создай через Templater»

## Границы

Frontmatter по памяти не собирается — источник правды — файл шаблона в хранилище. Раньше жило как `rules/template-usage.md`.

## Зависимости

**Правила:**

- [`note-types-frontmatter`](../rules/note-types-frontmatter.md) — какие поля у какого типа заметки
- [`vault-struct`](../rules/vault-struct.md) — где лежат шаблоны и куда попадает результат
- [`tags`](../rules/tags.md) — структурный тег, который проставляет шаблон

## Точечная установка

```bash
bear-skills install skill:note-templates \
  rule:note-types-frontmatter rule:vault-struct rule:tags
```

## Источник

[`domains/obsidian/skills/note-templates/SKILL.md`](../../../../domains/obsidian/skills/note-templates/SKILL.md)

## См. также

- [`obsidian-ingest`](obsidian-ingest.md) — заводит литературные заметки и атомарки через шаблоны
- [`obsidian-journal-review`](obsidian-journal-review.md) — шаблоны недельного, месячного и годового обзора
- [`obsidian-daily-append`](obsidian-daily-append.md) — шаблон ежедневной
