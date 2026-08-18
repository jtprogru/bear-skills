# Правило: `tags`

Таксономия тегов хранилища. Стабильный набор, не плодится без необходимости.

## Что внутри

- **Основной набор:** `#project`, `#thought`, `#book`, `#review`, `#archive`, `#journal/daily`, `#journal/weekly`, `#journal/monthly`, `#journal/yearly`
- **`#review`** обязателен на каждой заметке, которую агент создал в `00. Входящие/`; снимается при обработке инбокса
- **Структурные теги** — заявка на папку PARA, а не отчёт о ней. Новая заметка рождается во входящих, но структурный тег ставится сразу финальный: по нему `obsidian-refactor-inbox` поймёт, куда файл переносить.

| Тег | Целевая папка |
| ----- | --------------- |
| `#project` | `01. Проекты/` |
| `#person` | `02. Сферы/01. Люди/` |
| `#meeting`, `#incident`, `#hiring` | `02. Сферы/03. Работа/` |
| `#conference` | `02. Сферы/06. Конференции/` |
| `#book`, `#article`, `#video` | `03. Ресурсы/01. Книги/`, `02. Статьи/`, `05. Видео/` |
| `#literature-note` | `03. Ресурсы/03. Литературные заметки/` |
| `#thought`, `#concept`, `#document` | `03. Ресурсы/04. Заметки/` |
| `#MapOfContent`, `#synthesis` | `03. Ресурсы/07. Карты/` |
| `#lecture` + `#resource` | `02. Сферы/04. Образование/МТИ/Конспекты/` |

- **`#MapOfContent` пишется именно так, CamelCase.** Вариантов `#moc` и `#map-of-content` в хранилище нет — тег приходит из `Шаблон карты.md`, и по нему фильтрует Bases-вью «Обогащение базы знаний».
- **Один структурный тег на заметку.** Исключение — учебные конспекты, где `#lecture` и `#resource` идут в паре.
- **Доменные теги:** `#sre`, `#kubernetes`, `#observability`, `#golang`, `#psychology`, `#economics` и т.д.
- **Статусы достоверности:** `#confidence/high`, `#confidence/low`
- **Правила:** теги — только в frontmatter (не инлайново), иерархия через `/`

## Кто применяет

Все скиллы, изменяющие frontmatter:

- `obsidian-refactor-inbox` — назначает структурный тег при типизации, снимает `#review`
- `obsidian-ingest` — расставляет доменные теги атомарным заметкам
- `obsidian-split-note`, `obsidian-refactor-lecture` — наследуют теги при выделении атомарок
- `vault-archiving` — ставит `#archive` при переносе
- `obsidian-enrich-note` — **не трогает теги** (там только aliases/up/down/other)

## Точечная установка

```bash
bear-skills install rule:tags
```

## Связь с другими правилами

- [`vault-struct`](vault-struct.md) — структурные теги маршрутизируют по этим папкам
- [`note-types-frontmatter`](note-types-frontmatter.md) — поле `tags` входит в frontmatter
- [`file-naming`](file-naming.md) — именование MOC, помеченных `#MapOfContent`

## См. также

- Исходник: [`domains/obsidian/rules/tags.md`](../../../../domains/obsidian/rules/tags.md)
- Навык [`vault-archiving`](../skills/vault-archiving.md) — что означает `#archive` на практике
- [Обзор правил](README.md)
