# srekit postmortem — CLI reference

Кэш `srekit postmortem --help` (версия 0.28.0, 2026-06-05). Проверь актуальность через `srekit --version` и `srekit postmortem --help`, если что-то ведёт себя не как описано.

## Назначение

Генерирует markdown-каркас постмортема в Google-SRE-стиле. Только структура и frontmatter — содержимое секций оставлено пустым с подсказками.

## Сигнатура

```
srekit postmortem [flags]
```

## Флаги

| Флаг | Тип | По умолчанию | Назначение |
|---|---|---|---|
| `-T, --title` | string | — (обязательный, кроме случая `--from`) | Заголовок инцидента |
| `--severity` | string | `SEV-3` | Уровень: `SEV-1` / `SEV-2` / `SEV-3` |
| `--owner` | string | пусто | Ответственный за постмортем (используй роль) |
| `--start` | string | пусто | Начало (RFC3339 или человекочитаемое) |
| `--end` | string | пусто | Конец (RFC3339 или человекочитаемое) |
| `--out` | string | `postmortem-<YYYY-MM-DD>-<slug>.md` | Путь к выходному файлу. Дата в дефолте — creation date, не дата инцидента |
| `--templates-dir` | string | из конфига / `$XDG_CONFIG_HOME/srekit/templates` | Каталог пользовательских шаблонов (one-shot override, fallback на embedded) |
| `--force` | bool | false | Перезаписать существующий файл |
| `--dry-run` | bool | false | Напечатать результат, не писать файл |
| `--stdout` | bool | false | Напечатать в stdout |
| `--json` | bool | false | Вместо рендера — выдать template data в JSON (camelCase) |
| `--from` | string | — | Прочитать секции из JSON-файла (`-` для stdin). Round-trip workflow |
| `--schema` | bool | false | Вывести JSON Schema для `--from` входа (mutually exclusive с `--validate`) |
| `--validate` | string | — | Валидировать input-файл: непустые required секции, нет неизвестных ID |
| `-q, --quiet` | bool | false | Подавить информационные сообщения |

`--template FILE` (one-shot путь к конкретному файлу шаблона) у `postmortem` был удалён в v0.22.0; флаг остался только у `srekit license`. Для подмены шаблона у `postmortem` — `--templates-dir DIR` (директория, содержащая `postmortem.yaml`) или конфиг.

## Примеры из help

```bash
# Записать postmortem-<YYYY-MM-DD>-<slug>.md в текущей директории
srekit postmortem --title "Checkout outage" --severity SEV-1 --owner bob

# Структура секций в JSON (camelCase, в порядке манифеста)
srekit postmortem -T "Cache stampede" --json | jq '.sections[].id'

# Round-trip: выдать JSON → отредактировать одну секцию → отрендерить markdown обратно
srekit postmortem -T X --json > pm.json
# ... отредактировать pm.json ...
srekit postmortem -T X --from pm.json

# Schema для --from входа (editor tooling / агенты)
srekit postmortem --schema > postmortem.schema.json

# Валидация input-файла (required секции непустые, нет unknown ID)
srekit postmortem --validate pm.json

# Использовать пользовательский шаблон из конкретной директории
srekit postmortem -T "..." --templates-dir /abs/path/to/team-templates --out ...
```

## Что генерирует (embedded шаблон)

Frontmatter:

```yaml
---
id: <UUID v4>
creation_date: <ISO timestamp>
type: postmortem
title: <title>
severity: <severity>
owner: <owner>
tags:
- postmortem
- incident
---
```

Тело (Russian, Google SRE style):

- Заголовок + blameless-блок
- Метаданные (Severity / Owner / Started / Resolved / Duration)
- Секции: Summary, Impact, Timeline (таблица), Root Cause, Detection, Resolution, What went well/wrong, Where we got lucky, Action items (таблица), Lessons learned, References

Кастомный шаблон может быть совсем другим (например, у h3llo — расширенная версия с Impact-таблицей, Why it took N minutes, Communications log, Follow-up через 30/90 дней).

## Связанные команды

- `srekit incident` — live-incident отчёт (для активных инцидентов, до постмортема).
- `srekit task` — investigation log.
- `srekit retro` — sprint retrospective.
- `srekit templates` — управление каталогом кастомных шаблонов.
- `srekit config init` — настроить author/email/templates_dir в `$XDG_CONFIG_HOME/srekit/config.yaml`.

## Поведение при ошибках

- Без `--title` (и без `--from`, который может его дать) → `Error: --title is required`, exit ≠ 0.
- Файл существует, нет `--force` → ошибка, не перезаписывает.
- `--templates-dir` указывает на несуществующую директорию → ошибка.
- `--schema` и `--validate` указаны одновременно → ошибка (mutually exclusive).
- `--validate` нашёл пустые required-секции или unknown section ID → exit ≠ 0 с описанием.
