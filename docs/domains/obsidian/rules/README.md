# Правила (`rules/`)

Долговечная семантика базы знаний — структура хранилища, теги, frontmatter, стиль текста, именование файлов, плотность заметок, рабочие процессы.

Правила — это **источник правды** для скиллов и агентов. Когда правило меняется, все скиллы и агенты автоматически начинают следовать новой версии (через симлинк).

После установки правила лежат в `$BEAR_VAULT/.agents/rules/`. Скиллы ссылаются на них как `.agents/rules/<file>.md`.

## Список

| Правило | О чём | Кто применяет |
|---------|-------|---------------|
| [`vault-struct`](vault-struct.md) | Структура папок PARA в хранилище | Все скиллы и агенты |
| [`content-style`](content-style.md) | Язык, тон, wikilinks, Markdown-форматирование | Все скиллы |
| [`file-naming`](file-naming.md) | Claim-based имена, запрещённые символы и кавычки, именование MOC | `obsidian-ingest`, `obsidian-split-note`, `book-highlights-processor` |
| [`tags`](tags.md) | Таксономия тегов (структурные, доменные, статусные) | Все скиллы, изменяющие frontmatter |
| [`note-types-frontmatter`](note-types-frontmatter.md) | Поля frontmatter и политики по каждому из них | Все скиллы |
| [`note-density`](note-density.md) | Плотность заметки, которую пишет агент | Скиллы, создающие тела заметок |
| [`workflows`](workflows.md) | Протоколы и рабочие процессы (план → подтверждение → действие) | Все скиллы, делающие пачку изменений |

## Что стало навыками

Три правила уехали из `rules/` в скиллы — они нужны не в каждой сессии, а по конкретному поводу, и занимать ими контекст постоянно незачем:

| Было | Стало |
|------|-------|
| `rules/knowledge-structures.md` | навык [`knowledge-structures`](../skills/knowledge-structures.md) — MOC, синтезы, атомарки |
| `rules/template-usage.md` | навык [`note-templates`](../skills/note-templates.md) — выбор и вызов шаблона Templater |
| `rules/mermaid.md` | навык [`vault-mermaid`](../skills/vault-mermaid.md) — init-строка mermaid-блоков |

Правило `vault-archiving` в `rules/` никогда не жило, но по смыслу стоит рядом — это навык [`vault-archiving`](../skills/vault-archiving.md).

## Точечная установка только правил

Правила обычно ставятся вместе со скиллами, которые на них ссылаются. Если нужно поставить только часть:

```bash
bear-skills install rule:tags rule:workflows rule:file-naming
```

Или все правила домена:

```bash
bear-skills install rule:content-style rule:file-naming rule:note-density \
  rule:note-types-frontmatter rule:tags rule:vault-struct rule:workflows
```

Проще — поставить домен целиком, потом не нужное удалить:

```bash
bear-skills install obsidian
bear-skills uninstall skill:obsidian-untangle-knot agent:obsidian-knowledge-cartographer
```

## Связи между правилами

```
vault-struct ──── фундамент: куда что класть
    ▲
    ├── tags ─────────── как маршрутизировать по PARA через структурные теги
    ├── note-types-frontmatter ── какие поля frontmatter у заметок каждого типа
    │       ▲
    │       └── note-density ── сколько текста в заметке, которую пишет агент
    │
    ├── content-style ── язык, тон, wikilinks
    │       ▲
    │       └── file-naming ── claim-based имена
    │
    └── workflows ─── протоколы изменений
```

## См. также

- [Обзор скиллов](../skills/README.md) — кто на какие правила ссылается
- [Обзор агентов](../agents/README.md) — какие правила использует каждый агент
- [Точечная установка](../../../installation/partial.md)
