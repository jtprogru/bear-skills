# Правило: `note-types-frontmatter`

Шаблоны заметок и поля frontmatter — формальная схема каждого типа.

## Что внутри

- **Каталог шаблонов** в `_Система/1. Шаблоны/`: проект, ежедневная, идея, концепт, литературная цитата, эссе, MOC, человек, конференция, лекция и др.
- **Стандартные поля frontmatter:** `aliases`, `tags`, `status`, `deadline`, `up`, `down`, `links`, `other`, `confidence`, `sources`
- **Правила frontmatter:** не удаляй существующие ключи, не изобретай новые, не очищай `sources`
- **Политика «литературные источники в up + sources»** — для каждого источника ссылка должна быть и в `up` (родитель темы), и в `sources` (атрибуция), синхронно
- **Уровни достоверности (`confidence`):** `high`, `medium`, `low` — определения и правила применения

## Кто применяет

Все скиллы, изменяющие frontmatter:

- `obsidian-refactor-inbox` — расставляет поля при типизации
- `obsidian-enrich-note` — точечно меняет `aliases`/`up`/`down`/`other`
- `obsidian-ingest`, `obsidian-split-note`, `obsidian-refactor-lecture` — создают новые заметки с правильным frontmatter
- `obsidian-note-critic` — оценивает `confidence` и `sources`

## Точечная установка

```bash
bear-skills install rule:note-types-frontmatter
```

## Связь с другими правилами

- [`template-usage`](template-usage.md) — когда какой шаблон применять
- [`tags`](tags.md) — поле `tags` в frontmatter

## См. также

- Исходник: [`rules/note-types-frontmatter.md`](../../rules/note-types-frontmatter.md)
- [Обзор правил](README.md)
