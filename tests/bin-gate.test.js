'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { hasBin, blockedByMissingBin, applyBinGate } = require('../bin/cli.js');

// Домен-заглушка: гейт работает с данными манифеста, файловая система не нужна.
function domain(components) {
  return { name: 'demo', requires_bin: { domain: [], components } };
}

test('hasBin находит заведомо существующий бинарь', () => {
  assert.strictEqual(hasBin('node'), true);
});

test('hasBin не находит несуществующий', () => {
  assert.strictEqual(hasBin('заведомо-нет-такого-бинаря-12345'), false);
});

test('доступный бинарь ничего не блокирует', () => {
  const blocked = blockedByMissingBin(domain({ node: ['skill:a'] }));
  assert.strictEqual(blocked.size, 0);
});

test('недоступный бинарь блокирует свои компоненты', () => {
  const blocked = blockedByMissingBin(
    domain({ 'нет-такого-бинаря-98765': ['skill:a', 'agent:b'] }),
  );
  assert.strictEqual(blocked.size, 2);
  assert.strictEqual(blocked.get('skill:a'), 'нет-такого-бинаря-98765');
  assert.strictEqual(blocked.get('agent:b'), 'нет-такого-бинаря-98765');
});

test('пустой гейт возвращает выбор нетронутым', () => {
  const picked = { rules: ['r'], skills: ['s'], agents: ['a'] };
  const res = applyBinGate(picked, new Map());
  assert.deepStrictEqual(res.picked, picked);
  assert.deepStrictEqual(res.dropped, []);
});

test('гейт выкидывает только заблокированное, остальное остаётся', () => {
  const picked = {
    rules: ['sre-runbook-template'],
    skills: ['sre-k8s-triage', 'srekit', 'srekit-runbook'],
    agents: ['sre-oncall-engineer'],
  };
  const blocked = new Map([
    ['skill:srekit', 'srekit'],
    ['skill:srekit-runbook', 'srekit'],
  ]);
  const res = applyBinGate(picked, blocked);

  assert.deepStrictEqual(res.picked.skills, ['sre-k8s-triage']);
  assert.deepStrictEqual(res.picked.rules, ['sre-runbook-template']);
  assert.deepStrictEqual(res.picked.agents, ['sre-oncall-engineer']);
  assert.strictEqual(res.dropped.length, 2);
  assert.deepStrictEqual(
    res.dropped.map((d) => d.key).sort(),
    ['skill:srekit', 'skill:srekit-runbook'],
  );
});

test('гейт различает категории с одинаковым именем', () => {
  const picked = { rules: ['x'], skills: ['x'], agents: ['x'] };
  const blocked = new Map([['skill:x', 'foo']]);
  const res = applyBinGate(picked, blocked);
  assert.deepStrictEqual(res.picked.skills, []);
  assert.deepStrictEqual(res.picked.rules, ['x']);
  assert.deepStrictEqual(res.picked.agents, ['x']);
});
