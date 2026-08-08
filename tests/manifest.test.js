'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { parseManifestYaml, expandPath } = require('../bin/cli.js');

const BASE_TARGETS = `
targets:
  rules:  \${CLAUDE_HOME}/rules
  skills: \${CLAUDE_HOME}/skills
  agents: \${CLAUDE_HOME}/agents
`;

test('парсит минимальный манифест', () => {
  const m = parseManifestYaml(`name: demo\ndescription: Демо-домен\n${BASE_TARGETS}`);
  assert.strictEqual(m.name, 'demo');
  assert.strictEqual(m.description, 'Демо-домен');
  assert.deepStrictEqual(m.requires_env, []);
  assert.deepStrictEqual(m.requires_bin, { domain: [], components: {} });
  assert.strictEqual(m.targets.skills, '${CLAUDE_HOME}/skills');
});

test('парсит requires_env списком', () => {
  const m = parseManifestYaml(
    `name: demo\nrequires_env:\n  - BEAR_VAULT\n  - OTHER\n${BASE_TARGETS}`,
  );
  assert.deepStrictEqual(m.requires_env, ['BEAR_VAULT', 'OTHER']);
});

test('requires_bin списком означает требование ко всему домену', () => {
  const m = parseManifestYaml(
    `name: demo\nrequires_bin:\n  - kubectl\n  - helm\n${BASE_TARGETS}`,
  );
  assert.deepStrictEqual(m.requires_bin.domain, ['kubectl', 'helm']);
  assert.deepStrictEqual(m.requires_bin.components, {});
});

test('requires_bin ключом означает требование к перечисленным компонентам', () => {
  const m = parseManifestYaml(
    `name: demo
requires_bin:
  srekit:
    - skill:srekit
    - skill:srekit-runbook
${BASE_TARGETS}`,
  );
  assert.deepStrictEqual(m.requires_bin.domain, []);
  assert.deepStrictEqual(m.requires_bin.components, {
    srekit: ['skill:srekit', 'skill:srekit-runbook'],
  });
});

test('обе формы requires_bin сосуществуют в одном манифесте', () => {
  const m = parseManifestYaml(
    `name: demo
requires_bin:
  - git
  srekit:
    - skill:srekit
${BASE_TARGETS}`,
  );
  assert.deepStrictEqual(m.requires_bin.domain, ['git']);
  assert.deepStrictEqual(m.requires_bin.components, { srekit: ['skill:srekit'] });
});

test('комментарии и пустые строки игнорируются', () => {
  const m = parseManifestYaml(
    `# заголовок\nname: demo   # имя\n\nrequires_env: []\n${BASE_TARGETS}`,
  );
  assert.strictEqual(m.name, 'demo');
  assert.deepStrictEqual(m.requires_env, []);
});

test('манифест без name отвергается', () => {
  assert.throws(() => parseManifestYaml(`description: нет имени\n${BASE_TARGETS}`), /name/);
});

test('манифест без targets отвергается', () => {
  assert.throws(() => parseManifestYaml('name: demo\n'), /targets/);
});

test('пустой список компонентов в requires_bin отвергается', () => {
  assert.throws(
    () => parseManifestYaml(`name: demo\nrequires_bin:\n  srekit:\n${BASE_TARGETS}`),
    /пуст/,
  );
});

test('компонент без префикса skill:/rule:/agent: отвергается', () => {
  assert.throws(
    () =>
      parseManifestYaml(
        `name: demo\nrequires_bin:\n  srekit:\n    - srekit\n${BASE_TARGETS}`,
      ),
    /skill:/,
  );
});

test('expandPath подставляет переменные', () => {
  assert.strictEqual(
    expandPath('${CLAUDE_HOME}/skills', { CLAUDE_HOME: '/tmp/home' }),
    '/tmp/home/skills',
  );
});

test('expandPath падает на незаданной переменной', () => {
  assert.throws(() => expandPath('${NOPE}/skills', {}), /NOPE/);
});
