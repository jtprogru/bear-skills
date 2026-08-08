<!-- СГЕНЕРИРОВАНО bin/mirror.js. Не редактировать: правки затрёт следующая генерация.
     Источник правды — domains/<домен>/. -->

# srekit — справочник по командам

Полный список флагов каждой команды (срез с реального бинарника `srekit --version` ≥ 0.28.0). Если флаг тут не упомянут — его нет. Глобальные флаги (`--config`, `--templates-dir`, `-q/--quiet`) и общие генератор-флаги (`--out`, `--stdout`, `--force`, `--dry-run`, `--json`) на уровне каждой команды не повторяются — они везде одинаковые.

## Генераторы

### `task` (alias: `sretask`) — investigation log

| Флаг | Default | Назначение |
| --- | --- | --- |
| `-T, --title` (required) | — | заголовок расследования |
| `-P, --path` | `./` | директория для default output |

Default `--out`: `investigation-<slug>.md` в `--path`.

Секции в шаблоне: Context / Hypothesis / Evidence / Findings / Action items / References.

### `postmortem` — Google SRE-style postmortem

**Этот навык постмортем не делает — для постмортема используется отдельный навык `srekit-postmortem`.** Эта таблица — только для полноты справочника.

| Флаг | Default | Назначение |
| --- | --- | --- |
| `-T, --title` (required) | — | заголовок |
| `--severity` | `SEV-3` | `SEV-1` / `SEV-2` / `SEV-3` |
| `--owner` | — | ответственный (роль) |
| `--start` | — | начало в RFC3339 |
| `--end` | — | mitigation/resolved в RFC3339 |
| `--from FILE` | — | прочитать секции из JSON (или `-` для stdin) |
| `--schema` | — | вывести JSON Schema для `--from` входа |
| `--validate FILE` | — | проверить input-файл без рендера |

Default `--out`: `postmortem-<slug>.md`.

`postmortem` — **единственная** команда с `--from` / `--schema` / `--validate` (round-trip workflow).

### `rfc` — RFC / ADR

| Флаг | Default | Назначение |
| --- | --- | --- |
| `-T, --title` (required) | — | заголовок RFC |
| `--status` | `proposed` | `proposed` / `accepted` / `rejected` / `superseded` / `deprecated` |
| `--author` | git config | author full name |
| `--email` | git config | author email |

Default `--out`: `rfc-<slug>.md`.

Секции: Context / Decision / Alternatives / Consequences.

### `runbook` — runbook для on-call

**Этот навык runbook не делает — для runbook используется отдельный навык `srekit-runbook` (прескриптивная дисциплина «что делать когда сработает», не транскрипт «что мы делали»).** Эта таблица — только для полноты справочника.

| Флаг | Default | Назначение |
| --- | --- | --- |
| `-T, --title` (required) | — | заголовок runbook |
| `--service` | — | имя сервиса |
| `--alert` | — | имя алерта (на который этот runbook отвечает) |

Default `--out`: `runbook-<slug>.md`.

Секции: Symptoms / Severity & SLO impact / Diagnose / Mitigate / Verify / After the fact / References.

### `slo` — SLO/SLI документ

| Флаг | Default | Назначение |
| --- | --- | --- |
| `--service` (required) | — | имя сервиса |
| `--target` | `99.9%` | таргет доступности |
| `--latency` | `300ms` | p99 latency target |
| `--window` | `30d` | rolling SLO window |

Default `--out`: `slo-<service>.md`.

`<service>` идёт в дефолтное имя файла **и** в frontmatter.

### `ebp` — Error Budget Policy

| Флаг | Default | Назначение |
| --- | --- | --- |
| `--service` (required) | — | имя сервиса |

Default `--out`: `ebp-<service>.md`.

Шаблон описывает tiered actions (Yellow / Orange / Red), исключения, эскалацию при сгорании бюджета.

### `capacity` — capacity plan

| Флаг | Default | Назначение |
| --- | --- | --- |
| `--service` (required) | — | имя сервиса |
| `--horizon` | `1y` | планирующий горизонт (`6m`, `1y`, `2y`, …) |

Default `--out`: `capacity-<service>.md`.

### `retro` — sprint retrospective

| Флаг | Default | Назначение |
| --- | --- | --- |
| `--team` (required) | — | имя команды |
| `--sprint` | today's date | label спринта (обычно `YYYY-WNN`) |

Default `--out`: `retro-<team>-<sprint>.md`.

### `oncall-report` (alias: `oncall`) — недельный отчёт on-call

| Флаг | Default | Назначение |
| --- | --- | --- |
| `--team` (required) | — | имя команды |
| `--start` | this week's Monday | начало периода |
| `--end` | this week's Sunday | конец периода |
| `--author` | git config | имя дежурного |
| `--email` | git config | email дежурного |

Default `--out`: `oncall-<team>-<start>.md`.

### `changelog` — `CHANGELOG.md` (Keep a Changelog)

| Флаг | Default | Назначение |
| --- | --- | --- |
| `--repo` | git remote | `OWNER/REPO` для compare-ссылок |
| `--version` | `0.1.0` | стартовый версионный label |

Default `--out`: `CHANGELOG.md`.

Шаблон **полностью английский** (в отличие от остальных двуязычных) — чтобы не ломать тулинг вокруг Keep a Changelog.

### `license` (alias: `lic`) — LICENSE-файл

| Флаг | Default | Назначение |
| --- | --- | --- |
| `--type` | `wtfpl` | `wtfpl` / `mit` / `apache2` |
| `--author` | git config | author full name |
| `--email` | git config | author email |
| `--year` | current year | copyright year |
| `--template FILE` | — | кастомный template-файл (one-shot подмена) |

Default `--out`: stdout.

`license` — **единственная** команда, у которой остался флаг `--template FILE`. У всех остальных генераторов он был удалён в v0.22.0.

## Управляющие команды

### `templates` — управление пользовательской директорией шаблонов

| Subcommand | Что делает |
| --- | --- |
| `templates init [DIR]` | скаффолд директории из embedded-шаблонов, делает `git init` (отключается `--no-git`). Default DIR: `~/.srekit/templates` |
| `templates list [DIR]` | таблица состояния (`identical` / `customized` / `user-only` / `embedded-only`). Поддерживает `--json` и `--filter <status>` |
| `templates diff [DIR]` | unified diff каждого изменённого артефакта vs embedded. Флаги: `--name-only`, `--no-color` |
| `templates validate [DIR]` | per-формат парс-проверка (`<name>.yaml` через `sections.ParseArtifact`, `<name>.tmpl` parse-only, legacy `<name>.sections.yaml` через `sections.ParseManifest`). Non-zero exit при ошибках |
| `templates upgrade [DIR]` | 3-way merge кастомизаций с обновлённым embedded set. Снапшот для merge-base — в `<dir>/.srekit-embedded/`. Флаги: `--dry-run`, `--force` (без merge) |
| `templates pull [DIR]` | `git pull` в `templates_dir`. По умолчанию `--ff-only`. Флаг `--rebase` |
| `templates migrate [DIR]` | конверсия pre-v0.14.0 `.tmpl` в v1 `<name>.yaml` (для старых пользовательских директорий) |

### `config` — управление конфигом

| Subcommand | Что делает |
| --- | --- |
| `config init` | интерактивный (или `--yes`) скаффолд `$XDG_CONFIG_HOME/srekit/config.yaml`. Поля: author, email, templates_dir. Флаг `--force` — перезапись |

### `completion` — shell completion

Стандартный cobra-style:
```bash
srekit completion zsh > "${fpath[1]}/_srekit"
srekit completion bash > /etc/bash_completion.d/srekit
srekit completion fish > ~/.config/fish/completions/srekit.fish
```

## Резолв author/email/templates_dir

Порядок (от высшего приоритета к низшему):

1. CLI-флаг (`--author`, `--email`, `--templates-dir`)
2. Env (`SREKIT_AUTHOR`, `SREKIT_EMAIL`, `SREKIT_TEMPLATES_DIR`)
3. Конфиг (`$XDG_CONFIG_HOME/srekit/config.yaml` → fallback `~/.srekit.yaml`)
4. `git config user.name` / `git config user.email` (для author/email)
5. Embedded default (для templates: тихо берётся встроенный шаблон)

## Стабильность

`srekit` следует SemVer; 0.x — breaking changes допустимы между minor (помечены `Breaking — …` в CHANGELOG). С v1.0 будут стабильны: CLI-флаги, имена и порядок section ID в `--json`, схема `<name>.yaml`, ключи конфига и `SREKIT_*` env, словарь section `type` (`text` / `list` / `table`).

Не стабилизуется (может меняться в 1.x): содержимое `frontmatter:` (free-form map), формулировки stderr `WARN` для legacy-файлов, внутренние Go-API в `internal/*`.
