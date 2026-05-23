# Правило: `content-style`

Стиль текста, язык, wikilinks, Markdown-форматирование в заметках.

## Что внутри

- **Стиль текста:** русский язык, личный тон, краткие формулировки, технические термины на английском
- **Что нельзя:** не переводить названия плагинов и команд, не превращать в Wikipedia, не использовать «вы»
- **Wikilinks:** правила использования `[[заметка]]`, алиасов `[[заметка\|текст]]`, frontmatter-полей `up`/`down`/`links`/`other`
- **Markdown:** ATX-заголовки, отступ списков 4 пробела, разрешённые жёсткие табуляции, отключённый лимит длины строки (соответствует `.markdownlint.yaml`)

## Кто применяет

Любой скилл, который пишет или правит текст заметок. Особенно важен для:

- `obsidian-ingest` — формирует литературные и атомарные заметки
- `obsidian-split-note`, `obsidian-refactor-lecture` — переформулируют контент
- `obsidian-note-critic` — оценивает текст
- `obsidian-daily-append` — пишет в дневник

## Точечная установка

```bash
bear-skills install rule:content-style
```

## Зависимость

`file-naming` опирается на это правило (язык имён файлов).

## См. также

- Исходник: [`rules/content-style.md`](../../rules/content-style.md)
- Связанные правила: [`file-naming`](file-naming.md), [`note-types-frontmatter`](note-types-frontmatter.md)
- [Обзор правил](README.md)
