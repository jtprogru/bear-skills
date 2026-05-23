# Правила (`rules/`)

Долговечная семантика базы знаний — структура хранилища, теги, шаблоны, frontmatter, стиль текста, именование файлов, рабочие процессы.

Правила — это **источник правды** для скиллов и агентов. Когда правило меняется, все скиллы и агенты автоматически начинают следовать новой версии (через симлинк).

После установки правила лежат в `$BEAR_VAULT/.agents/rules/`. Скиллы ссылаются на них как `.agents/rules/<file>.md`.

## Список

| Правило | О чём | Кто применяет |
|---------|-------|---------------|
| [`vault-struct`](vault-struct.md) | Структура папок PARA в хранилище | Все скиллы и агенты |
| [`content-style`](content-style.md) | Язык, тон, wikilinks, Markdown-форматирование | Все скиллы |
| [`file-naming`](file-naming.md) | Claim-based имена заметок, запрещённые символы | `obsidian-ingest`, `split-note`, `refactor-lecture`, `book-highlights-processor` |
| [`tags`](tags.md) | Таксономия тегов (структурные, доменные, статусные) | Все скиллы, изменяющие frontmatter |
| [`note-types-frontmatter`](note-types-frontmatter.md) | Шаблоны и поля frontmatter | Все скиллы |
| [`template-usage`](template-usage.md) | Когда какой шаблон применять | `obsidian-ingest`, `obsidian-daily-append` |
| [`knowledge-structures`](knowledge-structures.md) | MOC, синтез, атомарные заметки | `untangle-knot`, `split-note`, `refactor-lecture`, `ingest` |
| [`mermaid`](mermaid.md) | Init-строка для mermaid-схем | Любой скилл, генерирующий схемы |
| [`workflows`](workflows.md) | Протоколы и рабочие процессы (план → подтверждение → действие) | Все скиллы, делающие пачку изменений |

## Точечная установка только правил

Правила обычно ставятся вместе со скиллами, которые на них ссылаются. Если нужно поставить только правила:

```bash
bear-skills install --rules tags,workflows,file-naming
```

Или все правила:

```bash
bear-skills install --rules content-style,file-naming,knowledge-structures,mermaid,note-types-frontmatter,tags,template-usage,vault-struct,workflows
```

Проще — поставить вообще всё, потом не нужное удалить:

```bash
bear-skills install
bear-skills uninstall skill:obsidian-untangle-knot agent:knowledge-cartographer
```

## Связи между правилами

```
vault-struct ──── фундамент: куда что класть
    ▲
    ├── tags ─────────── как маршрутизировать по PARA через структурные теги
    ├── note-types-frontmatter ── какие поля frontmatter у заметок каждого типа
    │       ▲
    │       └── template-usage ── когда какой шаблон
    │
    ├── content-style ── язык, тон, wikilinks
    │       ▲
    │       └── file-naming ── claim-based имена
    │
    ├── knowledge-structures ── MOC, синтез, атомарность
    └── workflows ─── протоколы изменений

mermaid ─── отдельное узкое правило для схем
```

## См. также

- [Обзор скиллов](../skills/README.md) — кто на какие правила ссылается
- [Обзор агентов](../agents/README.md) — какие правила использует каждый агент
- [Точечная установка](../installation/partial.md)
