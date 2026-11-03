'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { loadCatalog } = require('../bin/lib/catalog');
const { layout } = require('../bin/lib/providers');
const { optionsFrom } = require('../bin/lib/installer');

const REPO = path.resolve(__dirname, '..'), CLI = path.join(REPO, 'bin/cli.js');
const nativeProviders = ['claude-code', 'codex', 'cursor', 'opencode'];
function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
function fixture(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bear-provider-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const home = path.join(root, 'home'), project = path.join(root, 'project'), source = path.join(root, 'source');
  fs.mkdirSync(home); fs.mkdirSync(project);
  const domain = path.join(source, 'domains/demo');
  write(path.join(domain, 'manifest.yaml'), 'name: demo\ndescription: Demo\nrequires_env: []\ntargets:\n  skills: unused\n' +
    'dependencies:\n  skill:demo:\n    - rule:demo\n  agent:demo:\n    - skill:demo\nrequires_mcp:\n  telegram:tg_me:\n    - skill:demo\n');
  write(path.join(domain, 'rules/demo.md'), '# Правило\nСохрани голос автора.\n');
  write(path.join(domain, 'skills/demo/SKILL.md'), '---\nname: demo\ndescription: Demo skill\n---\nПрочитай {{rule:demo}} и [reference](references/help.md). Запусти scripts/check.cjs.\n');
  write(path.join(domain, 'skills/demo/references/help.md'), 'Подробности; правило: {{rule:demo}}\n');
  write(path.join(domain, 'skills/demo/scripts/check.cjs'), '#!/usr/bin/env node\nconsole.log("reference-ok");\n');
  fs.chmodSync(path.join(domain, 'skills/demo/scripts/check.cjs'), 0o755);
  write(path.join(domain, 'skills/demo/assets/data.bin'), Buffer.from([0, 255, 1]));
  write(path.join(domain, 'agents/demo.md'), '---\nname: demo\ndescription: Demo agent\nmodel: haiku\n---\nИспользуй {{skill:demo}}/SKILL.md.\n');
  write(path.join(domain, 'commands/demo.md'), '---\ndescription: Demo command\n---\nПокажи данные.\n');
  fs.cpSync(path.join(REPO, 'runtime'), path.join(source, 'runtime'), { recursive: true });
  return { root, home, project, source, domain };
}
function args(f, provider = 'claude-code', scope = 'global', mode = 'copy') {
  return ['--source', f.source, '--home', f.home, '--provider', provider, '--scope', scope, '--mode', mode,
    ...(scope === 'project' ? ['--project', f.project] : []), '--json'];
}
function run(f, command, extra = [], provider = 'claude-code', scope = 'global', mode = 'copy', expected = 0) {
  const result = spawnSync(process.execPath, [CLI, command, ...extra, ...args(f, provider, scope, mode)], {
    encoding: 'utf8', cwd: f.project, env: { ...process.env, HOME: f.home, BEAR_VAULT: '', XDG_CONFIG_HOME: path.join(f.home, '.config') } });
  assert.equal(result.status, expected, result.stderr + result.stdout);
  return result.stdout ? JSON.parse(result.stdout) : null;
}
function loc(f, provider = 'claude-code', scope = 'global', mode = 'copy') {
  return layout(optionsFrom({ _: ['install'], flags: { source: f.source, home: f.home, provider, scope, mode,
    ...(scope === 'project' ? { project: f.project } : {}) } }));
}
function inventory(location) { return JSON.parse(fs.readFileSync(location.stateFile, 'utf8')); }
function tree(root) {
  const out = {};
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name), st = fs.lstatSync(p);
      out[path.relative(root, p)] = e.isSymbolicLink() ? ['link', fs.readlinkSync(p), st.mtimeMs]
        : e.isDirectory() ? ['dir', st.mtimeMs] : ['file', fs.readFileSync(p).toString('base64'), st.mode, st.mtimeMs];
      if (e.isDirectory()) walk(p);
    }
  }
  walk(root); return out;
}

for (const provider of nativeProviders) for (const scope of ['global', 'project']) for (const mode of ['copy', 'symlink']) {
  test(provider + '/' + scope + '/' + mode + ': install, repeat, runtime, update, uninstall without source', async t => {
    const f = fixture(t), location = loc(f, provider, scope, mode);
    const before = tree(f.root);
    run(f, 'install', ['--dry-run'], provider, scope, mode);
    assert.deepEqual(tree(f.root), before, 'dry-run mutated filesystem');
    run(f, 'install', [], provider, scope, mode);
    const state = inventory(location);
    assert.equal(Object.keys(state.components).length, 4);
    const skill = path.join(location.skills, 'demo');
    const text = fs.readFileSync(path.join(skill, 'SKILL.md'), 'utf8');
    const rule = text.match(/Прочитай (\S+) и/)[1];
    assert.match(fs.readFileSync(path.resolve(skill, rule), 'utf8'), /голос автора/);
    assert.match(fs.readFileSync(path.join(skill, 'references/help.md'), 'utf8'), /правило/);
    assert.deepEqual(fs.readFileSync(path.join(skill, 'assets/data.bin')), Buffer.from([0, 255, 1]));
    assert.equal(execFileSync(process.execPath, [path.join(skill, 'scripts/check.cjs')], { encoding: 'utf8' }).trim(), 'reference-ok');
    assert.equal(fs.lstatSync(path.join(skill, 'scripts/check.cjs')).isSymbolicLink(), mode === 'symlink');
    assert.equal(fs.lstatSync(path.join(skill, 'SKILL.md')).isSymbolicLink(), false, 'transformed file must be materialized');
    const agent = state.files.find(x => x.component === 'agent:demo');
    const agentText = fs.readFileSync(agent.path, 'utf8');
    assert.doesNotMatch(agentText, /haiku/);
    if (provider === 'codex') {
      assert.match(agentText, /developer_instructions = /);
      assert.match(fs.readFileSync(path.join(location.skills, 'bear-command-demo/agents/openai.yaml'), 'utf8'), /allow_implicit_invocation: false/);
    }
    if (provider === 'opencode') {
      assert.match(agentText, /mode: subagent/);
      const plugin = await import('data:text/javascript;base64,' + fs.readFileSync(path.join(location.root, 'plugins/bear-skills.js')).toString('base64'));
      const hooks = await plugin.BearSkills(), config = { instructions: ['USER.md'] };
      await hooks.config(config); await hooks.config(config);
      assert.equal(config.instructions.length, 3);
      assert.match(fs.readFileSync(config.instructions[1], 'utf8'), /<bear-skills>/);
    } else {
      const output = JSON.parse(execFileSync(process.execPath, [path.join(location.stateDir, 'session.cjs')], { encoding: 'utf8' }));
      assert.match(provider === 'cursor' ? output.additional_context : output.hookSpecificOutput.additionalContext, /<bear-skills>/);
    }
    const repeat = run(f, 'install', [], provider, scope, mode);
    assert.equal(repeat.changes.length, 0);
    fs.appendFileSync(path.join(f.domain, 'skills/demo/SKILL.md'), '\nОбновлено.\n');
    run(f, 'sync', [], provider, scope, mode);
    assert.match(fs.readFileSync(path.join(skill, 'SKILL.md'), 'utf8'), /Обновлено/);
    const installed = tree(f.root);
    run(f, 'sync', ['--dry-run'], provider, scope, mode);
    assert.deepEqual(tree(f.root), installed);
    fs.rmSync(f.source, { recursive: true });
    run(f, 'uninstall', [], provider, scope, mode);
    assert.equal(fs.existsSync(skill), false);
    assert.equal(inventory(location).files.length, 0);
  });
}

test('selection includes transitive rules and preserves unrelated installs', t => {
  const f = fixture(t);
  run(f, 'install', ['skill:demo']);
  const location = loc(f);
  assert.deepEqual(Object.keys(inventory(location).components).sort(), ['rule:demo', 'skill:demo']);
  run(f, 'install', ['agent:demo']);
  assert.equal(Object.keys(inventory(location).components).length, 3);
  run(f, 'uninstall', ['rule:demo'], 'claude-code', 'global', 'copy', 1);
});

test('all conflicts checked before mutation; overwrite creates recoverable backup', t => {
  const f = fixture(t), location = loc(f);
  write(path.join(location.root, 'rules/demo.md'), 'USER RULE');
  const before = tree(f.root);
  const result = run(f, 'install', ['--dry-run'], 'claude-code', 'global', 'copy', 1);
  assert.match(result.conflicts.join(' '), /Конфликт/);
  assert.deepEqual(tree(f.root), before);
  run(f, 'install', [], 'claude-code', 'global', 'copy', 1);
  assert.deepEqual(tree(f.root), before);
  const applied = run(f, 'install', ['--overwrite']);
  assert.equal(fs.readFileSync(applied.backups[0].backup, 'utf8'), 'USER RULE');
  const skill = path.join(location.skills, 'demo/SKILL.md');
  fs.appendFileSync(skill, '\nUSER EDIT');
  run(f, 'sync', [], 'claude-code', 'global', 'copy', 1);
  const removed = run(f, 'uninstall');
  assert.match(removed.warnings.join(' '), /Сохранён/);
  assert.match(fs.readFileSync(skill, 'utf8'), /USER EDIT/);
});

test('foreign native settings survive repeated install and uninstall', t => {
  for (const provider of nativeProviders.filter(x => x !== 'opencode')) {
    const f = fixture(t), location = loc(f, provider);
    const file = path.join(location.root, location.provider.hookFile);
    const foreign = { env: { USER_SETTING: 'keep' }, hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo user' }] }] } };
    if (provider === 'cursor') foreign.version = 1;
    write(file, JSON.stringify(foreign));
    run(f, 'install', [], provider); run(f, 'install', [], provider);
    run(f, 'uninstall', [], provider);
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), foreign);
  }
});

test('symlink parents, hardlinks and tampered inventory never bypass path checks', t => {
  const f = fixture(t), location = loc(f);
  fs.mkdirSync(location.root, { recursive: true });
  const victim = path.join(f.root, 'victim');
  fs.mkdirSync(victim);
  fs.symlinkSync(victim, path.join(location.root, 'rules'));
  run(f, 'install', ['--overwrite'], 'claude-code', 'global', 'copy', 1);
  assert.deepEqual(fs.readdirSync(victim), []);
  fs.unlinkSync(path.join(location.root, 'rules'));
  const external = path.join(victim, 'data');
  write(external, 'keep'); fs.mkdirSync(path.join(location.root, 'rules'));
  fs.linkSync(external, path.join(location.root, 'rules/demo.md'));
  run(f, 'install', ['--overwrite'], 'claude-code', 'global', 'copy', 1);
  assert.equal(fs.readFileSync(external, 'utf8'), 'keep');
  fs.unlinkSync(path.join(location.root, 'rules/demo.md'));
  run(f, 'install');
  const state = inventory(location);
  state.files[0].path = external;
  fs.writeFileSync(location.stateFile, JSON.stringify(state));
  run(f, 'uninstall', [], 'claude-code', 'global', 'copy', 1);
  assert.equal(fs.readFileSync(external, 'utf8'), 'keep');
});

test('dependency cycles and unknown references fail before installation', t => {
  const f = fixture(t), manifest = path.join(f.domain, 'manifest.yaml');
  const initial = fs.readFileSync(manifest, 'utf8');
  fs.writeFileSync(manifest, initial.replace('    - rule:demo', '    - rule:missing'));
  assert.throws(() => loadCatalog(f.source), /Неизвестная зависимость/);
  fs.writeFileSync(manifest, initial.replace('  agent:demo:', '  rule:demo:\n    - skill:demo\n  agent:demo:'));
  assert.throws(() => loadCatalog(f.source), /Цикл/);
});

test('missing CLI gates dependency consumers; MCP config never means session verified', t => {
  const f = fixture(t);
  fs.appendFileSync(path.join(f.domain, 'manifest.yaml'), '\nrequires_bin:\n  bear-no-such-cli-123:\n    - skill:demo\n');
  const result = run(f, 'install');
  assert.equal(result.components, 2); // command and rule; agent also requires the unavailable skill
  assert.match(result.warnings.join(' '), /требует CLI/);
  run(f, 'install', ['skill:demo'], 'claude-code', 'global', 'copy', 1);
  fs.writeFileSync(path.join(f.domain, 'manifest.yaml'), fs.readFileSync(path.join(f.domain, 'manifest.yaml'), 'utf8').split('\nrequires_bin:')[0]);
  run(f, 'install');
  write(path.join(loc(f).root, 'mcp.json'), JSON.stringify({ mcpServers: { telegram: { command: 'local' } } }));
  const status = run(f, 'doctor');
  assert.equal(status.mcp[0].configuration, 'found');
  assert.equal(status.mcp[0].session, 'not-verified');
});

test('restricted agents rejected instead of silently losing tools/hooks', t => {
  const f = fixture(t);
  const agent = path.join(f.domain, 'agents/demo.md');
  fs.writeFileSync(agent, fs.readFileSync(agent, 'utf8').replace('model: haiku', 'tools: Read, Grep\nmodel: haiku'));
  for (const provider of ['codex', 'cursor']) run(f, 'install', ['agent:demo'], provider, 'global', 'copy', 1);
  run(f, 'install', ['agent:demo'], 'opencode');
  assert.match(fs.readFileSync(path.join(loc(f, 'opencode').root, 'agents/demo.md'), 'utf8'), /"\*": deny/);
});

test('legacy verified directory symlink migrates, sync materializes, uninstall works', t => {
  const f = fixture(t), location = loc(f);
  fs.mkdirSync(location.skills, { recursive: true });
  fs.symlinkSync(path.join(f.domain, 'skills/demo'), path.join(location.skills, 'demo'));
  const before = tree(f.root);
  run(f, 'migrate', ['--dry-run']);
  assert.deepEqual(tree(f.root), before);
  run(f, 'migrate');
  run(f, 'sync');
  assert.equal(fs.lstatSync(path.join(location.skills, 'demo')).isDirectory(), true);
  assert.equal(inventory(location).components['rule:demo'].kind, 'rule');
  run(f, 'uninstall');
});

test('legacy copy inventory migration validates filenames and ambiguous edits', t => {
  const f = fixture(t), location = loc(f);
  const legacy = path.join(location.root, '.bear-skills-installed.json');
  fs.cpSync(path.join(f.domain, 'skills/demo'), path.join(location.skills, 'demo'), { recursive: true });
  write(legacy, JSON.stringify({ provider: 'claude-code', installed: { skills: ['demo'], agents: [], rules: [] } }));
  run(f, 'migrate'); run(f, 'sync'); run(f, 'uninstall');
  const g = fixture(t), other = loc(g);
  write(path.join(other.root, '.bear-skills-installed.json'), JSON.stringify({ provider: 'claude-code', installed: { skills: ['../../victim'], agents: [], rules: [] } }));
  run(g, 'migrate', [], 'claude-code', 'global', 'copy', 1);
});

test('source-free status separates files from native loading and detects scope duplicates', t => {
  const f = fixture(t);
  run(f, 'install', ['skill:demo']);
  run(f, 'install', ['skill:demo'], 'claude-code', 'project');
  const result = run(f, 'doctor', [], 'claude-code', 'project');
  assert.match(result.warnings.join(' '), /Дубль global\/project/);
  assert.equal(result.providerLoaded, 'not-verified');
  fs.rmSync(f.source, { recursive: true });
  assert.ok(run(f, 'status').files.present > 0);
});

test('partial removal refreshes runtime index and retains dependencies of user edits', t => {
  const f = fixture(t), location = loc(f);
  run(f, 'install');
  fs.appendFileSync(path.join(location.skills, 'demo/SKILL.md'), '\nUSER');
  run(f, 'uninstall');
  const state = inventory(location);
  assert.deepEqual(Object.keys(state.components).sort(), ['rule:demo', 'skill:demo']);
  assert.ok(fs.existsSync(path.join(location.root, 'rules/demo.md')));
  assert.match(fs.readFileSync(path.join(location.stateDir, 'index.md'), 'utf8'), /demo/);
});

test('uninstall remembers vault paths even after env/source/CLI disappear', t => {
  const f = fixture(t), vault = path.join(f.root, 'vault');
  const d = path.join(f.source, 'domains/obsidian');
  write(path.join(d, 'manifest.yaml'), 'name: obsidian\nrequires_env:\n  - BEAR_VAULT\ntargets:\n  rules: unused\n');
  write(path.join(d, 'rules/vault.md'), 'vault rule');
  run(f, 'install', ['obsidian', '--vault', vault]);
  assert.ok(fs.existsSync(path.join(vault, '.agents/rules/vault.md')));
  fs.rmSync(f.source, { recursive: true });
  run(f, 'uninstall');
  assert.equal(fs.existsSync(path.join(vault, '.agents/rules/vault.md')), false);
});

test('legacy flat-md copies migrate to complete native skill packages', t => {
  for (const provider of ['codex', 'cursor']) {
    const f = fixture(t), location = loc(f, provider);
    const folder = path.join(location.root, provider === 'codex' ? 'skills' : 'rules');
    write(path.join(folder, 'demo.md'), fs.readFileSync(path.join(f.domain, 'skills/demo/SKILL.md')));
    write(path.join(folder, '.bear-skills-installed.json'), JSON.stringify({
      provider, installed: { skills: ['demo'], rules: [], agents: [] },
    }));
    run(f, 'migrate', ['skill:demo'], provider);
    run(f, 'sync', [], provider);
    assert.equal(fs.existsSync(path.join(folder, 'demo.md')), false);
    assert.ok(fs.existsSync(path.join(location.skills, 'demo/references/help.md')));
    run(f, 'uninstall', [], provider);
  }
});

test('obsolete resources are pruned, extra user files survive, copy/symlink switch is safe', t => {
  const f = fixture(t), location = loc(f);
  run(f, 'install');
  write(path.join(location.skills, 'demo/user.txt'), 'mine');
  fs.unlinkSync(path.join(f.domain, 'skills/demo/assets/data.bin'));
  run(f, 'sync', [], 'claude-code', 'global', 'symlink');
  assert.equal(fs.existsSync(path.join(location.skills, 'demo/assets/data.bin')), false);
  assert.ok(fs.lstatSync(path.join(location.skills, 'demo/scripts/check.cjs')).isSymbolicLink());
  run(f, 'uninstall');
  assert.equal(fs.readFileSync(path.join(location.skills, 'demo/user.txt'), 'utf8'), 'mine');
});

test('overwrite backs up foreign package files, but not by following directory symlinks', t => {
  const f = fixture(t), location = loc(f);
  write(path.join(location.skills, 'demo/SKILL.md'), 'FOREIGN');
  const report = run(f, 'install', ['--overwrite']);
  assert.ok(report.backups.some(b => fs.readFileSync(b.backup, 'utf8') === 'FOREIGN'));
});

test('invalid JSON config does not leak contents and blocks all file writes', t => {
  const f = fixture(t), location = loc(f);
  write(path.join(location.root, 'settings.json'), '{"apiKey":"TEST-PRIVATE-VALUE", invalid}');
  const before = tree(f.root);
  const report = run(f, 'install', [], 'claude-code', 'global', 'copy', 1);
  assert.doesNotMatch(JSON.stringify(report), /TEST-PRIVATE-VALUE/);
  assert.deepEqual(tree(f.root), before);
});

test('dry-run bootstrap and managed CLI do not invoke git', t => {
  const f = fixture(t), bin = path.join(f.root, 'bin'), sentinel = path.join(f.root, 'git-called');
  write(path.join(bin, 'git'), '#!/bin/sh\ntouch "' + sentinel + '"\n');
  fs.chmodSync(path.join(bin, 'git'), 0o755);
  const source = path.join(f.home, '.bear-skills');
  fs.renameSync(f.source, source); fs.mkdirSync(path.join(source, '.git'));
  const env = { ...process.env, HOME: f.home, PATH: bin + path.delimiter + process.env.PATH, BEAR_VAULT: '', BEAR_SKILLS_HOME: REPO };
  const before = tree(f.root);
  const cli = spawnSync(process.execPath, [CLI, 'install', '--home', f.home, '--dry-run', '--json'], { env, encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr);
  const shell = spawnSync('bash', [path.join(REPO, 'install.sh'), '--dry-run', '--only', 'claude-code'], { env, encoding: 'utf8' });
  assert.equal(shell.status, 0, shell.stderr);
  assert.deepEqual(tree(f.root), before);
  assert.equal(fs.existsSync(sentinel), false);
});

test('transaction rolls back already applied files if a later rename fails', t => {
  const f = fixture(t), location = loc(f);
  const { apply, snapshot } = require('../bin/lib/storage');
  const { emptyState } = require('../bin/lib/installer');
  const first = path.join(location.root, 'rules/first.md'), second = path.join(location.root, 'rules/second.md');
  write(first, 'OLD');
  const changes = [{ path: first, kind: 'file', mode: 0o644, data: Buffer.from('NEW'), before: snapshot(first) },
    { path: second, kind: 'file', mode: 0o644, data: Buffer.from('SECOND'), before: null }];
  const rename = fs.renameSync;
  fs.renameSync = (src, dst) => { if (dst === second) throw new Error('injected rename failure'); return rename(src, dst); };
  try {
    assert.throws(() => apply(location, changes, null, emptyState(location, { ...f, scope: 'global' }), null), /injected/);
  } finally { fs.renameSync = rename; }
  assert.equal(fs.readFileSync(first, 'utf8'), 'OLD');
  assert.equal(fs.existsSync(second), false);
  assert.equal(fs.existsSync(location.stateFile), false);
});

test('doctor catches broken resource links even when source contains that mistake', t => {
  const f = fixture(t);
  fs.appendFileSync(path.join(f.domain, 'skills/demo/SKILL.md'), '\n[missing](references/absent.md)\n');
  run(f, 'install');
  const report = run(f, 'doctor', [], 'claude-code', 'global', 'copy', 1);
  assert.match(report.warnings.join(' '), /Потерянный ресурс/);
});

test('real catalog installs on every provider; generated TOML parses with tomllib', t => {
  const parser = spawnSync('python3', ['-c', 'import tomllib'], { encoding: 'utf8' });
  for (const provider of nativeProviders) {
    const f = fixture(t);
    f.source = REPO;
    const report = run(f, 'install', [], provider);
    assert.ok(report.components > 0);
    const location = loc(f, provider);
    for (const file of inventory(location).files.filter(f => /\.(md|mdc|toml)$/.test(f.path))) {
      const text = fs.readFileSync(file.path, 'utf8');
      assert.doesNotMatch(text, /\{\{(?:rule|skill|agent):/);
      if (file.path.endsWith('.toml') && parser.status === 0) {
        const parsed = spawnSync('python3', ['-c', 'import tomllib,sys; d=tomllib.loads(sys.stdin.read()); assert d["name"] and d["description"] and d["developer_instructions"]'], { input: text, encoding: 'utf8' });
        assert.equal(parsed.status, 0, parsed.stderr);
      }
    }
  }
  if (parser.status !== 0) t.diagnostic('Python tomllib отсутствует: отдельная проверка TOML parser не выполнена');
});

test('MCP project inspection recognizes inherited global JSONC without treating it as a session', t => {
  const f = fixture(t), global = loc(f, 'opencode');
  write(path.join(global.root, 'opencode.jsonc'), '{\n// comment\n"mcp": {"telegram": {"url": "https://example.invalid"}, // trailing comma\n},\n}');
  run(f, 'install', ['skill:demo'], 'opencode', 'project');
  const report = run(f, 'doctor', [], 'opencode', 'project');
  assert.equal(report.mcp[0].configuration, 'found');
  assert.equal(report.mcp[0].session, 'not-verified');
});

test('manual migration of changed legacy copies retains a backup', t => {
  const f = fixture(t), location = loc(f);
  fs.cpSync(path.join(f.domain, 'skills/demo'), path.join(location.skills, 'demo'), { recursive: true });
  fs.appendFileSync(path.join(location.skills, 'demo/SKILL.md'), '\nUSER EDIT');
  write(path.join(location.root, '.bear-skills-installed.json'), JSON.stringify({
    provider: 'claude-code', installed: { skills: ['demo'], agents: [], rules: [] },
  }));
  run(f, 'migrate', [], 'claude-code', 'global', 'copy', 1);
  const report = run(f, 'migrate', ['--overwrite']);
  assert.match(fs.readFileSync(report.backups[0].backup, 'utf8'), /USER EDIT/);
  run(f, 'sync');
  assert.doesNotMatch(fs.readFileSync(path.join(location.skills, 'demo/SKILL.md'), 'utf8'), /USER EDIT/);
});

test('sync without --mode preserves a copy installation', t => {
  const f = fixture(t), location = loc(f);
  run(f, 'install');
  const command = spawnSync(process.execPath, [CLI, 'sync', '--source', f.source, '--home', f.home, '--json'],
    { encoding: 'utf8', cwd: f.project });
  assert.equal(command.status, 0, command.stderr);
  assert.equal(fs.lstatSync(path.join(location.skills, 'demo/scripts/check.cjs')).isSymbolicLink(), false);
});

test('command restrictions cannot silently become unrestricted skills', t => {
  const f = fixture(t);
  const file = path.join(f.domain, 'commands/demo.md');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('description:', 'allowed-tools: Read\n description:').replace('\n description:', '\ndescription:'));
  run(f, 'install', ['command:demo'], 'codex', 'global', 'copy', 1);
});

test('descriptive aliases/tags remain in the package without blocking native skills', t => {
  const f = fixture(t), file = path.join(f.domain, 'skills/demo/SKILL.md');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('name: demo', 'name: demo\naliases:\n  - Демо\ntags:\n  - test'));
  run(f, 'install', ['skill:demo'], 'codex');
  assert.match(fs.readFileSync(path.join(loc(f, 'codex').skills, 'demo/SKILL.md'), 'utf8'), /aliases:\n  - Демо/);
});
