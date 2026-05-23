# Точечная установка

Когда не нужен весь набор — поставь только конкретный домен, или только нужные скиллы/правила/агенты из любых доменов.

## Способы выбора состава

### 1. Целый домен

Самый частый случай: ставим домен целиком, со всеми его правилами, скиллами и агентами.

```bash
bear-skills install git
bear-skills install obsidian sre        # два домена сразу
bear-skills install git sre content     # всё, кроме obsidian
```

Если домен требует env-переменную (например, `obsidian` — `BEAR_VAULT`) и она не задана — домен пропускается с warning'ом.

### 2. Позиционные аргументы с префиксом типа

Если нужен конкретный компонент из домена:

```bash
bear-skills install skill:obsidian-ingest
bear-skills install rule:git-conventions
bear-skills install agent:sre-oncall-engineer
```

Префиксы: `skill:`, `rule:`, `agent:`. CLI сам находит, в каком домене этот компонент живёт.

### 3. Позиционно без префикса (авто-детект)

Если имя уникально — префикс не нужен:

```bash
bear-skills install obsidian-ingest git-conventions sre-k8s-triage
```

CLI определит тип по имени. Если имя неоднозначно — выдаст ошибку и попросит уточнить префиксом.

### Комбинация: домен + точечные компоненты

```bash
# Поставить git целиком + один скилл из sre
bear-skills install git skill:sre-k8s-triage
```

## Узнать, что доступно

```bash
bear-skills list
```

Покажет дерево «домен → компоненты»:

```
▸ git
  rules (1):
    rule:git-conventions
  skills (3):
    skill:git-conventional-commit
    skill:git-pr-description
    skill:git-release-tag
  agents (1):
    agent:git-flow

▸ obsidian [requires: BEAR_VAULT]
  ...
```

## Зависимости между компонентами

CLI **не разрешает зависимости автоматически**. Если ставишь скилл, посмотри в его `SKILL.md` — там в начале указано, какие правила скилл читает. Простое решение — ставить **домен целиком**: тогда все правила, на которые ссылаются скиллы домена, окажутся на месте.

Скиллы одного домена не зависят от правил другого. Кросс-доменные сценарии (например, постмортем → ингест в Obsidian) подразумевают, что **оба домена установлены**.

## Сценарии

### Только SRE — без Obsidian

```bash
bear-skills install sre
```

`BEAR_VAULT` не нужен.

### Только git и content

```bash
bear-skills install git content
```

### Только один скилл из obsidian + правила домена

```bash
export BEAR_VAULT="$HOME/Obsidian/MyVault"
# Поставить весь домен — проще, чем перечислять правила
bear-skills install obsidian
```

Если действительно нужен только один скилл — поставь весь домен, а в Claude Code триггерь только нужный.

### Минимальная конфигурация — без vault

```bash
# git, sre, content (без obsidian)
bear-skills install
```

Просто опусти `BEAR_VAULT` — obsidian скипнется.

## Точечное удаление

```bash
bear-skills uninstall git                    # весь домен
bear-skills uninstall skill:obsidian-ingest  # один скилл
bear-skills uninstall obsidian sre           # два домена
```

`bear-skills uninstall` **без аргументов** снимет всё.

## Через `make`

В локальном клоне:

```bash
make install-one ARGS="git"
make install-one ARGS="skill:obsidian-ingest"
make uninstall-one ARGS="sre"
make list
```

## Добавление к уже установленному

`install` идемпотентен:

```bash
bear-skills install git       # день 1
bear-skills install content   # день 2 — добавится, git останется
```

## См. также

- [Полная установка](full.md)
- [Решение проблем](troubleshooting.md)
- Состав доменов: [obsidian](../domains/obsidian/), [git](../domains/git/README.md), [sre](../domains/sre/README.md), [content](../domains/content/README.md)
