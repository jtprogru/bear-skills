# Правило: `note-types-frontmatter`

Поля frontmatter и политики по каждому из них — формальная схема заметки любого типа. Самое большое правило домена.

## Что внутри

**Каталог шаблонов** в `_Система/1. Шаблоны/` и таблица стандартных полей: `aliases`, `tags`, `status`, `created`, `deadline`, `up`, `down`, `links`, `other`, `confidence`, `sources`, `summary`, `description`, `category`, `contradicts`, `ai_generated`, `contribution`, `ask`, `next_step`.

Дальше — политики, каждая отвечает на вопрос «а как именно»:

- **Строковые значения всегда в двойных кавычках.** Незакавыченное `: ` ломает YAML и отображение всей заметки. Проверка — `ruby .agents/scripts/check_frontmatter.rb .`, ноль находок обязателен.
- **`summary` как сигнал сути для агентов** — 1–3 предложения claim-стилем, plain text без wikilinks. Проектам вместо него `description`.
- **Метаданные vs граф.** `created` — ISO-строка, ставит Templater, wikilink на дневник в ней запрещён: дневная заметка не должна становиться искусственным хабом графа. Поля `modified` не вводим.
- **Литературные источники в `up` + `sources`** — ссылка на источник идёт в оба поля синхронно. Исключение — навигационные MOC-индексы: они родители, но не источники.
- **`contradicts` как типизированное ребро графа** — двустороннее поле плюс callout `> [!warning]` в тексте. Не путать с `other` и с `confidence: low`.
- **`ai_generated` как маркер авторства** — `true` у заметок, созданных скиллом; отсутствие поля = написано автором. Через год отличить своё от сгенерированного иначе невозможно.
- **`sources` обязателен для `ai_generated`.** Заметка с `ai_generated: true` и пустым `sources` — дефект. Память модели источником не является.
- **`down` — навигация, не реестр потомков.** Смысловое перечисление детей в теле не дублируется в frontmatter, связь допустимо оставлять односторонней.
- **Карточка контакта** (`contribution` / `ask` / `next_step`) — три опциональных поля профилей людей, заполняются только при живом касании.
- **`category`** — «полка» источника, всегда wikilink на карту или топик.
- **Уровни достоверности (`confidence`):** `high`, `medium`, `low`.

Общее: сохраняй существующие ключи, не изобретай новые, не меняй формат значений, **`sources` никогда не очищай — только добавляй**.

## Кто применяет

Все скиллы, изменяющие frontmatter:

- `obsidian-refactor-inbox` — расставляет поля при типизации
- `obsidian-enrich-note` — точечно меняет `aliases`/`up`/`down`/`other`
- `obsidian-add-summary` — батч по `summary`; при расхождении со скиллом главнее это правило
- `obsidian-ingest`, `obsidian-split-note`, `obsidian-refactor-lecture` — создают заметки с правильным frontmatter
- `obsidian-note-critic` — оценивает `confidence` и `sources`

## Точечная установка

```bash
bear-skills install rule:note-types-frontmatter
```

## Связь с другими правилами

- [`tags`](tags.md) — поле `tags` в frontmatter
- [`note-density`](note-density.md) — `summary` содержит тезис целиком, тело его не повторяет
- Навык [`note-templates`](../skills/note-templates.md) — когда какой шаблон применять

## См. также

- Исходник: [`domains/obsidian/rules/note-types-frontmatter.md`](../../../../domains/obsidian/rules/note-types-frontmatter.md)
- [Обзор правил](README.md)
