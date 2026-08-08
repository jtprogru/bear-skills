# obsidian-enrich-note

Заполняет frontmatter одной заметки — aliases, up, down, other — не трогая её содержимое и не перемещая.

## Когда срабатывает

«Обнови frontmatter», «добавь aliases», «свяжи заметку с другими», «обогати заметку ссылками».

## Что делает

Ищет по базе, с чем эта заметка связана, и проставляет связи в обе стороны: `up` на родителя, `down` на дочерние, `other` на смежное. Aliases добавляет по тем формулировкам, которыми заметку реально ищут.

## Границы

Точечная операция: заметка остаётся на месте, текст не меняется. Для полного рефакторинга с перемещением — [`obsidian-refactor-inbox`](../obsidian-refactor-inbox/README.md).

Требует `BEAR_VAULT`. Подробная документация — [`docs/domains/obsidian/skills/obsidian-enrich-note.md`](../../../../docs/domains/obsidian/skills/obsidian-enrich-note.md).

Промпт для модели — [`SKILL.md`](SKILL.md). Домен — [`obsidian`](../../../../docs/domains/obsidian/).
