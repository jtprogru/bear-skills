# Правило: `content-style`

Стиль текста, язык, wikilinks, Markdown-форматирование в заметках.

## Что внутри

- **Стиль текста:** русский язык, личный тон, краткие формулировки, технические термины на английском
- **Что нельзя:** не переводить названия плагинов и команд, не превращать в Wikipedia, не использовать «вы»
- **Wikilinks:** правила использования `[[заметка]]`, алиасов `[[заметка\|текст]]`, frontmatter-полей `up`/`down`/`links`/`other`
- **Markdown:** правила заданы в `.markdownlint.yaml` — правило отсылает к конфигу, а не пересказывает его по памяти
- **Mermaid:** единственное требование вне конфига — init-строка `useMaxWidth` в начале блока; подробности вынесены в навык [`vault-mermaid`](../skills/vault-mermaid.md)

## Кто применяет

Любой скилл, который пишет или правит текст заметок. Особенно важен для:

- `obsidian-ingest` — формирует литературные и атомарные заметки
- `obsidian-split-note`, `obsidian-refactor-lecture` — переформулируют контент
- `obsidian-note-critic` — оценивает текст
- `obsidian-daily-append`, `obsidian-emotion-log` — пишут в дневник

## Точечная установка

```bash
bear-skills install rule:content-style
```

## Зависимость

`file-naming` опирается на это правило (язык имён файлов).

## См. также

- Исходник: [`domains/obsidian/rules/content-style.md`](../../../../domains/obsidian/rules/content-style.md)
- Связанные правила: [`file-naming`](file-naming.md), [`note-types-frontmatter`](note-types-frontmatter.md)
- [Обзор правил](README.md)
