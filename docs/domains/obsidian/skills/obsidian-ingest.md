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
- [`file-naming`](../rules/file-naming.md) — claim-based имена
- [`content-style`](../rules/content-style.md) — стиль текста
- [`tags`](../rules/tags.md) — теги
- [`workflows`](../rules/workflows.md) — протокол план → подтверждение → действие
- [`note-density`](../rules/note-density.md) — тело атомарки в 300–800 знаков, без воды

**Навыки:**

- [`knowledge-structures`](knowledge-structures.md) — атомарность, MOC, синтез
- [`note-templates`](note-templates.md) — шаблон литературной цитаты, мысли, концепта
- [`vault-mermaid`](vault-mermaid.md) — если в источнике есть схемы

## Точечная установка

```bash
bear-skills install skill:obsidian-ingest \
  skill:knowledge-structures skill:note-templates skill:vault-mermaid \
  rule:vault-struct rule:note-types-frontmatter rule:file-naming \
  rule:content-style rule:tags rule:workflows rule:note-density
```

## Источник

[`domains/obsidian/skills/obsidian-ingest/SKILL.md`](../../../../domains/obsidian/skills/obsidian-ingest/SKILL.md)

## См. также

- [`book-highlights-processor`](book-highlights-processor.md) — пред-обработка цитат
- [`obsidian-refactor-lecture`](obsidian-refactor-lecture.md) — частный случай для лекций
- [`obsidian-source-ingester`](../agents/obsidian-source-ingester.md) — агент-оркестратор
