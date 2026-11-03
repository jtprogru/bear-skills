# Диагностика установки

```bash
bear-skills providers
bear-skills status --provider codex --scope project --project /path/to/project --json
bear-skills doctor --provider codex --scope project --project /path/to/project
```

Статус «файлы на месте» не означает загрузку инструментом. Проверь поддержку
формата своей версией, trust workspace и, для Codex hooks, разрешение через `/hooks`.
Таблица ограничений и несовместимых компонентов [генерируется из адаптеров](../providers.md).

## Конфликт или старая установка

Нет описи — файл не считается собственным автоматически. Для прежней установки:

```bash
bear-skills migrate --source /path/to/source --provider claude-code --dry-run
bear-skills migrate --source /path/to/source --provider claude-code
bear-skills sync --source /path/to/source --provider claude-code
```

Точный source-симлинк или подтверждённый файл старой описи можно принять.
Неоднозначный файл останется конфликтом. `--overwrite` явно разрешает замену
с backup, но не обход проверки путей. Для файлов старой описи без checksum
`migrate --overwrite` сначала сохраняет исходник, затем принимает владение.

Если обычный install/sync сообщает о пользовательской правке, сравни её с source
и перенеси нужное изменение в source либо используй `--overwrite`.
Backup индекс лежит в `<native-root>/.bear-skills/backups/<id>/index.json`.

## Недоступные зависимости

`requires_env`/`requires_bin` блокируют компонент вместе с потребителями.
`BEAR_VAULT` нужен Obsidian; `srekit` — соответствующим skills и on-call agent.
`python3` нужен скиллам, которые запускают Python-скрипты. Точные требования:
`bear-skills list` и `doctor`.

MCP configuration found означает только наличие конфигурации. Подключение и
доступ проверяются внутри сессии, например `tg_me` для Telegram. Установщик не
создаёт credentials и не выдаёт разрешений.

## Битые ссылки и ресурсы

Если source перемещён, symlink-ресурсы перестанут читаться. Обнови `--source` через
`sync` или используй copy. Uninstall может снять собственные битые ссылки без source.
`doctor` проверяет ресурсы, контрольные суммы, зависимости и возможные дубли
global/project/plugin. Не смешивай несколько каналов с одинаковыми компонентами.

## Прерванная транзакция

После аварийного завершения может остаться `install.lock`. Убедись, что процесс
установщика завершён, проверь опись и backups; только после этого убирай stale lock.
Обычные исключения применения откатывают уже изменённые файлы; отключение питания
посреди нескольких rename не считается гарантированно атомарной транзакцией.
