# Полная установка

Три способа. Все идемпотентны и работают параллельно (можно сначала через `npx`, потом перейти на локальный клон).

## 1. `npx` (рекомендуется)

Самый простой способ. Не требует ничего, кроме Node.js и git.

```bash
# Если нужен obsidian-домен:
export BEAR_VAULT="$HOME/Obsidian/MyVault"

# Поставить всё, что возможно с текущим окружением:
npx github:jtprogru/bear-skills install
```

Что произойдёт:

1. `npx` скачает пакет с GitHub во временный кеш и запустит CLI.
2. CLI выполнит `git clone https://github.com/jtprogru/bear-skills.git ~/.bear-skills` (если ещё не было).
3. CLI прочитает `manifest.yaml` каждого домена и расставит симлинки:
   - `obsidian` rules → `$BEAR_VAULT/.agents/rules/` (если `BEAR_VAULT` задан)
   - `git`, `sre`, `content` rules → `~/.claude/rules/`
   - все skills → `~/.claude/skills/`
   - все agents → `~/.claude/agents/`
4. Домены с невыполненными `requires_env` будут пропущены с warning'ом.

Дальнейшие команды:

```bash
npx github:jtprogru/bear-skills sync       # git pull + relink
npx github:jtprogru/bear-skills status     # что развёрнуто
npx github:jtprogru/bear-skills uninstall  # снять симлинки
npx github:jtprogru/bear-skills check      # валидация манифестов и фронтматтера
```

Если не задал env `BEAR_VAULT` и нужен obsidian — передавай `--vault` каждый раз:

```bash
npx github:jtprogru/bear-skills install --vault "$HOME/Obsidian/MyVault"
```

### Dry-run

```bash
npx github:jtprogru/bear-skills install --dry-run
```

Покажет каждое `ln -sfn` без реального действия.

## 2. Глобально через npm

Имеет смысл, если запускаешь `bear-skills` часто и не хочешь каждый раз ждать загрузку `npx`.

```bash
npm install -g github:jtprogru/bear-skills

export BEAR_VAULT="$HOME/Obsidian/MyVault"   # опционально
bear-skills install
bear-skills sync
```

Удалить:

```bash
bear-skills uninstall
npm uninstall -g bear-skills
```

`~/.bear-skills/` останется — снеси вручную, если надо: `rm -rf ~/.bear-skills`.

## 3. Локально из клона (для разработки)

Используй, если хочешь править правила/скиллы/агенты в своём форке.

```bash
git clone https://github.com/jtprogru/bear-skills.git ~/.bear-skills
cd ~/.bear-skills

export BEAR_VAULT="$HOME/Obsidian/MyVault"   # опционально

# Через make
make install
make sync
make uninstall

# Или напрямую через CLI
node bin/cli.js install --source . --no-clone
node bin/cli.js sync    --source . --no-clone
node bin/cli.js status  --source . --no-clone
```

Через `make` без env-переменной:

```bash
make install VAULT="$HOME/Obsidian/MyVault"
```

Преимущество: правишь файл в `~/.bear-skills/`, и изменения сразу видны в Claude Code/Obsidian через симлинк. Без `git pull`, без перезапуска.

## Проверка после установки

```bash
bear-skills status   # все ✅ — успех
```

В выводе должны быть разделы по доменам. Каждый компонент — с галочкой ✅, если симлинк на месте.

Если хочешь убедиться, что Claude Code увидел скиллы:

```bash
ls -la ~/.claude/skills/
ls -la ~/.claude/agents/
ls -la ~/.claude/rules/      # для git/sre/content
```

Все должны быть симлинками (`->` стрелки в `ls -la`).

Для obsidian — отдельно:

```bash
ls -la "$BEAR_VAULT/.agents/rules/"
```

Должны быть симлинки на `domains/obsidian/rules/*.md` в `~/.bear-skills/`.

## Обновление

При выходе новых компонентов:

```bash
bear-skills sync   # делает git pull + uninstall + install
```

Если ставил локально из клона:

```bash
cd ~/.bear-skills && git pull && make sync
```

## Удаление

```bash
bear-skills uninstall
```

Снимет все симлинки, но **не тронет** `~/.bear-skills/` и `$BEAR_VAULT`. Если хочешь снести и source:

```bash
rm -rf ~/.bear-skills
```

См. также: [partial.md](partial.md) — если нужны не все домены или компоненты.
