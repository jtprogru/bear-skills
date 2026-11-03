# Полная установка

Поведение флагов, native-пути, миграция и конфликты описаны в [руководстве](README.md).

## 1. npx (рекомендуется)

```bash
npx github:jtprogru/bear-skills install --provider claude-code
npx github:jtprogru/bear-skills install --provider codex --mode copy
```

Без `--source` CLI использует `~/.bear-skills` и при необходимости клонирует
репозиторий. `--no-clone` запрещает clone/pull. Dry-run требует локальный source.

## 2. Глобально через npm

```bash
npm install -g github:jtprogru/bear-skills
bear-skills providers
bear-skills install --provider cursor --mode copy
```

## 3. Локально из клона (для разработки)

```bash
git clone https://github.com/jtprogru/bear-skills.git
cd bear-skills
node bin/cli.js install --source . --provider opencode --dry-run
node bin/cli.js install --source . --provider opencode
```

Для project scope добавь `--scope project --project /path/to/project`.
Для Obsidian — `--vault /path/to/vault` или `BEAR_VAULT`.

Symlink применяется только к файлам без преобразований. Generated-файлы
обновляются через `sync`; вся установка не обязана состоять из симлинков.

## Обновление и удаление

```bash
bear-skills sync --provider codex
bear-skills status --provider codex --json
bear-skills doctor --provider codex
bear-skills uninstall --provider codex
```

Используй тот же scope/project/home, что при установке. `sync` сохраняет режим
установленных компонентов, пока не задан `--mode`. Uninstall работает по описи,
сохраняет ручные изменения, не удаляет source, backups и чужие настройки.
