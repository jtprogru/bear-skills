#!/usr/bin/env bash
# bear-skills — установка одной командой.
#
#   curl -fsSL https://raw.githubusercontent.com/jtprogru/bear-skills/main/install.sh | bash
#
# Скрипт только доставляет репозиторий и передаёт работу Node: вся логика
# установки живёт в bin/install.js, чтобы не расходиться между платформами.

set -euo pipefail

REPO_URL="${BEAR_SKILLS_REPO:-https://github.com/jtprogru/bear-skills.git}"
SOURCE_DIR="${BEAR_SKILLS_HOME:-$HOME/.bear-skills}"

say() { printf '%s\n' "$*"; }
die() { printf '❌ %s\n' "$*" >&2; exit 1; }

command -v git >/dev/null 2>&1 || die "нужен git"
command -v node >/dev/null 2>&1 || die "нужен Node.js >= 18"

node_major="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$node_major" -lt 18 ]; then
  die "нужен Node.js >= 18, найден $(node -v)"
fi

if [ -d "$SOURCE_DIR/.git" ]; then
  say "📥 Обновляю $SOURCE_DIR"
  git -C "$SOURCE_DIR" pull --ff-only || say "⚠️  git pull не удался, продолжаю с локальной копией"
else
  if [ -e "$SOURCE_DIR" ] && [ -n "$(ls -A "$SOURCE_DIR" 2>/dev/null)" ]; then
    die "$SOURCE_DIR существует и не пустой, но это не git-репозиторий"
  fi
  say "📥 Клонирую $REPO_URL → $SOURCE_DIR"
  git clone --depth 1 "$REPO_URL" "$SOURCE_DIR"
fi

say ""
node "$SOURCE_DIR/bin/install.js" "$@"

say ""
say "Точечная установка по доменам доступна через симлинк-модель:"
say "  node $SOURCE_DIR/bin/cli.js install git sre --source $SOURCE_DIR --no-clone"
