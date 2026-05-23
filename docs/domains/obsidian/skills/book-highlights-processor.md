# Skill: `book-highlights-processor`

Обрабатывает экспортированные цитаты из iBooks/Zotero — превращает 🎯-цитаты-буллеты в Obsidian-callout-ы с заголовками и `==highlight==` ключевых фраз.

## Назначение

Экспорт из iBooks/Zotero даёт длинный список цитат в формате:

```
- 📚
    - 🎯Quote text...
        - ✍️Reader's own note
```

Скилл превращает каждую `🎯`-цитату в:

```
> [!quote] Generated Title
> Quote text with ==key phrase== highlighted.
>
> ✍️ Reader's note
```

Заголовок к каждой цитате — claim-based (см. [`file-naming`](../rules/file-naming.md)), и в будущем может стать именем атомарной заметки.

## Триггеры

- «обработай цитаты»
- «добавь заголовки к хайлайтам»
- «разбери экспорт из книги»
- «обработай импорт из iBooks/Zotero»

## Когда НЕ использовать

| Ситуация | Используй вместо |
|----------|-----------------|
| Уже обработанные callout-ы → атомарки | `obsidian-ingest` (вторым шагом после этого скилла) |
| Статья или произвольный markdown | `obsidian-ingest` напрямую |

## Зависимости

**Правила:**

- [`file-naming`](../rules/file-naming.md) — claim-based заголовки для callout-ов
- [`content-style`](../rules/content-style.md) — стиль текста и язык

## Точечная установка

```bash
bear-skills install book-highlights-processor file-naming content-style
```

## Источник

[`skills/book-highlights-processor/SKILL.md`](../../skills/book-highlights-processor/SKILL.md)

## Связанные

После этого скилла обычно идёт [`obsidian-ingest`](obsidian-ingest.md) — он превратит самые содержательные callout-ы в атомарные заметки.

## См. также

- [`source-ingester`](../agents/source-ingester.md) — агент, объединяющий эти два этапа
