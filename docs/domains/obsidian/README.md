# Домен `obsidian`

Персональная база знаний на Obsidian по методологии PARA (Projects · Areas · Resources · Archives).

| Поле | Значение |
|------|----------|
| `requires_env` | `BEAR_VAULT` — путь к Obsidian-хранилищу |
| `rules` target | `$BEAR_VAULT/.agents/rules/` (vault-local) |
| `skills` target | `~/.claude/skills/` |
| `agents` target | `~/.claude/agents/` |

Манифест: [`domains/obsidian/manifest.yaml`](../../../domains/obsidian/manifest.yaml).

Точный состав в любой момент — `bear-skills list`.

## Состав

- **[Правила](rules/README.md)** — 7 правил (структура vault, теги, frontmatter, стиль, именование, плотность)
- **[Скиллы](skills/README.md)** — 18 скиллов (ингест, разбор inbox, untangle hub, дневник, механика хранилища)
- **[Агенты](agents/README.md)** — 5 агентов (`obsidian-inbox-triager`, `obsidian-source-ingester` и др.)

## Установка только этого домена

```bash
export BEAR_VAULT="$HOME/Obsidian/MyVault"
npx github:jtprogru/bear-skills install obsidian
```

## Принципы домена

- Язык: русский, технические термины — английскими
- Обращение «ты» или безличные конструкции
- При пачке изменений в vault — **план → подтверждение → действие → отчёт**
- Не удалять заметки, не создавать «мёртвые» wikilinks, не плодить теги, не изобретать поля frontmatter
- Не терять авторский голос — это личная база, не Wikipedia

Подробнее — в самих файлах правил.
