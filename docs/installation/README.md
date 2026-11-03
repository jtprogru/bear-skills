# Установка bear-skills

Один каталог `domains/` используется для Claude Code, Codex, Cursor и OpenCode.
По умолчанию сохранены `--provider claude-code --scope global --mode symlink`.
Нужны Node.js ≥ 18 и git для загрузки source; локальный `--source` обходится без сети.

```bash
# Проверка без записи файлов и git pull:
node bin/cli.js install git --source . --provider codex \
  --scope project --project /path/to/project --mode copy --dry-run

# Установка того же набора:
node bin/cli.js install git --source . --provider codex \
  --scope project --project /path/to/project --mode copy

node bin/cli.js doctor --provider codex --scope project --project /path/to/project
```

`--project` по умолчанию равен cwd и применяется только с project scope.
`--home` изолирует все пользовательские пути для проверки.
`--claude-home` сохранён как override native-root Claude Code;
`--provider-home` — аналог для остальных провайдеров. У Codex skill-root остаётся
`<home>/.agents/skills`; для изоляции всех путей используй именно `--home`.

## Пути

| Provider | Global skills | Project skills | Остальные компоненты |
|---|---|---|---|
| Claude Code | `~/.claude/skills` | `.claude/skills` | `agents/*.md`, `rules/*.md`, `commands/*.md`, `settings.json` |
| Codex | `~/.agents/skills` | `.agents/skills` | `.codex/agents/*.toml` и `.codex/hooks.json` |
| Cursor | `~/.cursor/skills` | `.cursor/skills` | `agents/*.md`, `rules/*.mdc`, `commands/*.md`, `hooks.json` |
| OpenCode | `~/.config/opencode/skills` | `.opencode/skills` | `agents/*.md`, `commands/*.md`, `plugins/bear-skills.js` |

Global OpenCode учитывает `XDG_CONFIG_HOME`. У Codex и OpenCode правила хранятся
в `<native-root>/.bear-skills/rules`; runtime подключает индекс через hooks/instructions.
У Cursor global MDC подключается через hook-индекс, project MDC — native rules.
Все ограничения: [сгенерированная таблица](../providers.md).

Для Obsidian нужен `--vault` или `BEAR_VAULT`. Только Claude global сохраняет старый
путь правил `<vault>/.agents/rules`. Остальные адаптеры используют собственную область.

## Выбор и зависимости

```bash
bear-skills install git content --provider cursor --mode copy
bear-skills install skill:git-conventional-commit --provider codex
bear-skills install agent:git-flow --provider opencode --scope project
bear-skills install command:bear --provider claude-code
bear-skills list
bear-skills providers --json
```

Точечная установка включает транзитивные правила и скиллы. Цикл или неизвестный ID —
ошибка всего каталога. Отсутствие CLI/env или непереносимое ограничение пропускает
компонент вместе с потребителями. Без `srekit` не устанавливается и требующий его
`sre-oncall-engineer`; `sre-k8s-triage` остаётся доступен. Явный выбор недоступного
компонента завершается ошибкой до записи.

MCP показывает три состояния: требуется, конфигурация найдена, сессия не проверена.
Credentials и trust установщик не создаёт. Native hooks Codex нужно отдельно
просмотреть и разрешить через `/hooks`. Project hooks зависят от доверия workspace.

## Copy, symlink и обновления

Оба режима доставляют полный пакет: SKILL.md, references, scripts, assets и шаблоны.
Symlink связывает только файлы без преобразований. Generated-файлы материализуются;
после изменения исходника запускай `sync`.

```bash
bear-skills sync --provider codex --scope project --project /path/to/project --source .
bear-skills status --provider codex --scope project --project /path/to/project --json
bear-skills uninstall --provider codex --scope project --project /path/to/project
```

`sync` без selectors обновляет корни из описи. `sync` сохраняет режим установленных компонентов; `--mode` явно меняет его. Удаление работает по описи без source,
CLI-зависимостей и переменной vault. Изменённый компонент и его зависимости
сохраняются с сообщением. Чужие настройки hook и посторонние файлы сохраняются.
Опись и backups остаются для аудита.

## Конфликты и миграция

Весь набор проверяется до записи. `--dry-run` возвращает конфликты и ненулевой
exit code, не делает clone/pull, mkdir или изменение config. Если локального
source нет, dry-run просит указать его.

```bash
bear-skills migrate --provider claude-code --source . --dry-run
bear-skills migrate --provider claude-code --source .
bear-skills sync --provider claude-code --source .
```

Миграция принимает точные source-симлинки или перечисленные старой описью файлы с
подтверждённым содержимым. Неоднозначные случаи — конфликты. Для изменений в файлах
старой описи можно выбрать `migrate --overwrite`: исходники попадут в backup.
Обычный `install --overwrite` также сохраняет заменяемые файлы в
`.bear-skills/backups/<id>/` с `index.json`. Проверки безопасных путей не отключаются.

## Совместимый копирующий entrypoint

```bash
node bin/install.js --only codex,cursor --dry-run
node bin/install.js --only codex,cursor
node bin/install.js --only codex,cursor --uninstall
```

Это обёртка общего ядра с default copy и обнаружением установленных провайдеров.
Сохранены `--only`, `--all`, `--list`, `--uninstall`. `install.sh` передаёт работу ей;
dry-run bootstrap требует существующий source и не скачивает репозиторий.
Plugin Claude Code и плоское зеркало остаются отдельными каналами.
Один компонент следует устанавливать одним каналом.

См. [контракт адаптера и описи](../adapter-contract.md), [runtime](../runtime.md),
[фактические проверки](../compatibility.md).
