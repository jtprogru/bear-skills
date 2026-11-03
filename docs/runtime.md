# Runtime: контракт, hooks и commands

Единственный источник рабочего контракта — `runtime/contract.md`. Он содержит
протокол, язык, тон и ограничения на необратимые действия. Полные тексты всех правил
в runtime не включаются: скилл/агент читает ресурсы своих зависимостей.

CLI регистрирует runtime вместе с компонентами:

- Claude Code: одна запись `SessionStart` в `settings.json`.
- Codex: `SessionStart` в `hooks.json`, включая индекс доступных правил.
- Cursor: `sessionStart` в `hooks.json`, ответ `additional_context`.
- OpenCode: native plugin `plugins/bear-skills.js`; его config hook добавляет
  контракт и индекс в `instructions`, сохраняя существующие элементы.

Пути global/project принадлежат адаптеру. Native hooks читают версионированную
опись; активные домены берутся из компонентов, а не из префиксов имён.
Ошибки SessionStart дают код 0 и пустой вывод. Никаких credentials, trust или
пользовательских настроек сами runtime-скрипты не записывают.

Codex требует отдельно разрешить hooks через `/hooks`; project-слой должен быть
доверенным. Installer показывает конфигурацию и статус файлов, но не утверждает,
что провайдер уже загрузил или исполнил их.

## Commands

Источники: `domains/bear/commands/`. Claude Code, Cursor и OpenCode получают native
Markdown commands. Codex получает explicit skills `bear-command-bear` и
`bear-command-bear-doctor` с `allow_implicit_invocation: false`. CLI-вызовы
диагностики в установленных meta-компонентах содержат выбранные provider/scope.

`bear-stats` анализирует только session logs Claude Code; для других провайдеров
этот skill/command несовместим и пропускается с объяснением.

## Plugin Claude Code и statusline

Существующий plugin-канал продолжает использовать `hooks/hooks.json` и
`hooks/bear-activate.js`. Он читает тот же `runtime/contract.md` и сгенерированный
`hooks/catalog.json`. Не ставь plugin и CLI-копию одних компонентов одновременно:
`doctor` сообщает о возможных дублях.

Plugin-hook сохраняет прежний `.bear-active` для `hooks/bear-statusline.sh`.
Запись флага остаётся symlink-safe; вывод statusline фильтрует имена доменов.
CLI-адаптеры не изменяют пользовательскую настройку statusline.

Проверки:

```bash
node --test tests/hooks.test.js tests/providers.test.js
node bin/mirror.js --check
```

Эти проверки исполняют сгенерированные hooks/plugin в изолированной среде.
Запуск provider-модели и фактический вызов subagent — отдельная live-проверка,
см. [журнал совместимости](compatibility.md).
