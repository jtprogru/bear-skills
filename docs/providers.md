# Провайдеры и каталог

<!-- GENERATED: node bin/provider-docs.js. Источник: domains/ и bin/lib/providers/. -->

Все адаптеры поддерживают global/project и copy/symlink. Матрица проверяется тестами в изолированных каталогах. Запись файлов, проверка формата и загрузка моделью — разные состояния. Подробности: [контракт адаптера](adapter-contract.md), [установка](installation/README.md), [фактические проверки](compatibility.md).

| Provider | Skills | Rules | Agents | Commands | Runtime |
|---|---|---|---|---|---|
| claude-code | native | native | native | native | SessionStart |
| codex | native | references + hook index | TOML (permissions limited) | explicit skills | SessionStart |
| cursor | native | MDC (global via hook index) | native (permissions limited) | native | sessionStart |
| opencode | native | instructions index | native + mode | native | local plugin |

## Состав

| Домен | Skills | Rules | Agents | Commands | Env |
|---|---:|---:|---:|---:|---|
| agentops | 4 | 1 | 3 | 0 | — |
| analysis | 1 | 0 | 4 | 0 | — |
| bear | 4 | 0 | 0 | 3 | — |
| code | 4 | 0 | 0 | 0 | — |
| content | 4 | 3 | 1 | 0 | — |
| git | 5 | 1 | 1 | 0 | — |
| obsidian | 19 | 7 | 6 | 0 | BEAR_VAULT |
| sre | 4 | 2 | 1 | 0 | — |
| teach | 1 | 0 | 0 | 0 | — |
| telegram | 1 | 0 | 0 | 0 | — |

## Claude Code

- Project hooks требуют доверия workspace; installer не выдаёт разрешений.

Официальные источники (сверены 2026-11-02): [1](https://code.claude.com/docs/en/skills), [2](https://code.claude.com/docs/en/sub-agents), [3](https://code.claude.com/docs/en/hooks).

## Codex

- Нет отдельного native rules-каталога: ссылки скиллов и индекс через hook.
- Агенты с tools/hooks/permissionMode несовместимы: sandbox и разрешения наследуются от родителя.
- Hooks требуют ручного trust в /hooks; installer его не устанавливает.

| Несовместимый компонент | Причина |
|---|---|
| agent:bear-locator | невозможно сохранить native tools allowlist этого агента |
| agent:bear-reviewer | невозможно сохранить native tools allowlist этого агента |
| agent:bear-surgeon | невозможно сохранить native tools allowlist этого агента |
| agent:business-analyst | невозможно сохранить native tools allowlist этого агента |
| agent:product-owner | невозможно сохранить native tools allowlist этого агента |
| agent:security-reviewer | неподдерживаемые обязательные поля: hooks |
| agent:system-analyst | невозможно сохранить native tools allowlist этого агента |
| skill:bear-stats | статистика вызовов реализована только для session logs Claude Code |
| command:bear-stats | статистика вызовов реализована только для session logs Claude Code |
| agent:obsidian-task-keeper | невозможно сохранить native tools allowlist этого агента |

Официальные источники (сверены 2026-11-02): [1](https://learn.chatgpt.com/docs/build-skills), [2](https://learn.chatgpt.com/docs/agent-configuration/subagents), [3](https://learn.chatgpt.com/docs/hooks).

## Cursor

- Global .mdc подключаются ссылками из sessionStart: автоматические project glob rules доступны только project scope.
- Произвольные agent tools allowlist и agent-local hooks не переносятся; компонент отмечается несовместимым.

| Несовместимый компонент | Причина |
|---|---|
| agent:bear-locator | невозможно сохранить native tools allowlist этого агента |
| agent:bear-reviewer | невозможно сохранить native tools allowlist этого агента |
| agent:bear-surgeon | невозможно сохранить native tools allowlist этого агента |
| agent:business-analyst | невозможно сохранить native tools allowlist этого агента |
| agent:product-owner | невозможно сохранить native tools allowlist этого агента |
| agent:security-reviewer | неподдерживаемые обязательные поля: hooks |
| agent:system-analyst | невозможно сохранить native tools allowlist этого агента |
| skill:bear-stats | статистика вызовов реализована только для session logs Claude Code |
| command:bear-stats | статистика вызовов реализована только для session logs Claude Code |
| agent:obsidian-task-keeper | невозможно сохранить native tools allowlist этого агента |

Официальные источники (сверены 2026-11-02): [1](https://cursor.com/docs/plugins), [2](https://cursor.com/docs/skills), [3](https://cursor.com/docs/rules), [4](https://cursor.com/docs/subagents), [5](https://cursor.com/docs/hooks).

## OpenCode

- Agent-local Claude hooks не переносятся; компонент отмечается несовместимым.
- Plugin подключает общий контракт и индекс через native instructions; все правила сразу не инжектируются.

| Несовместимый компонент | Причина |
|---|---|
| agent:security-reviewer | неподдерживаемые обязательные поля: hooks |
| skill:bear-stats | статистика вызовов реализована только для session logs Claude Code |
| command:bear-stats | статистика вызовов реализована только для session logs Claude Code |
| agent:obsidian-task-keeper | OpenCode объединяет Write/Edit в permission edit; точный allowlist не сохраняется |
| skill:teach-ru | manual-only skill не поддерживается native skill loader OpenCode |

Официальные источники (сверены 2026-11-02): [1](https://opencode.ai/docs/skills/), [2](https://opencode.ai/docs/agents/), [3](https://opencode.ai/docs/commands/), [4](https://opencode.ai/docs/plugins/).
