'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { hasBin } = require('../catalog');
const adapters = [require('./claude-code'), require('./codex'), require('./cursor'), require('./opencode')];

function getProvider(id) {
  const provider = adapters.find(p => p.id === (id === 'claude' ? 'claude-code' : id));
  if (!provider) throw new Error('Неизвестный provider: ' + id + '. Доступны: ' + adapters.map(p => p.id).join(', '));
  return provider;
}

function layout(options) {
  const provider = getProvider(options.provider);
  const root = options.providerHome || (provider.id === 'claude-code' && options.claudeHome) || provider.root(options);
  const skills = provider.skillDir ? provider.skillDir(options) : path.join(root, 'skills');
  const stateDir = path.join(root, '.bear-skills');
  const allowed = [root, skills];
  if (provider.id === 'claude-code' && options.scope === 'global' && options.vault) allowed.push(path.join(options.vault, '.agents', 'rules'));
  return { provider, root, skills, stateDir, stateFile: path.join(stateDir, 'installation.json'), allowed };
}

function destination(component, options, loc) {
  const p = loc.provider;
  if (component.kind === 'skill') return path.join(loc.skills, component.name);
  if (component.kind === 'rule') return path.join(p.ruleDir(options, loc.root, component), component.name + p.ruleExtension);
  if (component.kind === 'agent') return path.join(loc.root, 'agents', component.name + p.agentExtension);
  if (component.kind === 'command') return p.id === 'codex'
    ? path.join(loc.skills, 'bear-command-' + component.name)
    : path.join(loc.root, 'commands', component.name + '.md');
  throw new Error('Неизвестный kind: ' + component.kind);
}

function compatibility(c, provider) {
  if (provider.id !== 'claude-code' && c.name === 'bear-stats') return 'статистика вызовов реализована только для session logs Claude Code';
  if (provider.id === 'claude-code' || c.kind === 'rule') return null;
  const f = c.meta.fields;
  const supported = c.kind === 'agent'
    ? ['name', 'description', 'model', 'tools']
    : c.kind === 'command' ? ['name', 'description', 'argument-hint']
      : ['name', 'description', 'license', 'metadata', 'compatibility', 'aliases', 'tags', 'disable-model-invocation', 'user-invocable', 'argument-hint'];
  const unsupported = Object.keys(f).filter(k => !supported.includes(k));
  if (unsupported.length) return 'неподдерживаемые обязательные поля: ' + unsupported.join(', ');
  if (f.tools) {
    if (provider.id !== 'opencode') return 'невозможно сохранить native tools allowlist этого агента';
    const known = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash', 'Skill', 'WebFetch', 'WebSearch', 'Task'];
    const unknown = f.tools.split(',').map(t => t.trim()).filter(t => !known.includes(t));
    if (unknown.length) return 'нет permission mapping для tools: ' + unknown.join(', ');
    const allowed = f.tools.split(',').map(t => t.trim());
    if (allowed.includes('Write') !== allowed.includes('Edit')) return 'OpenCode объединяет Write/Edit в permission edit; точный allowlist не сохраняется';
  }
  // OpenCode lacks a documented per-skill manual-only discovery switch.
  if (provider.id === 'opencode' && f['disable-model-invocation'] === 'true') return 'manual-only skill не поддерживается native skill loader OpenCode';
  return null;
}

function detection(provider, options) {
  return { configFound: fs.existsSync(provider.root({ ...options, scope: 'global' })),
    binaries: provider.binaries.filter(hasBin), loaded: 'not-verified', compatibility: 'not-verified',
    documentationChecked: '2026-11-02' };
}

module.exports = { adapters, getProvider, layout, destination, compatibility, detection };
