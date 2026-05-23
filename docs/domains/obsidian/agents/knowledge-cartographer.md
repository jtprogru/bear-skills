# Agent: `knowledge-cartographer`

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
| Создать или обновить MOC | Вручную по `rules/knowledge-structures.md` |
| Синтез-заметка | Вручную по тому же правилу |

## Когда передаёт другому агенту

| Сигнал | Кому |
|--------|------|
| Источник проблемы — недавно пришедший материал | `source-ingester` сначала |
| После разгрузки нужно покритиковать получившиеся MOC | `note-doctor` |
| В hub-узле много заметок из inbox — сначала типизировать | `inbox-triager` |

## Зависимости

**Скиллы:** `obsidian-untangle-knot`, `obsidian-split-note`, опционально `obsidian-refactor-lecture`

**Правила:** `vault-struct`, `knowledge-structures`, `note-types-frontmatter`, `file-naming`, `tags`, `workflows`, `mermaid`

## Точечная установка

```bash
bear-skills install \
  knowledge-cartographer \
  obsidian-untangle-knot obsidian-split-note \
  vault-struct knowledge-structures note-types-frontmatter \
  file-naming tags workflows mermaid
```

## Источник

[`agents/knowledge-cartographer.md`](../../agents/knowledge-cartographer.md)

## См. также

- [Обзор агентов](README.md)
- [Точечная установка](../installation/partial.md)
