---
name: vault-stats
description: "Статистика хранилища, поиск мёртвых заметок через `.agents/scripts/vault_stats_*.py` и справка по фоновой автоматизации (launchd-агенты weekly/monthly-distillate). Используй на «какие заметки бесполезны», «статистика базы», «мёртвые заметки», «посчитай связность», «что там собирает weekly по расписанию»."
---

# Статистика хранилища и поиск мёртвых заметок

Набор `.agents/scripts/vault_stats_*.py` считает сигналы «мёртвости» заметки. Запускается по явному запросу («какие заметки бесполезны», «статистика базы»), в рабочем цикле не участвует. Промежуточные файлы кладутся в каталог из `VAULT_STATS_OUT` (по умолчанию временный). Заметок скрипты не трогают; единственное исключение — `calibrate`, который перезаписывает `.agents/scripts/vault_stats_weights.json`, то есть меняет поведение скоринга при следующих прогонах. Флага «только посчитать» у него нет, откат — через git.

```bash
python3 .agents/scripts/vault_stats_graph.py    # связность, плотность, частота правок, композитный скор
python3 .agents/scripts/vault_stats_lexdup.py   # вычитание шаблонного каркаса + текстовые дубли
python3 .agents/scripts/vault_stats_embed.py    # эмбеддинги заметок через LM Studio
uv run --with numpy .agents/scripts/vault_stats_semdup.py     # семантические дубли и изоляты
uv run --with numpy .agents/scripts/vault_stats_calibrate.py  # веса по git-удалениям → weights.json
```

Порядок обязателен: каждый шаг читает выхлоп предыдущих. `embed` требует поднятого LM Studio с той же моделью, что в `OPENAI_EMBEDDING_MODEL` из `.mcp.json`. `calibrate` пишет `weights.json`, который `graph` подхватывает автоматически при следующем прогоне.

Исключения задаются слоями: встроенные умолчания → `OBSIDIAN_IGNORE_PATTERNS` из `.mcp.json` → `VAULT_STATS_IGNORE`/`VAULT_STATS_UNIGNORE` → флаги `--ignore`/`--unignore`/`--no-score`. Из патернов MCP по умолчанию вычитаются `04. Архив/**` и `05. Дневник/**` — поиску они не нужны, статистике нужны. `--show-config` печатает итог.

Метод, ограничения каждого сигнала и способ калибровки описаны в заметке [[Мёртвая заметка опознаётся пересечением сигналов, а не одним]] и в шапках скриптов. Скор ранжирует список на разбор, а не выносит приговор.

## Автоматизация

`_Система/scripts/weekly-distillate.sh` — headless `claude -p`, собирает черновик weekly из ежедневных заметок завершившейся недели. Запускается launchd-агентом `ru.jtprog.weekly-distillate` (пн 08:04), лог — `~/Library/Logs/weekly-distillate.log`. `_Система/scripts/monthly-distillate.sh` — аналогично собирает черновик monthly из weekly-заметок завершившегося месяца; launchd-агент `ru.jtprog.monthly-distillate` (1-е число, 08:12), лог — `~/Library/Logs/monthly-distillate.log`. Руками дёргать не нужно. `.agents/scripts/excalidraw_migration.py` — разовый миграционный скрипт, в рабочем цикле не участвует.
