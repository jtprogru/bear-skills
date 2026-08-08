'use strict';

// Хуки — единственная часть коллекции, способная сломать рабочую сессию.
// Поэтому два свойства проверяются жёстко: symlink-safe запись и молчаливое
// падение при любой проблеме файловой системы.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const ACTIVATE = path.join(REPO_ROOT, 'hooks', 'bear-activate.js');
const STATUSLINE = path.join(REPO_ROOT, 'hooks', 'bear-statusline.sh');
const { safeWrite, safeRead, targetIsSafe } = require('../hooks/lib/safe-write.js');

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bear-hooks-'));
}

// Хук обязан выходить с кодом 0 всегда — иначе он ломает старт сессии.
function runHook(claudeHome) {
  return execFileSync(process.execPath, [ACTIVATE], {
    env: { ...process.env, CLAUDE_CONFIG_DIR: claudeHome },
    encoding: 'utf8',
  });
}

test('safeWrite отказывается писать по симлинку', () => {
  const dir = tmpdir();
  const victim = path.join(dir, 'victim.txt');
  const flag = path.join(dir, '.bear-active');
  fs.writeFileSync(victim, 'ОРИГИНАЛ');
  fs.symlinkSync(victim, flag);

  const ok = safeWrite(flag, 'ПОДМЕНА');

  assert.strictEqual(ok, false, 'запись по симлинку должна быть отклонена');
  assert.strictEqual(fs.readFileSync(victim, 'utf8'), 'ОРИГИНАЛ');
});

test('safeWrite отказывается писать, если родитель — симлинк', () => {
  const dir = tmpdir();
  const real = path.join(dir, 'real');
  const link = path.join(dir, 'link');
  fs.mkdirSync(real);
  fs.symlinkSync(real, link);

  assert.strictEqual(safeWrite(path.join(link, 'flag'), 'x'), false);
  assert.ok(!fs.existsSync(path.join(real, 'flag')), 'файл не должен появиться');
});

test('safeWrite создаёт файл с режимом 0600', () => {
  const dir = tmpdir();
  const flag = path.join(dir, '.bear-active');
  assert.strictEqual(safeWrite(flag, 'данные'), true);
  assert.strictEqual(fs.statSync(flag).mode & 0o777, 0o600);
  assert.strictEqual(safeRead(flag), 'данные');
});

test('safeWrite перезаписывает обычный файл атомарно, без временных остатков', () => {
  const dir = tmpdir();
  const flag = path.join(dir, '.bear-active');
  safeWrite(flag, 'первое');
  safeWrite(flag, 'второе');
  assert.strictEqual(safeRead(flag), 'второе');
  const leftovers = fs.readdirSync(dir).filter((f) => f.endsWith('.tmp'));
  assert.deepStrictEqual(leftovers, [], 'временные файлы должны быть убраны');
});

test('targetIsSafe: нет файла — можно писать, симлинк — нельзя', () => {
  const dir = tmpdir();
  assert.strictEqual(targetIsSafe(path.join(dir, 'нет-такого')), true);
  fs.symlinkSync(path.join(dir, 'нет-такого'), path.join(dir, 'ссылка'));
  assert.strictEqual(targetIsSafe(path.join(dir, 'ссылка')), false);
});

test('хук молчит, когда ничего не установлено', () => {
  const dir = tmpdir();
  assert.strictEqual(runHook(dir), '', 'без скиллов контракт инжектить не нужно');
});

test('хук инжектит контракт, когда скиллы есть', () => {
  const dir = tmpdir();
  fs.mkdirSync(path.join(dir, 'skills', 'git-conventional-commit'), { recursive: true });
  const out = runHook(dir);
  assert.match(out, /<bear-skills>/);
  assert.match(out, /план → подтверждение → действие → отчёт/);
});

test('хук пишет флаг с распознанными доменами', () => {
  const dir = tmpdir();
  for (const s of ['git-conventional-commit', 'srekit-runbook', 'agentops-compress']) {
    fs.mkdirSync(path.join(dir, 'skills', s), { recursive: true });
  }
  runHook(dir);
  const flag = JSON.parse(fs.readFileSync(path.join(dir, '.bear-active'), 'utf8'));
  assert.deepStrictEqual(flag.domains, ['agentops', 'git', 'sre']);
  assert.strictEqual(flag.active, true);
});

test('хук не падает и не пишет по подменённому симлинку', () => {
  const dir = tmpdir();
  fs.mkdirSync(path.join(dir, 'skills', 'git-conventional-commit'), { recursive: true });
  const victim = path.join(dir, 'victim.txt');
  fs.writeFileSync(victim, 'ОРИГИНАЛ');
  fs.symlinkSync(victim, path.join(dir, '.bear-active'));

  // Не должно бросить: execFileSync выбросил бы при ненулевом коде выхода.
  runHook(dir);

  assert.strictEqual(fs.readFileSync(victim, 'utf8'), 'ОРИГИНАЛ');
});

test('хук выходит с кодом 0 при нечитаемом каталоге', () => {
  // Путь заведомо невалиден: под ним файл, а не каталог.
  const out = execFileSync(process.execPath, [ACTIVATE], {
    env: { ...process.env, CLAUDE_CONFIG_DIR: '/dev/null/не-каталог' },
    encoding: 'utf8',
  });
  assert.strictEqual(out, '');
});

test('statusline печатает бейдж по флагу', () => {
  const dir = tmpdir();
  fs.writeFileSync(
    path.join(dir, '.bear-active'),
    JSON.stringify({ active: true, domains: ['git', 'sre'] }),
  );
  const out = execFileSync('bash', [STATUSLINE], {
    env: { ...process.env, CLAUDE_CONFIG_DIR: dir },
    encoding: 'utf8',
  });
  assert.strictEqual(out, '🐻 2');
});

test('statusline не печатает произвольные байты из флага', () => {
  // Содержимое флага недоверенное: оно приходит из файла в домашнем каталоге.
  const dir = tmpdir();
  fs.writeFileSync(
    path.join(dir, '.bear-active'),
    JSON.stringify({ domains: ['git', '$(touch /tmp/pwned)', '<script>'] }),
  );
  const out = execFileSync('bash', [STATUSLINE], {
    env: { ...process.env, CLAUDE_CONFIG_DIR: dir },
    encoding: 'utf8',
  });
  assert.strictEqual(out, '🐻 1', 'наружу проходит только whitelist');
});

test('statusline молчит при симлинке вместо флага', () => {
  const dir = tmpdir();
  fs.writeFileSync(path.join(dir, 'victim.txt'), 'x');
  fs.symlinkSync(path.join(dir, 'victim.txt'), path.join(dir, '.bear-active'));
  const out = execFileSync('bash', [STATUSLINE], {
    env: { ...process.env, CLAUDE_CONFIG_DIR: dir },
    encoding: 'utf8',
  });
  assert.strictEqual(out, '');
});

test('statusline молчит, когда флага нет', () => {
  const out = execFileSync('bash', [STATUSLINE], {
    env: { ...process.env, CLAUDE_CONFIG_DIR: tmpdir() },
    encoding: 'utf8',
  });
  assert.strictEqual(out, '');
});
