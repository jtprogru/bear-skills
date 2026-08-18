# Agent: `obsidian-knowledge-cartographer`

Специализированный агент по здоровью графа знаний: MOC, hub-узлы, split больших заметок, навигация по PARA.

## Назначение

Поддерживает граф в работоспособном состоянии:

- разгружает перегруженные узлы (hub-заметки с десятками входящих)
- разбивает выросшие заметки на атомарки
- создаёт MOC, когда тема набирается до 5+ заметок
- создаёт синтез-заметки по сравнению нескольких концептов

Не создаёт новых заметок ради дробления — только когда есть содержательный повод.

## Триггеры

- «распутай клубок»
- «разгрузи MOC X»
- «X разросся»
- «карта стала помойкой»
- «разбей большую заметку»
- «создай карту по теме»
- «нужен MOC»
- «найди мои hub-заметки»

## Что оркестрирует

| Сигнал | Скилл / действие |
|--------|------------------|
| Перегруженный hub | `obsidian-untangle-knot` |
| Большая заметка с несколькими темами | `obsidian-split-note` |
| Лекция как частный случай | `obsidian-refactor-lecture` |
| Создать или обновить MOC | Вручную по навыку `knowledge-structures` |
| Синтез-заметка | Вручную по тому же навыку |

## Когда передаёт другому агенту

| Сигнал | Кому |
|--------|------|
| Источник проблемы — недавно пришедший материал | `source-ingester` сначала |
| После разгрузки нужно покритиковать получившиеся MOC | `note-doctor` |
| В hub-узле много заметок из inbox — сначала типизировать | `inbox-triager` |

## Зависимости

**Скиллы:** `obsidian-untangle-knot`, `obsidian-split-note`, `knowledge-structures`, `note-templates`, `vault-mermaid`, опционально `obsidian-refactor-lecture`

**Правила:** `vault-struct`, `note-types-frontmatter`, `file-naming`, `tags`, `workflows`

## Точечная установка

```bash
bear-skills install \
  agent:obsidian-knowledge-cartographer \
  skill:obsidian-untangle-knot skill:obsidian-split-note \
  skill:knowledge-structures skill:note-templates skill:vault-mermaid \
  rule:vault-struct rule:note-types-frontmatter rule:file-naming rule:tags rule:workflows
```

## Источник

[`domains/obsidian/agents/obsidian-knowledge-cartographer.md`](../../../../domains/obsidian/agents/obsidian-knowledge-cartographer.md)

## См. также

- [Обзор агентов](README.md)
- [Точечная установка](../../../installation/partial.md)
