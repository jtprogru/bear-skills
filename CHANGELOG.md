# Changelog

Формат — [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/), версии по [semver](https://semver.org/lang/ru/).

## [Unreleased]

### Добавлено

Правило `narrative-structure` в домене `content` — синопсис из пяти вопросов до письма и проверка готового черновика по пирамиде Фрейтага, с типичными провалами дуги и поправкой на формат (длинный разбор, короткая заметка, серия постов). `content-humanizer` ссылается на него, когда перекраивает текст целиком, а не шлифует фразы.

### Изменено

Из `content-humanizer` убраны шаги механического скана (0 и 4.5). Сам `scripts/scan_tells.py` и `references/tells-ru.md` остались — сканер доступен как отдельный инструмент, но больше не часть обязательного процесса.

## [0.4.0] — 2026-08-07

Публикуемость, три новых домена и runtime.

### Добавлено

**Дистрибуция.** Плагин Claude Code (`.claude-plugin/`), `install.sh` + `bin/install.js` с детектом Claude Code, Codex, Cursor и opencode, генератор плоского зеркала `bin/mirror.js` с режимом `--check`. Зеркало переписывает ссылки на правила под свою структуру: при установке плагином пути `~/.claude/rules/` не существует.

**Домен `agentops`** — гигиена работы с агентом: `agentops-compress` (сжатие memory-файлов со скриптовой проверкой сохранности якорей), `agentops-canary` (канарейка контекста), `agentops-delegate`, `agentops-brevity`, правило `agentops-auto-clarity`. Сабагенты `bear-locator`, `bear-surgeon`, `bear-reviewer` с грепаемыми контрактами вывода.

**Домен `code`** — `code-grill` (калиброванный допрос плана), `code-senior-review` (ревью плана с живым поиском практик), `code-review-line`, `code-last-mile`.

**Домен `bear`** — `bear-help`, `bear-doctor`, `bear-new-skill`, `bear-stats`. Команды CLI `doctor` (пять проверок установки) и `stats` (частота вызовов по логам сессий).

**Runtime.** `SessionStart`-хук с symlink-safe записью, statusline-бейдж, слэш-команды `/bear`, `/bear-doctor`, `/bear-stats`.

**Evals.** Раннер `bin/evals.js` по трёхрукой схеме `baseline` / `terse` / `skill`; честная дельта считается против terse.

**Прочее.** `README.md` рядом с каждым из 36 скиллов, `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`, issue-шаблоны, 51 тест на `node --test`, CI на Node 18/20/22 с проверкой установки с чистой машины.

### Удалено

- Чужой скилл `sdd` (sipki-tech) снят со склада и убран из `skills-lock.json`. Он занимал территорию spec-driven цикла, но в `~/.claude/skills/` выставлен не был, то есть ни разу не срабатывал. Домен `spec` пока не заводится — место освобождено, решение отложено.

### Изменено

- `content-humanizer` получил регексный сканер тэллов (`scripts/scan_tells.py`) с агрегатными проверками: длинное тире в русском — законный знак, тэллом является только ненормальная плотность. Плюс шаг повторного скана, который ловит штампы, занесённые обратно при переписывании.

## [0.3.0] — 2026-08-07

Перенос личных скиллов из `~/.agents/skills/` в репозиторий и подготовка к публикации.

### Добавлено

- Домен `sre`: скиллы `srekit`, `srekit-postmortem`, `srekit-runbook` поверх CLI `srekit`.
- Домен `content`: скилл `content-zavod` — из одного источника пакет контента в 6 файлов.
- Домен `git`: скилл `git-monorepo-release` — состав релиза монорепо, независимые версии пакетов, backport.
- `requires_bin` в манифесте домена: списком (требование ко всему домену) или ключом с перечнем компонентов (требование к ним одним).
- Команда `bear-skills lock-check` и файл `skills-lock.json` — фиксация чужих скиллов рядом с нашими: источник, лицензия, sha256.
- `bin/mirror.js` — генерация плоского зеркала `skills/`, `agents/`, `rules/` из `domains/`, с режимом `--check` для CI.
- Плагин Claude Code: `.claude-plugin/plugin.json` и `marketplace.json`.
- `install.sh` и `bin/install.js` — копирующая установка с детектом Claude Code, Codex, Cursor, opencode.
- Тесты на `node --test` и CI на Node 18/20/22, включая проверку установки с чистой машины.
- Предупреждение при одновременной установке двумя каналами (симлинки и копии).

### Изменено

- `git-release-tag` отвечает за один тег; выбор состава релиза в монорепо ушёл в `git-monorepo-release`.
- Правило `git-conventions` дополнено: обоснование формата тега `<пакет>/vX.Y.Z` (требование Go toolchain), независимость версий пакетов, breaking change до 1.0 идёт в minor.
- Агент `sre-oncall-engineer` вызывает `srekit-postmortem` и `srekit-runbook`.

### Удалено

- Скиллы `sre-incident-postmortem` и `sre-runbook-author` — вытеснены srekit-версиями.

## [0.2.0] — 2026-08-07

Первый релиз мульти-доменной архитектуры: 4 домена, 21 скилл, 7 агентов, 14 правил, установка симлинками через `bin/cli.js`.

[Unreleased]: https://github.com/jtprogru/bear-skills/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/jtprogru/bear-skills/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/jtprogru/bear-skills/releases/tag/v0.2.0
