# Решение проблем

Самые частые ситуации.

## ⚠️ «Пропущены домены: obsidian: требует env: BEAR_VAULT»

```
⚠️  Пропущены домены:
   obsidian: требует env: BEAR_VAULT
```

**Причина:** домен `obsidian` требует переменную окружения `BEAR_VAULT`, а она не задана. Остальные домены (git, sre, content) ставятся нормально.

**Решение (если obsidian нужен):**

```bash
export BEAR_VAULT="$HOME/Obsidian/MyVault"
bear-skills sync
# или
bear-skills install --vault "$HOME/Obsidian/MyVault"
```

**Если obsidian не нужен** — это не ошибка, а ожидаемое поведение. Warning можно игнорировать.

## ❌ «Vault не существует» / симлинки указывают в никуда

CLI создаст `<vault>/.agents/rules/` и положит симлинки даже если сам `<vault>` ещё не существует. Но Obsidian увидит правила только в открытом хранилище.

**Проверь:**

```bash
ls -la "$BEAR_VAULT"
```

Если папки нет — открой её в Obsidian как vault (через «Open folder as vault»), затем перезапусти `bear-skills sync`.

## ❌ «Компонент X не найден»

```
❌ Компонент "obsidian-foo" не найден. Запусти "bear-skills list" для списка.
```

**Причина:** опечатка или компонент с таким именем не существует.

**Решение:** `bear-skills list` — посмотри точные имена.

## ❌ «Имя X неоднозначно»

```
❌ Имя "foo" неоднозначно (skills, rules). Уточни префиксом, например skill:foo.
```

**Причина:** есть скилл и правило с одинаковым именем. Сейчас таких коллизий в репозитории нет (это проверяет `make check`), но при добавлении своих компонентов они возможны.

**Решение:** добавь префикс типа:

```bash
bear-skills install rule:foo
```

## ❌ `git clone` падает в `~/.bear-skills/` — там что-то лежит, но не git-репо

```
❌ ~/.bear-skills существует и не пустой, но не git-репо. Удали его вручную или укажи --source
```

**Решение:** либо снеси и пусть CLI заново склонит:

```bash
rm -rf ~/.bear-skills
bear-skills install
```

Либо укажи свой source-путь:

```bash
bear-skills install --source /path/to/your/clone --no-clone
```

## ❌ «Домен X не найден»

```
❌ Домен "obsidain" не найден.
```

**Причина:** опечатка в имени домена.

**Решение:** `bear-skills list` — покажет точные имена доменов (`obsidian`, `git`, `sre`, `content`).

## ⚠️ Симлинки сломались после обновления

Возможные причины:

- `~/.bear-skills/` удалили вручную → симлинки висят
- Перенесли репо в другую папку

**Решение:**

```bash
bear-skills uninstall   # снимет все симлинки, в том числе сломанные
bear-skills install     # поставит заново
```

или одной командой:

```bash
bear-skills sync
```

## ⚠️ Claude Code не видит новые скиллы/агенты

После симлинков — перезапусти Claude Code. Скиллы и агенты подхватываются при старте.

Проверка, что симлинки на месте:

```bash
ls -la ~/.claude/skills/
ls -la ~/.claude/agents/
```

Должны быть `lrwxr-xr-x` (буква `l` — link) и стрелка `->` на `~/.bear-skills/...` или твой локальный путь.

## ⚠️ Obsidian не видит правила в `.agents/rules/`

Сами правила в `.agents/` Obsidian как заметки не показывает — папка скрытая. Это правильно: на правила ссылается AI-агент Claude через файловую систему, не Obsidian.

Проверь, что симлинки реально читаются:

```bash
cat "$BEAR_VAULT/.agents/rules/tags.md" | head -5
```

Если выводит содержимое — всё ок.

## ⚠️ `make` не находит `node`

Если `node` установлен через `nvm`, при запуске `make` через graphical-launcher путь может быть не выставлен.

**Решение:** запускай `make` из обычного терминала, либо используй `npx`/`bear-skills` напрямую.

## ❌ После `sync` мои правки в `~/.bear-skills/` пропали

`sync` делает `git pull --ff-only`. Если у тебя есть незакоммиченные правки — git откажется их перезатирать, а CLI напечатает варнинг и продолжит с локальной версией.

Если правки уже потеряны после `git pull` — git stash их сохранил, попробуй:

```bash
cd ~/.bear-skills
git stash list
git stash pop
```

В будущем — коммить свои правки в форк или работай через `--source` с отдельным клоном.

## ⚠️ Хочу обновить только один скилл

`sync` обновит всё. Если хочешь точечно — `uninstall` нужный, потом `install`:

```bash
cd ~/.bear-skills && git pull
bear-skills uninstall skill:obsidian-ingest
bear-skills install skill:obsidian-ingest
```

## Что-то ещё пошло не так

1. `bear-skills check` — проверит фронтматтер всех скиллов и агентов
2. `bear-skills status` — покажет, что развёрнуто
3. `bear-skills install --dry-run` — покажет, что **попытается** сделать без реальных действий

Если воспроизводится баг — открой issue: https://github.com/jtprogru/bear-skills/issues
