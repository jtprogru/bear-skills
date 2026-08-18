# Skill: `vault-mermaid`

Обязательная init-строка в mermaid-блоках заметок.

## Назначение

Каждая схема в заметке начинается со строки настройки:

```
%%{init: {"flowchart": {"useMaxWidth": true}}}%%
```

Без неё Obsidian рендерит диаграмму фиксированной ширины и обрезает её по краю заметки. Скилл описывает точный синтаксис, место строки внутри блока (всегда первая, до объявления типа диаграммы) и распространяется на все типы диаграмм, не только на flowchart.

## Триггеры

- «нарисуй схему в заметке»
- «добавь mermaid»
- правка существующего mermaid-блока

## Границы

Само схем не рисует. При правке существующих блоков без init-строки она дописывается. Раньше жило как `rules/mermaid.md`.

## Зависимости

**Правила:**

- [`content-style`](../rules/content-style.md) — общие правила Markdown-разметки заметок

## Точечная установка

```bash
bear-skills install skill:vault-mermaid rule:content-style
```

## Источник

[`domains/obsidian/skills/vault-mermaid/SKILL.md`](../../../../domains/obsidian/skills/vault-mermaid/SKILL.md)

## См. также

- [`obsidian-ingest`](obsidian-ingest.md) — если в источнике есть схемы
- [`obsidian-untangle-knot`](obsidian-untangle-knot.md) — схемы в новых MOC
