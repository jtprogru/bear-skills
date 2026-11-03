# Фактические проверки совместимости

Дата: **2026-11-02**. Установка в личные конфиги и платные вызовы моделей не выполнялись.

| Среда | Проверка | Результат |
|---|---|---|
| macOS, Node.js 26.13.0 | Полная Node test suite, 4 providers × 2 scopes × 2 modes | Пройдена |
| Linux, локальный Docker image `nikolaik/python-nodejs:python3.11-nodejs20` | Та же suite, read-only mount репозитория, сеть отключена, записи в tmpfs | Пройдена |
| Native generated artifacts | references, assets, executable script, TOML через Python tomllib, hooks stdout, OpenCode plugin config hook | Пройдена без модельных вызовов |
| CI | Ubuntu/macOS × Node.js 18/20/22 | Матрица настроена; remote CI в этой работе не запускался |

Отдельно проверены dry-run без git/mkdir/config writes, повторная установка,
обновление, смена режима, migration старых копий/симлинков/flat-md, удаление без
source, сохранение пользовательских правок и настроек, backup, rollback при
ошибке записи, зависимости, неподдерживаемые permissions, safe paths и дубли scope.

## Инструменты на машине

| Инструмент | Обнаруженная версия | Что реально выполнено | Live-загрузка skills/agents/hooks |
|---|---|---|---|
| Claude Code | `2.1.314` | `--version` и справка CLI | **Не проверена** |
| Codex CLI | `0.166.0` | `--version` и справка CLI | **Не проверена** |
| Cursor CLI `agent` | `2026.05.16-0338208` | `--version` и справка CLI | **Не проверена** |
| OpenCode | `2.2.2` | `--version` и справка CLI | **Не проверена** |

Наличие бинаря и корректный файл не доказывают загрузку конкретной версией.
Нативный вызов subagent, ручной hook trust и взаимодействие с моделью остаются
отдельным live smoke. `providers`/`status` не повышают этот статус автоматически.

## Воспроизведение

```bash
make check
node bin/mirror.js --check
node bin/provider-docs.js --check
node --test tests/*.test.js
```

Тесты создают временные home/project/source и не устанавливают компоненты в личное
окружение. TOML дополнительно проверяется через `python3` с `tomllib`, если он доступен;
при отсутствии parser выводится отдельная diagnostic-строка.

Форматы и ограничения сверены с официальными источниками, перечисленными
в [генерируемой таблице](providers.md). Это подтверждение формата по документации,
а не утверждение о фактической загрузке провайдером.
