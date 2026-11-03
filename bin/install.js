#!/usr/bin/env node
'use strict';
// Compatibility entrypoint: the same planner, ownership and conflict rules as
// bear-skills install. Only defaults differ (copy + detected providers).
const path = require('node:path');
const { parseArgs, runManaged } = require('./cli');
const { optionsFrom, providers } = require('./lib/installer');
const { adapters, getProvider, detection } = require('./lib/providers');

function main(argv) {
  const args = parseArgs(argv);
  if (args.flags.help) {
    console.log('node bin/install.js [--only claude-code,codex,cursor,opencode] [--all] [--list] [--uninstall] [--dry-run]\nОбщая установка: bear-skills install --provider <id> --scope global|project --mode copy|symlink');
    return;
  }
  const base = { ...args, _: ['install', ...args._], flags: { ...args.flags, mode: args.flags.mode || 'copy', source: args.flags.source || path.resolve(__dirname, '..') } };
  const options = optionsFrom(base);
  if (args.flags.list) return providers(options);
  const selected = args.flags.only
    ? String(args.flags.only).split(',').map(id => getProvider(id.trim()))
    : args.flags.provider ? [getProvider(args.flags.provider)]
      : adapters.filter(p => args.flags.all || detection(p, options).configFound);
  if (!selected.length) { console.log('Не найдено установок. Укажи --only <provider> или --all.'); return; }
  for (const p of selected) runManaged({ _: [args.flags.uninstall ? 'uninstall' : 'install', ...args._], flags: { ...base.flags, provider: p.id } });
}
if (require.main === module) {
  try { main(process.argv.slice(2)); } catch (e) { console.error('❌', e.message); process.exitCode = 1; }
}
module.exports = { main };
