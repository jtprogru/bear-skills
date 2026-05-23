# bear-skills — мульти-доменная коллекция правил, скиллов и агентов для Claude Code.
#
# Каждый домен в domains/<name>/ имеет свой manifest.yaml, описывающий
# requires_env и куда ставить rules/skills/agents (см. domains/<name>/manifest.yaml).
#
# Развёртывание делается симлинками через bin/cli.js — правишь в репо, изменения
# сразу видны в Claude Code.

SHELL          := /bin/bash
REPO_ROOT      := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))

# Опциональные переменные:
#   VAULT/BEAR_VAULT — путь к Obsidian vault (нужен только obsidian-домену)
#   CLAUDE_HOME     — путь к ~/.claude
VAULT          ?= $(BEAR_VAULT)
CLAUDE_HOME    ?= $(HOME)/.claude

CLI            := node "$(REPO_ROOT)/bin/cli.js"
CLI_OPTS       := --source "$(REPO_ROOT)" --no-clone --claude-home "$(CLAUDE_HOME)"
ifneq ($(VAULT),)
  CLI_OPTS     := $(CLI_OPTS) --vault "$(VAULT)"
endif

.PHONY: help install uninstall sync status list check install-one uninstall-one

help:
	@echo "bear-skills — make targets"
	@echo ""
	@echo "Полная установка:"
	@echo "  install            Развернуть все домены, у которых выполнены requires_env"
	@echo "  uninstall          Снять все симлинки"
	@echo "  sync               Пересоздать (uninstall + install)"
	@echo ""
	@echo "Точечная установка:"
	@echo '  install-one        ARGS="obsidian git" или ARGS="skill:obsidian-ingest"'
	@echo '  uninstall-one      ARGS="skill:obsidian-untangle-knot"'
	@echo ""
	@echo "Информация:"
	@echo "  list               Список всех доменов и компонентов"
	@echo "  status             Что развёрнуто и куда (по доменам)"
	@echo "  check              Валидация манифестов и фронтматтера"
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
