# Skill: `obsidian-refactor-lecture`

Рефакторинг конспекта лекции (учёба, курс): извлекает концепты, определения и теоремы в отдельные заметки, превращает оригинал в «оглавление» со ссылками, обновляет дисциплинарный MOC.

## Назначение

Большой конспект лекции в графе знаний работает плохо — на него никто не ссылается напрямую, концепты внутри не переиспользуются. Скилл превращает его в граф:

- оригинальная лекция → «оглавление» с краткими резюме и `[[wikilink]]` на каждый концепт
- извлечённые концепты → отдельные заметки с именами `<Дисциплина> – <Концепт>.md`
- дисциплинарный MOC обновляется ссылками на новые заметки

**Лимит:** не более **3 конспектов** за один запуск (тяжёлый процесс).

## Триггеры

- «обработай лекцию»
- «разбей конспект»
- «рефакторинг лекции»
- «вынеси понятия из лекции»
- «лекция слишком большая»

## Когда НЕ использовать

| Ситуация | Используй вместо |
|----------|-----------------|
| Обычная (не лекционная) большая заметка | `obsidian-split-note` |
| Внешняя статья / транскрипт | `obsidian-ingest` |

## Зависимости

**Правила:**

- [`vault-struct`](../rules/vault-struct.md)
- [`tags`](../rules/tags.md) — структурный тег `#lecture` и доменные
- [`note-types-frontmatter`](../rules/note-types-frontmatter.md)
- [`file-naming`](../rules/file-naming.md) — паттерн `<Дисциплина> – <Концепт>`
- [`workflows`](../rules/workflows.md)

**Навыки:**

- [`knowledge-structures`](knowledge-structures.md) — когда выделять раздел в отдельную заметку

## Точечная установка

```bash
bear-skills install skill:obsidian-refactor-lecture skill:knowledge-structures \
  rule:vault-struct rule:tags rule:note-types-frontmatter \
  rule:file-naming rule:workflows
```

## Источник

[`domains/obsidian/skills/obsidian-refactor-lecture/SKILL.md`](../../../../domains/obsidian/skills/obsidian-refactor-lecture/SKILL.md)

## См. также

- [`obsidian-split-note`](obsidian-split-note.md) — общий случай разбивки
- [`obsidian-source-ingester`](../agents/obsidian-source-ingester.md) — агент-оркестратор для всех видов источников
