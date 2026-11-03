# Точечная установка

Выбор одинаков для всех провайдеров:

```bash
bear-skills install git content --provider cursor
bear-skills install skill:git-conventional-commit --provider codex --mode copy
bear-skills install agent:git-flow --provider opencode --scope project
bear-skills install command:bear --provider claude-code
bear-skills list
```

Вместе с компонентом устанавливаются транзитивные зависимости из манифеста.
Неизвестный ID или цикл — ошибка. Явный выбор недоступного компонента завершается
ошибкой; при выборе домена недоступные компоненты и потребители пропускаются.

```bash
bear-skills sync skill:git-conventional-commit --provider codex
bear-skills uninstall agent:git-flow --provider opencode --scope project
```

Удаление зависимости блокируется, если остаётся её потребитель: включи его в выбор.
Зависимости не удаляются автоматически как «сироты» — это может быть отдельный
пользовательский выбор. Без selectors uninstall выбирает всю опись.

Перед изменениями используй `--dry-run`. Конфликт блокирует применение всего набора.
Подробнее: [установка и миграция](README.md).
