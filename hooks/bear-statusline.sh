#!/usr/bin/env bash
# Statusline-бейдж bear-skills: показывает, какие домены коллекции активны.
#
# Скрипт читает флаг, записанный hooks/bear-activate.js. Содержимое флага
# приходит из файла в домашнем каталоге, поэтому здесь оно считается
# недоверенным: имена доменов проверяются по whitelist, и ничего кроме
# прошедших проверку строк наружу не печатается.
#
# Скрипт обязан молча завершаться при любой проблеме: statusline вызывается
# на каждую отрисовку, и его падение видно пользователю постоянно.

set -uo pipefail

CLAUDE_HOME="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
FLAG="$CLAUDE_HOME/.bear-active"

# Симлинк вместо флага — отказ. Не читаем то, что кто-то подставил.
[ -L "$FLAG" ] && exit 0
[ -f "$FLAG" ] || exit 0
[ -r "$FLAG" ] || exit 0

raw="$(cat "$FLAG" 2>/dev/null)" || exit 0

# Достаём имена доменов и пропускаем через whitelist. Никаких произвольных
# байтов из файла в вывод не попадает.
domains=""
for d in obsidian git sre content agentops code bear; do
  case "$raw" in
    *"\"$d\""*) domains="${domains:+$domains }$d" ;;
  esac
done

[ -n "$domains" ] || exit 0

count="$(printf '%s' "$domains" | wc -w | tr -d ' ')"
printf '🐻 %s' "$count"
exit 0
