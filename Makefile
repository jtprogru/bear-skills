# bear-skills — общий каталог и адаптеры AI-инструментов.
#
# Каждый домен в domains/<name>/ имеет свой manifest.yaml, описывающий
# requires_env и куда ставить rules/skills/agents (см. domains/<name>/manifest.yaml).
#
# Развёртывание: bin/cli.js; generated-файлы обновляются через sync.

SHELL          := /bin/bash
REPO_ROOT      := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))

# Опциональные переменные:
#   VAULT/BEAR_VAULT — путь к Obsidian vault (нужен только obsidian-домену)
#   CLAUDE_HOME     — путь к ~/.claude
VAULT          ?= $(BEAR_VAULT)
CLAUDE_HOME    ?= $(HOME)/.claude

CLI            := node "$(REPO_ROOT)/bin/cli.js"
PROVIDER       ?= claude-code
SCOPE          ?= global
MODE           ?= symlink
PROJECT        ?=
CLI_OPTS       := --source "$(REPO_ROOT)" --no-clone --provider "$(PROVIDER)" --scope "$(SCOPE)" --mode "$(MODE)"
ifeq ($(SCOPE),global)
ifeq ($(PROVIDER),claude-code)
  CLI_OPTS += --claude-home "$(CLAUDE_HOME)"
endif
endif
ifneq ($(PROJECT),)
  CLI_OPTS += --project "$(PROJECT)"
endif
ifneq ($(VAULT),)
  CLI_OPTS     := $(CLI_OPTS) --vault "$(VAULT)"
endif

.PHONY: help install uninstall sync status list check lock-check mirror mirror-check test evals install-one uninstall-one

help:
	@echo "bear-skills — make targets"
	@echo ""
	@echo "Полная установка:"
	@echo "  install            Развернуть все домены, у которых выполнены requires_env"
	@echo "  uninstall          Удалить по описи, сохранить ручные правки"
	@echo "  sync               Обновить управляемые файлы"
	@echo ""
	@echo "Точечная установка:"
	@echo '  install-one        ARGS="obsidian git" или ARGS="skill:obsidian-ingest"'
	@echo '  uninstall-one      ARGS="skill:obsidian-untangle-knot"'
	@echo ""
	@echo "Информация:"
	@echo "  list               Список всех доменов и компонентов"
	@echo "  status             Что развёрнуто и куда (по доменам)"
	@echo "  check              Валидация манифестов и фронтматтера"
	@echo "  lock-check         Сверка skills-lock.json с чужими скиллами на диске"
	@echo ""
	@echo "Разработка:"
	@echo "  mirror             Пересобрать плоское зеркало skills/ agents/ rules/"
	@echo "  mirror-check       Проверить, что зеркало не разошлось с domains/"
	@echo "  test               Прогнать тесты (node --test)"
	@echo '  evals              Трёхрукий прогон evals (ARGS="--list" / "--dry-run")'
	@echo ""
	@echo "Опциональные переменные:"
	@echo "  VAULT              Путь к Obsidian vault (или env BEAR_VAULT) — нужен obsidian-домену"
	@echo "  CLAUDE_HOME=$(CLAUDE_HOME)"
	@echo ""
	@echo "Примеры:"
	@echo '  make install VAULT="$$HOME/Obsidian/MyVault"'
	@echo '  make install-one ARGS="git"'
	@echo '  make install-one ARGS="skill:obsidian-ingest" VAULT=...'

install:
	@$(CLI) install $(CLI_OPTS)

uninstall:
	@$(CLI) uninstall $(CLI_OPTS)

sync:
	@$(CLI) sync $(CLI_OPTS)

status:
	@$(CLI) status $(CLI_OPTS)

list:
	@$(CLI) list --source "$(REPO_ROOT)" --no-clone

check:
	@$(CLI) check --source "$(REPO_ROOT)" --no-clone
	@node "$(REPO_ROOT)/bin/provider-docs.js" --check

lock-check:
	@$(CLI) lock-check --source "$(REPO_ROOT)" --no-clone

mirror:
	@node "$(REPO_ROOT)/bin/mirror.js"

mirror-check:
	@node "$(REPO_ROOT)/bin/mirror.js" --check

test:
	@node --test "$(REPO_ROOT)"/tests/*.test.js

evals:
	@node "$(REPO_ROOT)/bin/evals.js" $(ARGS)

install-one:
	@if [ -z "$(ARGS)" ]; then \
		echo "❌ ARGS не задан. Пример: make install-one ARGS=\"git\" или ARGS=\"skill:obsidian-ingest\""; \
		exit 1; \
	fi
	@$(CLI) install $(ARGS) $(CLI_OPTS)

uninstall-one:
	@if [ -z "$(ARGS)" ]; then \
		echo "❌ ARGS не задан. Пример: make uninstall-one ARGS=\"skill:obsidian-untangle-knot\""; \
		exit 1; \
	fi
	@$(CLI) uninstall $(ARGS) $(CLI_OPTS)
