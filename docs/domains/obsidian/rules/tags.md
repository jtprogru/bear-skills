# Правило: `tags`

Таксономия тегов хранилища. Стабильный набор, не плодится без необходимости.

## Что внутри

- **Основной набор:** `#project`, `#thought`, `#book`, `#inbox/review`, `#archive`, `#journal/daily` и т.п.
- **Структурные теги** — определяют папку PARA для заметки:
  - `#project` → `01. Проекты/`
  - `#thought` → `03. Ресурсы/04. Заметки/`
  - `#book` → `03. Ресурсы/01. Книги/`
  - `#moc` → `03. Ресурсы/07. Карты/`
  - и т.д.
- **Доменные теги:** `#sre`, `#kubernetes`, `#observability`, `#golang`, `#psychology`, `#economics` и т.д.
- **Статусы достоверности:** `#confidence/high`, `#confidence/low`
- **Правила:** теги — только в frontmatter (не инлайново), иерархия через `/` (`#journal/daily`)

## Кто применяет

Все скиллы, изменяющие frontmatter:

- `obsidian-refactor-inbox` — назначает структурный тег при типизации
- `obsidian-ingest` — расставляет доменные теги атомарным заметкам
- `obsidian-split-note`, `obsidian-refactor-lecture` — наследуют теги при выделении атомарок
- `obsidian-enrich-note` — **не трогает теги** (там только aliases/up/down/other)

## Точечная установка

```bash
bear-skills install rule:tags
```

## Связь с другими правилами

- [`vault-struct`](vault-struct.md) — структурные теги маршрутизируют по этим папкам
- [`note-types-frontmatter`](note-types-frontmatter.md) — поле `tags` входит в frontmatter

## См. также

- Исходник: [`rules/tags.md`](../../rules/tags.md)
- [Обзор правил](README.md)
