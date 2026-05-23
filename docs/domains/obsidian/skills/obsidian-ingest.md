# Skill: `obsidian-ingest`

Главный скилл ингеста: берёт один markdown-файл (статья, конспект, транскрипт, черновая заметка) и превращает его в граф связанных заметок в базе.

## Назначение

Из одного источника создаёт:

- **Литературную заметку-источник** в `03. Ресурсы/03. Литературные заметки/`
- **3–8 атомарных заметок-инсайтов** в `03. Ресурсы/04. Заметки/`
- **Обновляет существующие концепты**, на которые ссылается источник — добавляет в `sources` и расширяет
- **Расставляет wikilinks** в обе стороны (источник ↔ атомарки, атомарки ↔ существующие)
- **Обновляет MOC**, если тема туда вписывается
- **Логирует в `_Система/wiki-log.md`**

## Триггеры

- «добавь в базу знаний»
- «переработай эту статью»
- «обработай конспект»
- «выжми знания из текста»
- «ингестируй»
- «положи в vault»
- «положи в базу»

## Когда НЕ использовать

| Ситуация | Используй вместо |
|----------|-----------------|
| Экспорт цитат из iBooks/Zotero | `book-highlights-processor` (сначала), затем `obsidian-ingest` |
| Конспект лекции с учёбы | `obsidian-refactor-lecture` |
| Заметка уже в базе, нужно разбить | `obsidian-split-note` |

## Зависимости

**Правила:**

- [`vault-struct`](../rules/vault-struct.md) — куда что класть
- [`note-types-frontmatter`](../rules/note-types-frontmatter.md) — frontmatter каждого типа заметки
- [`knowledge-structures`](../rules/knowledge-structures.md) — атомарность, MOC, синтез
- [`file-naming`](../rules/file-naming.md) — claim-based имена
- [`content-style`](../rules/content-style.md) — стиль текста
- [`tags`](../rules/tags.md) — теги
- [`workflows`](../rules/workflows.md) — протокол план → подтверждение → действие
- [`mermaid`](../rules/mermaid.md) — если в источнике есть схемы

## Точечная установка

```bash
bear-skills install obsidian-ingest \
  vault-struct note-types-frontmatter knowledge-structures \
  file-naming content-style tags workflows mermaid
```

## Источник

[`skills/obsidian-ingest/SKILL.md`](../../skills/obsidian-ingest/SKILL.md)

## См. также

- [`book-highlights-processor`](book-highlights-processor.md) — пред-обработка цитат
- [`obsidian-refactor-lecture`](obsidian-refactor-lecture.md) — частный случай для лекций
- [`source-ingester`](../agents/source-ingester.md) — агент-оркестратор
