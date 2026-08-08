# srekit

Скаффолдит остальные SRE-артефакты через CLI `srekit`: investigation log, RFC/ADR, SLO, error budget policy, capacity plan, retro, on-call report, changelog.

## Требует

CLI `srekit` в `PATH`. Без него скилл не устанавливается.

## Когда срабатывает

«Завести ADR», «оформить SLO», «сделать retro», «нужен capacity plan» — глаголы «сделать / оформить / завести» рядом с названием артефакта, даже без слова `srekit`.

## Что делает

Вызывает нужную подкоманду и наполняет секции тем, что обсуждалось в сессии. Как и остальные скиллы семейства, ставит GAP-маркеры вместо выдуманных данных.

Постмортем и runbook сюда не относятся — у них свои скиллы: [`srekit-postmortem`](../srekit-postmortem/README.md) и [`srekit-runbook`](../srekit-runbook/README.md).

## Границы

Если CLI нет в `PATH` — говорит, как поставить, и останавливается, а не имитирует его вывод.

Промпт для модели — [`SKILL.md`](SKILL.md). Список команд — [`references/commands.md`](references/commands.md). Домен — [`sre`](../../../../docs/domains/sre/README.md).
