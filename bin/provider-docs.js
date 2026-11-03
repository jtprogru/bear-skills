#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { loadCatalog } = require('./lib/catalog');
const { adapters, compatibility } = require('./lib/providers');
const root = path.resolve(__dirname, '..');

function generate() {
  const catalog = loadCatalog(root), components = [...catalog.components.values()];
  let text = '# Провайдеры и каталог\n\n<!-- GENERATED: node bin/provider-docs.js. Источник: domains/ и bin/lib/providers/. -->\n\n' +
    'Все адаптеры поддерживают global/project и copy/symlink. Матрица проверяется тестами в изолированных каталогах. ' +
    'Запись файлов, проверка формата и загрузка моделью — разные состояния. Подробности: [контракт адаптера](adapter-contract.md), [установка](installation/README.md), [фактические проверки](compatibility.md).\n\n' +
    '| Provider | Skills | Rules | Agents | Commands | Runtime |\n|---|---|---|---|---|---|\n';
  for (const p of adapters) text += '| ' + p.id + ' | ' + ['skills', 'rules', 'agents', 'commands', 'runtime'].map(k => p.capabilities[k]).join(' | ') + ' |\n';
  text += '\n## Состав\n\n| Домен | Skills | Rules | Agents | Commands | Env |\n|---|---:|---:|---:|---:|---|\n';
  for (const d of catalog.domains) {
    text += '| ' + d.name + ' | ' + ['skill', 'rule', 'agent', 'command'].map(k => components.filter(c => c.domain === d.name && c.kind === k).length).join(' | ') +
      ' | ' + (d.requires_env.join(', ') || '—') + ' |\n';
  }
  for (const p of adapters) {
    text += '\n## ' + p.label + '\n\n';
    for (const limit of p.limitations) text += '- ' + limit + '\n';
    const incompatible = components.map(c => ({ c, reason: compatibility(c, p) })).filter(x => x.reason);
    if (incompatible.length) {
      text += '\n| Несовместимый компонент | Причина |\n|---|---|\n';
      for (const { c, reason } of incompatible) text += '| ' + c.id + ' | ' + reason.replace(/\|/g, '/') + ' |\n';
    }
    text += '\nОфициальные источники (сверены 2026-11-02): ' + p.docs.map((url, i) => '[' + (i + 1) + '](' + url + ')').join(', ') + '.\n';
  }
  return text;
}
const file = path.join(root, 'docs/providers.md'), content = generate();
if (process.argv.includes('--check')) {
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== content) {
    console.error('Таблицы устарели: node bin/provider-docs.js'); process.exitCode = 1;
  } else console.log('Таблицы провайдеров и компонентов актуальны.');
} else fs.writeFileSync(file, content);
