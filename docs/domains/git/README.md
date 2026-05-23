# Домен `git`

Git workflow по схеме GitHub Flow с semver-релизами. Conventional Commits, описания PR, аккуратные теги.

| Поле | Значение |
|------|----------|
| `requires_env` | — (не требует переменных окружения) |
| `rules` target | `~/.claude/rules/` |
| `skills` target | `~/.claude/skills/` |
| `agents` target | `~/.claude/agents/` |

Манифест: [`domains/git/manifest.yaml`](../../../domains/git/manifest.yaml).

## Состав

### Правила

- **`git-conventions`** — единый источник правды: формат коммитов (Conventional Commits), имена веток, структура PR, semver и теги.

### Скиллы

| Скилл | Что делает | Когда вызывать |
|-------|------------|----------------|
| `git-conventional-commit` | Анализирует diff, формирует commit-message по конвенции | «закоммитить», «commit это», «сделай commit-message» |
| `git-pr-description` | Из diff ветки против main делает описание PR (зачем / что / как проверить) | «описать PR», «оформить пуллреквест» |
| `git-release-tag` | Определяет semver-bump из коммитов, генерирует changelog, ставит тег | «выпустить релиз», «бампнуть версию», «затегать» |

### Агенты

- **`git-flow`** — оркестратор полного цикла: ветка → коммиты → PR → тег. Вызывает все три скилла в нужные моменты.

## Установка только этого домена

```bash
npx github:jtprogru/bear-skills install git
```

`BEAR_VAULT` не нужен.

## Принципы

- **Atomic commits.** Один коммит — одно логическое изменение.
- **Не переписывай опубликованную историю.** Force-push — только в свою feature-ветку до открытия PR.
- **Никогда не пушь / тегай без подтверждения пользователя.**
- **Не пиши `chore: update`** — это пустое сообщение.

Подробнее — в правиле `git-conventions`.
