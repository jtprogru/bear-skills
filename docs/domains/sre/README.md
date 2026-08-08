# Домен `sre`

SRE / Kubernetes — incident-management, runbooks, диагностика k8s от симптома к причине.

| Поле | Значение |
|------|----------|
| `requires_env` | — |
| `requires_bin` | `srekit` — только для скиллов `srekit*`, остальной домен ставится без него |
| `rules` target | `~/.claude/rules/` |
| `skills` target | `~/.claude/skills/` |
| `agents` target | `~/.claude/agents/` |

Манифест: [`domains/sre/manifest.yaml`](../../../domains/sre/manifest.yaml).

## Состав

### Правила

| Правило | Что внутри |
|---------|-----------|
| `sre-incident-severity` | Шкала SEV-1..SEV-4, контракт реакции, политика постмортемов |
| `sre-runbook-template` | Структура и принципы исполняемых runbook'ов |

### Скиллы

| Скилл | Что делает | Когда вызывать |
|-------|------------|----------------|
| `sre-k8s-triage` | Систематическая диагностика Pod/Deployment/Service по симптому | «под падает», «не стартует», «pod в CrashLoopBackOff» |
| `srekit-postmortem` | Blameless-постмортем через `srekit postmortem`: timeline, impact, root cause, action items | «написать постмортем», «разобрать инцидент» |
| `srekit-runbook` | Runbook через `srekit runbook` — symptoms, diagnose, mitigate, verify | «написать runbook», «инструкцию для дежурного» |
| `srekit` | Остальные SRE-артефакты: investigation log, RFC/ADR, SLO, error budget policy, capacity plan, retro, on-call report | «завести ADR», «оформить SLO», «сделать retro» |

Три последних требуют CLI `srekit` в `PATH`. Без него они не устанавливаются, а `sre-k8s-triage`, правила и агент — ставятся как обычно.

### Агенты

- **`sre-oncall-engineer`** — оркестратор on-call реакции: алерт → триаж severity → митигация → resolved → постмортем.

## Установка только этого домена

```bash
npx github:jtprogru/bear-skills install sre
```

Для скиллов `srekit*` нужен CLI:

```bash
brew install jtprogru/tap/srekit
# или
go install github.com/jtprogru/srekit@latest
```

Проверить, что домен видит бинарь: `bear-skills list` покажет `✅ bin "srekit"` или `❌`.

## Принципы

- **Митигация раньше, чем root cause.** Откатить, перевести трафик, отключить флаг.
- **Постмортем blameless.** «Человеческая ошибка» — это никогда не root cause.
- **Не геройствуй на SEV-1 в одиночку.** Зови второго инженера сразу.
- **Не объявляй resolved преждевременно.** Минимум 15 минут стабильности после митигации.
- **Команды в runbook'ах — копипастабельны.** Никаких `<your-cluster>` без объяснения.

Подробнее — в правилах `sre-incident-severity` и `sre-runbook-template`.
