# Skill: `obsidian-emotion-log`

Мгновенная фиксация одной эмоции в сегодняшней ежедневной заметке — пять секунд от «накрыло» до записи.

## Назначение

Дописывает callout в раздел `### Эмоции` дневной заметки: сама эмоция, интенсивность по шкале 1–10 и триггер. Проставляет связи на карту эмоций и на профили людей, если состояние привязано к разговору или встрече. Заметка дня создаётся, если её ещё нет.

## Триггеры

- «зафиксируй эмоцию»
- прямые описания состояния: «мне тревожно», «бесит», «накрыло»

## Когда НЕ использовать

| Ситуация | Используй вместо |
|----------|-----------------|
| Развёрнутая рефлексия | `obsidian-ingest` |
| Обзор состояния за период | `obsidian-journal-review` |
| Чужая эмоция | вручную в профиль человека |

Если запись перерастает в рефлексию — скилл заканчивает короткую и предлагает отдельную заметку.

## Границы

Одна запись за вызов, без интерпретаций и советов.

## Зависимости

**Правила:**

- [`vault-struct`](../rules/vault-struct.md) — где лежит `05. Дневник/`
- [`note-types-frontmatter`](../rules/note-types-frontmatter.md) — frontmatter ежедневной
- [`tags`](../rules/tags.md) — `#journal/daily`
- [`content-style`](../rules/content-style.md) — тон записи

## Точечная установка

```bash
bear-skills install skill:obsidian-emotion-log \
  rule:vault-struct rule:note-types-frontmatter rule:tags rule:content-style
```

## Источник

[`domains/obsidian/skills/obsidian-emotion-log/SKILL.md`](../../../../domains/obsidian/skills/obsidian-emotion-log/SKILL.md)

## См. также

- [`obsidian-daily-append`](obsidian-daily-append.md) — общий аппенд в сегодняшнюю заметку
- [`obsidian-journal-review`](obsidian-journal-review.md) — сводка за период
- [`obsidian-journal-keeper`](../agents/obsidian-journal-keeper.md) — агент-оркестратор
