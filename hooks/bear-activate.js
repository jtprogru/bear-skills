#!/usr/bin/env node
/* eslint-disable no-console */

// SessionStart-хук: инжектит общий контракт работы и пишет флаг для statusline.
//
// Что инжектится: ТОЛЬКО общий контракт из AGENTS.md — протокол, язык и тон,
// чего не делать. Не все правила подряд: правила домена читает скилл, когда
// срабатывает, и дублировать их в каждой сессии значит платить за них всегда.
//
// Главное свойство: хук обязан молча падать. Любая ошибка — выходим с кодом 0
// и пустым выводом. Сломанный хук на SessionStart ломает каждую сессию, и
// цена этого несопоставима с ценой неинжектированного контракта.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { safeWrite } = require('./lib/safe-write.js');

const HOME = os.homedir();
const CLAUDE_HOME = process.env.CLAUDE_CONFIG_DIR || path.join(HOME, '.claude');
const FLAG_PATH = path.join(CLAUDE_HOME, '.bear-active');

// Единственный источник контракта общий для plugin и всех CLI-адаптеров.
function detectDomains() {
  const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, 'catalog.json'), 'utf8'));
  const inventoryPath = path.join(CLAUDE_HOME, '.bear-skills', 'installation.json');
  if (fs.existsSync(inventoryPath)) {
    const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
    return [...new Set(Object.values(inventory.components).map(c => c.domain))].sort();
  }
  const root = process.env.CLAUDE_PLUGIN_ROOT || CLAUDE_HOME;
  return [...new Set(Object.values(catalog).filter(c =>
    fs.existsSync(path.join(root, c.kind + 's', c.name + (c.kind === 'skill' ? '' : '.md')))
  ).map(c => c.domain))].sort();
}

function main() {
  const domains = detectDomains();

  // Флаг для statusline. Ничего секретного, только имена доменов —
  // строка попадёт в чужой скрипт, поэтому фильтруем по whitelist.
  const safeDomains = domains.filter((d) => /^[a-z]{3,10}$/.test(d));
  safeWrite(
    FLAG_PATH,
    `${JSON.stringify({ active: true, domains: safeDomains, at: new Date().toISOString() })}\n`,
  );

  // Ничего не установлено — молчим. Инжектить контракт коллекции в сессию,
  // где её нет, значит тратить токены на чужой проект.
  if (safeDomains.length === 0) return;

  process.stdout.write(fs.readFileSync(path.join(__dirname, '..', 'runtime', 'contract.md'), 'utf8'));
}

try {
  main();
} catch {
  // Намеренно пусто: хук не имеет права сломать старт сессии.
}
process.exit(0);
