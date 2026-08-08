<!-- СГЕНЕРИРОВАНО bin/mirror.js. Не редактировать: правки затрёт следующая генерация.
     Источник правды — domains/<домен>/. -->

# obsidian-inbox-review

Осматривает `00. Входящие` и отдаёт отчёт: что там лежит и что с этим делать. Файлы не меняет.

## Когда срабатывает

«Что во входящих», «разбери inbox» — когда нужен обзор до принятия решений.

## Что делает

Проходит по заметкам, определяет тип каждой и предлагает категорию с действием. Результат — список, по которому видно объём работы.

## Границы

Read-only по замыслу: ни тегов, ни перемещений, ни правок frontmatter. Для фактической обработки — [`obsidian-refactor-inbox`](../obsidian-refactor-inbox/README.md).

Требует `BEAR_VAULT`. Подробная документация — [`docs/domains/obsidian/skills/obsidian-inbox-review.md`](../../../../docs/domains/obsidian/skills/obsidian-inbox-review.md).

Промпт для модели — [`SKILL.md`](SKILL.md). Домен — [`obsidian`](../../../../docs/domains/obsidian/).
