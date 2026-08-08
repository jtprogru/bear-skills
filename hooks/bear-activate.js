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

// Контракт держим здесь, а не читаем из AGENTS.md: файл в репозитории может
// уехать вместе с репозиторием, а хук должен работать и без него.
const CONTRACT = `<bear-skills>
Протокол работы: план → подтверждение → действие → отчёт. Необратимое действие
(push, tag, delete, публикация, отправка) — только после явного «делай».

Язык русский, технические термины английские. Обращение «ты» или безличное.

Не выдумывай числа, имена и команды: не хватает данных — спроси. Не пиши
«человеческая ошибка» как причину сбоя. Не теряй авторский голос.
</bear-skills>`;

function detectDomains() {
  const skillsDir = path.join(CLAUDE_HOME, 'skills');
  const domains = new Set();
  try {
    for (const name of fs.readdirSync(skillsDir)) {
      const m = name.match(/^(obsidian|git|sre|content|agentops|code|bear)-/);
      if (m) domains.add(m[1]);
      else if (name.startsWith('srekit')) domains.add('sre');
      else if (name === 'book-highlights-processor') domains.add('obsidian');
    }
  } catch {
    /* каталога нет — вернём пусто */
  }
  return [...domains].sort();
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

  process.stdout.write(`${CONTRACT}\n`);
}

try {
  main();
} catch {
  // Намеренно пусто: хук не имеет права сломать старт сессии.
}
process.exit(0);
