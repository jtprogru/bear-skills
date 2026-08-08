'use strict';

// Проверки самого репозитория: домены валидны, имена не конфликтуют,
// зеркало соответствует источнику. Ловят рассинхрон до публикации.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const {
  loadAllDomains,
  listDomainComponents,
  readFrontmatter,
} = require('../bin/cli.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const domains = loadAllDomains(REPO_ROOT);

test('домены находятся', () => {
  assert.ok(domains.length > 0, 'ни одного домена в domains/');
});

test('у каждого скилла есть SKILL.md с валидным фронтматтером', () => {
  for (const d of domains) {
    for (const name of listDomainComponents(d).skills) {
      const file = path.join(d.skillsSrc, name, 'SKILL.md');
      assert.ok(fs.existsSync(file), `${d.name}/${name}: нет SKILL.md`);
      const r = readFrontmatter(file);
      assert.ok(r.ok, `${d.name}/${name}: ${r.error}`);
    }
  }
});

test('у каждого скилла есть README.md для человека', () => {
  // SKILL.md — промпт для модели, README.md — объяснение для того, кто листает
  // GitHub. Документы разные по аудитории, поэтому нужны оба.
  for (const d of domains) {
    for (const name of listDomainComponents(d).skills) {
      const readme = path.join(d.skillsSrc, name, 'README.md');
      assert.ok(fs.existsSync(readme), `${d.name}/${name}: нет README.md`);
      const text = fs.readFileSync(readme, 'utf8');
      assert.ok(text.length > 200, `${d.name}/${name}: README.md подозрительно пустой`);
    }
  }
});

test('имя в фронтматтере совпадает с именем каталога', () => {
  for (const d of domains) {
    for (const name of listDomainComponents(d).skills) {
      const text = fs.readFileSync(path.join(d.skillsSrc, name, 'SKILL.md'), 'utf8');
      const m = text.match(/^name:\s*(.+)$/m);
      assert.ok(m, `${d.name}/${name}: не нашёл поле name`);
      assert.strictEqual(
        m[1].trim().replace(/^["']|["']$/g, ''),
        name,
        `${d.name}/${name}: имя во фронтматтере не совпадает с каталогом`,
      );
    }
  }
});

test('у каждого агента валидный фронтматтер', () => {
  for (const d of domains) {
    for (const name of listDomainComponents(d).agents) {
      const r = readFrontmatter(path.join(d.agentsSrc, `${name}.md`));
      assert.ok(r.ok, `${d.name}/${name}: ${r.error}`);
    }
  }
});

test('имена компонентов уникальны по всем доменам', () => {
  // Плоское зеркало и общий ~/.claude/skills/ не различают домены:
  // одноимённые компоненты затрут друг друга.
  for (const kind of ['skills', 'agents', 'rules']) {
    const seen = new Map();
    for (const d of domains) {
      for (const name of listDomainComponents(d)[kind]) {
        assert.ok(
          !seen.has(name),
          `${kind}: "${name}" есть и в ${seen.get(name)}, и в ${d.name}`,
        );
        seen.set(name, d.name);
      }
    }
  }
});

test('requires_bin ссылается только на существующие компоненты', () => {
  for (const d of domains) {
    const all = listDomainComponents(d);
    const known = new Set([
      ...all.rules.map((n) => `rule:${n}`),
      ...all.skills.map((n) => `skill:${n}`),
      ...all.agents.map((n) => `agent:${n}`),
    ]);
    for (const [bin, items] of Object.entries(d.requires_bin.components)) {
      for (const it of items) {
        assert.ok(known.has(it), `${d.name}: requires_bin.${bin} → нет компонента ${it}`);
      }
    }
  }
});

test('зеркало совпадает с domains/', () => {
  // Если тест упал — источник правды изменили, а зеркало не пересобрали.
  // Починка: node bin/mirror.js
  const res = execFileSync(process.execPath, [path.join(REPO_ROOT, 'bin', 'mirror.js'), '--check'], {
    encoding: 'utf8',
  });
  assert.match(res, /Зеркало актуально/);
});

test('skills-lock.json валиден и содержит обязательные поля', () => {
  const lockPath = path.join(REPO_ROOT, 'skills-lock.json');
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  assert.ok(Array.isArray(lock.skills), 'skills не массив');
  for (const s of lock.skills) {
    assert.ok(s.name, 'запись без name');
    assert.ok(s.source, `${s.name}: нет source`);
    assert.match(s.sha256, /^[0-9a-f]{64}$/, `${s.name}: невалидный sha256`);
  }
});

test('в lock нет скиллов, которые уже перенесены в domains/', () => {
  const lock = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'skills-lock.json'), 'utf8'),
  );
  const ours = new Set();
  for (const d of domains) {
    for (const n of listDomainComponents(d).skills) ours.add(n);
  }
  for (const s of lock.skills) {
    assert.ok(
      !ours.has(s.name),
      `${s.name} есть и в domains/, и в skills-lock.json — что-то одно лишнее`,
    );
  }
});
