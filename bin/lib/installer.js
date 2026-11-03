'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const catalogApi = require('./catalog');
const { adapters, layout, destination, compatibility, detection } = require('./providers');
const { renderComponent, runtimeFiles, indexText } = require('./render');
const storage = require('./storage');
const { stat, canonical, snapshot, matches, record, readInventory, preflight, configChange, hookSpec, apply, assertSafe, inside } = storage;
const ROOT = path.resolve(__dirname, '../..');

function optionsFrom(args) {
  const f = args.flags;
  const scope = f.scope || 'global', mode = f.mode || 'symlink';
  if (!['global', 'project'].includes(scope)) throw new Error('--scope: global|project');
  if (!['copy', 'symlink'].includes(mode)) throw new Error('--mode: copy|symlink');
  for (const key of ['provider', 'scope', 'mode', 'project', 'home', 'provider-home', 'claude-home', 'vault', 'source']) {
    if (f[key] === true || f[key] === '') throw new Error('--' + key + ' требует значение');
  }
  const home = canonical(f.home || os.homedir());
  const project = canonical(f.project || process.cwd());
  if (scope === 'project' && !fs.statSync(project).isDirectory()) throw new Error('Project должен существовать: ' + project);
  if (scope === 'global' && f.project) throw new Error('--project используется с --scope project');
  const opts = { provider: f.provider || 'claude-code', scope, mode, modeExplicit: !!f.mode, home, project,
    source: path.resolve(f.source || path.join(home, '.bear-skills')),
    providerHome: f['provider-home'] && path.resolve(f['provider-home']),
    claudeHome: f['claude-home'] && path.resolve(f['claude-home']),
    vault: (f.vault || process.env.BEAR_VAULT) ? canonical(f.vault || process.env.BEAR_VAULT) : null,
    xdgConfig: !f.home && process.env.XDG_CONFIG_HOME ? canonical(process.env.XDG_CONFIG_HOME) : null,
    dryRun: !!f['dry-run'], overwrite: !!f.overwrite, json: !!f.json,
    selectors: [...args._.slice(1), ...String(f.domains || '').split(',').filter(Boolean)] };
  if (scope === 'project' && (opts.providerHome || opts.claudeHome)) throw new Error('--provider-home/--claude-home нельзя смешивать с project scope');
  if (f['claude-home'] && !['claude', 'claude-code'].includes(opts.provider)) throw new Error('--claude-home применяется только к Claude Code');
  if (!f.home && scope === 'global') {
    if (opts.provider === 'codex' && !opts.providerHome && process.env.CODEX_HOME) opts.providerHome = path.resolve(process.env.CODEX_HOME);
    if (['claude', 'claude-code'].includes(opts.provider) && !opts.claudeHome && process.env.CLAUDE_CONFIG_DIR) opts.claudeHome = path.resolve(process.env.CLAUDE_CONFIG_DIR);
  }
  return opts;
}

function emptyState(loc, o) {
  return { schemaVersion: 1, provider: loc.provider.id, scope: o.scope, root: loc.root,
    skills: loc.skills, project: o.scope === 'project' ? o.project : null, source: o.source,
    vault: o.vault, roots: [], components: {}, files: [], directories: [], config: null,
    compatibility: 'not-verified', providerLoaded: 'not-verified' };
}
function unavailable(c, options, loc) {
  const env = { ...process.env, BEAR_VAULT: options.vault || '' };
  const missingEnv = c.env.filter(name => !env[name]);
  const missingBin = c.bins.filter(name => !catalogApi.hasBin(name));
  if (missingEnv.length) return 'требует env: ' + missingEnv.join(', ');
  if (missingBin.length) return 'требует CLI: ' + missingBin.join(', ');
  return compatibility(c, loc.provider);
}
function componentRecord(c, options, loc) {
  const { id, kind, name, domain, dependencies, bins, env, mcp, src } = c;
  return { id, kind, name, domain, dependencies, bins, env, mcp, source: src,
    destination: destination(c, options, loc), mode: options.mode };
}
function output(options, result) {
  if (options.json) { console.log(JSON.stringify(result, null, 2)); return result; }
  console.log(result.provider + ' / ' + result.scope + (options.dryRun ? ' [dry-run]' : ''));
  for (const warning of result.warnings || []) console.log('⚠ ' + warning);
  for (const conflict of result.conflicts || []) console.log('❌ ' + conflict);
  for (const change of result.changes || []) console.log((change.action === 'remove' ? '− ' : '+ ') + change.path);
  for (const backup of result.backups || []) console.log('Backup: ' + backup.original + ' → ' + backup.backup);
  if (result.components !== undefined) console.log('Компонентов по описи: ' + result.components);
  if (result.files) console.log('Файлы: ' + JSON.stringify(result.files));
  console.log('Загрузка провайдером: не проверена (файлы и runtime проверяются отдельно).');
  return result;
}

function install(options, command = 'install') {
  const loc = layout(options);
  const previous = readInventory(loc, options);
  const old = previous || emptyState(loc, options);
  const catalog = catalogApi.loadCatalog(options.source);
  let roots = command === 'sync' && !options.selectors.length && previous
    ? old.roots : catalogApi.select(catalog, options.selectors);
  const resolved = catalogApi.resolveDependencies(catalog, roots, c => unavailable(c, options, loc));
  const explicitItems = options.selectors.filter(s => !catalog.domains.some(d => d.name === s));
  if (explicitItems.length && resolved.skipped.length) {
    throw new Error('Невозможно установить выбранный компонент:\n' + resolved.skipped.map(s => s.reason).join('\n'));
  }
  const selected = new Set(resolved.selected);
  const components = { ...old.components };
  const desired = [];
  const replacingParents = new Map(old.files.filter(f => selected.has(f.component) && f.kind === 'symlink' &&
    old.components[f.component]?.kind === 'skill' && f.path === old.components[f.component]?.destination).map(f => [f.path, f]));
  for (const id of selected) {
    const c = catalog.components.get(id);
    const dst = destination(c, options, loc);
    if (c.kind === 'skill' || (c.kind === 'command' && loc.provider.id === 'codex')) {
      assertSafe(dst, loc.allowed, { leafLink: replacingParents.has(dst) });
      // Existing same-name folders are not ours merely because they are empty.
      if (stat(dst) && !Object.hasOwn(old.components, id) && !options.overwrite) {
        throw new Error('Конфликт: каталог компонента без описи ' + dst + '. Используй migrate или переименуй его.');
      }
    }
    const componentOptions = command === 'sync' && !options.modeExplicit
      ? { ...options, mode: old.components[id]?.mode || old.components[old.roots[0]]?.mode || options.mode } : options;
    desired.push(...renderComponent(c, catalog, componentOptions, loc));
    components[id] = componentRecord(c, componentOptions, loc);
  }
  desired.push(...runtimeFiles(options.source, Object.values(components), loc, options));
  const retainedFiles = old.files.filter(f => !selected.has(f.component) && f.component !== '@runtime');
  const wantedPaths = new Set(desired.map(f => f.path));
  const removing = old.files.filter(f => (selected.has(f.component) || f.component === '@runtime') && !wantedPaths.has(f.path));
  const plan = preflight(loc, desired, old.files, removing, options.overwrite, replacingParents);
  const warnings = resolved.skipped.map(s => s.reason);
  const mcp = [...selected].flatMap(id => catalog.components.get(id).mcp.map(req => ({ component: id, ...mcpState(req, options, loc) })));
  if (!options.json) for (const req of mcp) warnings.push(req.component + ': MCP ' + req.server + '/' + req.tool + ', config ' + req.configuration + ', session не проверена');
  let config;
  try { config = configChange(loc, old.config, Object.keys(components).length ? hookSpec(loc) : null, options.overwrite); }
  catch (e) { plan.conflicts.push(e.message); }
  const state = { ...old, source: options.source, vault: options.vault || old.vault, components,
    roots: [...new Set([...old.roots, ...roots.filter(id => selected.has(id))])],
    files: [...retainedFiles, ...desired.map(record)], config: config?.record || null,
    skipped: resolved.skipped, updatedAt: new Date().toISOString() };
  const result = { provider: loc.provider.id, scope: options.scope, components: Object.keys(components).length,
    warnings, mcp, conflicts: plan.conflicts, changes: plan.changes.map(c => ({ path: c.path, action: c.data === null ? 'remove' : 'write' })) };
  if (config && (!config.before || !config.before.data.equals(config.data || Buffer.alloc(0)))) {
    result.changes.push({ path: config.path, action: config.data ? 'merge' : 'remove' });
  }
  if (plan.conflicts.length) { output(options, result); return { ...result, failed: true }; }
  if (!options.dryRun) result.backups = apply(loc, plan.changes, config, state, snapshot(loc.stateFile), replacingParents);
  return output(options, result);
}

function selectInstalled(state, selectors) {
  return catalogApi.select({ domains: [...new Set(Object.values(state.components).map(c => c.domain))].map(name => ({ name })),
    components: new Map(Object.entries(state.components)) }, selectors);
}

function uninstall(options) {
  const loc = layout(options), state = readInventory(loc, options);
  if (!state) return output(options, { provider: loc.provider.id, scope: options.scope, components: 0, warnings: ['Нет описи. Для старой установки используй migrate.'] });
  const selected = new Set(selectInstalled(state, options.selectors));
  for (const c of Object.values(state.components)) {
    if (!selected.has(c.id) && c.dependencies.some(d => selected.has(d))) throw new Error(c.id + ' требует удаляемый компонент; добавь зависимый компонент в выбор');
  }
  const warnings = [], retained = [], removing = [], preserve = new Set();
  function preserveDependencies(id) {
    if (preserve.has(id) || !state.components[id]) return;
    preserve.add(id);
    for (const dep of state.components[id].dependencies) preserveDependencies(dep);
  }
  for (const file of state.files) {
    if (!selected.has(file.component)) continue;
    const current = snapshot(file.path);
    if (current && !matches(file, current)) {
      warnings.push('Сохранён изменённый компонент и его зависимости: ' + file.path);
      preserveDependencies(file.component);
    }
  }
  for (const id of preserve) selected.delete(id);
  const runtimeRemove = selected.size === Object.keys(state.components).length;
  for (const file of state.files) {
    if (!selected.has(file.component) && !(runtimeRemove && file.component === '@runtime')) { retained.push(file); continue; }
    const current = snapshot(file.path);
    // --overwrite does not mean permission to delete user edits on uninstall.
    if (current && !matches(file, current)) {
      warnings.push('Сохранён изменённый файл: ' + file.path);
      retained.push(file);
    } else removing.push(file);
  }
  const keptIds = new Set(retained.map(f => f.component));
  const components = Object.fromEntries(Object.entries(state.components).filter(([id]) => !selected.has(id) || keptIds.has(id)));
  const keepRuntime = Object.keys(components).length > 0;
  let config;
  try { config = configChange(loc, state.config, keepRuntime ? hookSpec(loc) : null, false); }
  catch (e) {
    // Preserve modified configuration and its referenced runtime as a unit.
    warnings.push('Сохранена конфигурация: ' + e.message);
    config = null;
    for (let i = removing.length - 1; i >= 0; i--) {
      if (removing[i].component === '@runtime') retained.push(...removing.splice(i, 1));
    }
  }
  if (keepRuntime) {
    for (let i = removing.length - 1; i >= 0; i--) {
      if (removing[i].component === '@runtime') retained.push(...removing.splice(i, 1));
    }
  }
  const desired = [];
  const index = retained.find(f => f.component === '@runtime' && f.path === path.join(loc.stateDir, 'index.md'));
  if (keepRuntime && index && matches(index, snapshot(index.path))) {
    desired.push({ path: index.path, component: '@runtime', kind: 'file', mode: 0o644,
      data: Buffer.from(indexText(Object.values(components), loc, options)) });
    retained.splice(retained.indexOf(index), 1, record(desired[0]));
  }
  const plan = preflight(loc, desired, state.files, removing, false);
  const next = { ...state, components, roots: state.roots.filter(id => Object.hasOwn(components, id)),
    files: retained, config: config ? config.record : state.config, updatedAt: new Date().toISOString() };
  const result = { provider: loc.provider.id, scope: options.scope, components: Object.keys(components).length, warnings,
    conflicts: plan.conflicts, changes: plan.changes.map(c => ({ path: c.path, action: c.data === null ? 'remove' : 'write' })) };
  if (config && (!config.before || !config.before.data.equals(config.data || Buffer.alloc(0)))) result.changes.push({ path: config.path, action: config.data ? 'merge' : 'remove' });
  if (!options.dryRun) apply(loc, plan.changes, config, next, snapshot(loc.stateFile));
  return output(options, result);
}

// Probe configuration only; a configured server is not an authenticated session.
function parseJsonc(text) {
  let clean = '', inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (inString) {
      clean += c;
      if (c === '\\') clean += text[++i] || '';
      else if (c === '"') inString = false;
    } else if (c === '"') { inString = true; clean += c; }
    else if (c === '/' && next === '/') { while (i + 1 < text.length && text[i + 1] !== '\n') i++; }
    else if (c === '/' && next === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      if (i === text.length) throw new Error('Unclosed JSONC comment');
      i++;
    } else if (c === ',' && /^[\s]*[}\]]/.test(text.slice(i + 1))) { /* trailing comma */ }
    else clean += c;
  }
  return clean === text ? JSON.parse(clean) : parseJsonc(clean);
}

function mcpState(requirement, options, loc) {
  const root = loc.root;
  const paths = loc.provider.id === 'codex' ? [path.join(root, 'config.toml')]
    : loc.provider.id === 'opencode' ? [path.join(root, 'opencode.json'), path.join(root, 'opencode.jsonc'),
      ...(options.scope === 'project' ? [path.join(options.project, 'opencode.json'), path.join(options.project, 'opencode.jsonc')] : [])]
      : [path.join(root, 'mcp.json'), path.join(root, 'settings.json'),
        loc.provider.id === 'claude-code' ? (options.scope === 'global' ? path.join(options.home, '.claude.json') : path.join(options.project, '.mcp.json')) : ''];
  let found = false;
  for (const file of paths.filter(Boolean)) {
    try {
      const text = fs.readFileSync(file, 'utf8');
      const server = requirement.server.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
      if (file.endsWith('.toml')) found ||= new RegExp('^\\s*\\[mcp_servers\\.(?:"' + server + '"|' + server + ')\\]', 'm').test(text);
      else {
        const data = parseJsonc(text);
        found ||= Object.hasOwn(data.mcpServers || data.mcp || {}, requirement.server);
      }
    } catch { /* JSONC or unreadable config: unknown, never leak its content */ }
  }
  if (!found && options.scope === 'project') {
    const globalOptions = { ...options, scope: 'global', providerHome: null, claudeHome: null };
    found = mcpState(requirement, globalOptions, layout(globalOptions)).configuration === 'found';
  }
  return { ...requirement, required: true, configuration: found ? 'found' : 'not-found-or-unreadable', session: 'not-verified' };
}

function diagnostics(options, doctor = false) {
  const loc = layout(options), state = readInventory(loc, options);
  const warnings = [], files = { present: 0, missing: 0, modified: 0, brokenLinks: 0 };
  for (const f of state?.files || []) {
    const current = snapshot(f.path);
    if (!current) { files.missing++; warnings.push('Нет файла: ' + f.path); }
    else if (!matches(f, current)) { files.modified++; warnings.push('Изменён файл: ' + f.path); }
    else files.present++;
    if (current?.kind === 'symlink' && !fs.existsSync(f.path)) { files.brokenLinks++; warnings.push('Битый симлинк: ' + f.path); }
  }
  if (state?.config) {
    try {
      const data = JSON.parse(fs.readFileSync(state.config.path, 'utf8'));
      if (!data.hooks?.[state.config.event]?.some(x => JSON.stringify(x) === JSON.stringify(state.config.entry))) warnings.push('Отсутствует/изменён native hook: ' + state.config.path);
    } catch { warnings.push('Нет читаемой конфигурации hook: ' + state.config.path); }
  }
  const mcp = [];
  for (const c of Object.values(state?.components || {})) {
    for (const dep of c.dependencies) if (!Object.hasOwn(state.components, dep)) warnings.push(c.id + ': отсутствует зависимость ' + dep);
    for (const bin of c.bins) if (!catalogApi.hasBin(bin)) warnings.push(c.id + ': отсутствует CLI ' + bin);
    for (const env of c.env) if (!(env === 'BEAR_VAULT' ? options.vault : process.env[env])) warnings.push(c.id + ': отсутствует env ' + env);
    for (const req of c.mcp) mcp.push({ component: c.id, ...mcpState(req, options, loc) });
  }
  if (doctor) {
    if (!state) warnings.push('Нет современной описи; установку legacy сначала проверь через migrate --dry-run.');
    for (const item of state?.skipped || []) warnings.push(item.reason);
    const alternate = layout({ ...options, scope: options.scope === 'global' ? 'project' : 'global', providerHome: null, claudeHome: null });
    for (const c of Object.values(state?.components || {})) {
      const other = destination(c, { ...options, scope: options.scope === 'global' ? 'project' : 'global' }, alternate);
      if (other !== c.destination && stat(other)) warnings.push('Дубль global/project: ' + c.id + ' → ' + other);
    }
    // Plugin caches and historical flat-md locations can coexist with native installs.
    const roots = [path.join(loc.root, 'plugins'), path.join(options.home, '.codex', 'plugins', 'cache')];
    const scan = (dir, depth) => {
      if (depth > 6 || !stat(dir)?.isDirectory() || stat(dir).isSymbolicLink()) return;
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, e.name);
        if (e.isDirectory() && e.name === 'skills' && /bear-skills/.test(file)) warnings.push('Возможный дубль plugin-канала: ' + file);
        else if (e.isDirectory()) scan(file, depth + 1);
      }
    };
    for (const root of roots) scan(root, 0);
    for (const c of Object.values(state?.components || {})) {
      const legacy = loc.provider.id === 'codex' ? path.join(loc.root, 'skills', c.name + '.md')
        : loc.provider.id === 'cursor' ? path.join(loc.root, 'rules', c.name + '.md') : null;
      if (legacy && stat(legacy)) warnings.push('Legacy flat-md дубль: ' + legacy);
    }
    for (const file of state?.files || []) {
      if (!/\.(md|mdc|toml)$/.test(file.path) || !fs.existsSync(file.path) || !matches(file, snapshot(file.path))) continue;
      const text = fs.readFileSync(file.path, 'utf8');
      if (/\{\{(?:rule|skill|agent|command):/.test(text)) warnings.push('Неразрешённый resource token: ' + file.path);
      for (const m of text.matchAll(/\[[^\]\n]*\]\(<?([^)\n>]+)>?\)/g)) {
        const target = m[1].split('#')[0];
        if (!/^(?:\.\.?\/|references\/|scripts\/|assets\/)/.test(target) || /[{}*]/.test(target)) continue;
        if (!fs.existsSync(path.resolve(path.dirname(file.path), target))) warnings.push('Потерянный ресурс: ' + file.path + ' → ' + target);
      }
    }
    const source = state?.source || options.source;
    if (fs.existsSync(path.join(source, 'domains'))) {
      const catalog = catalogApi.loadCatalog(source);
      const triggers = [...catalog.components.values()].filter(c => c.kind === 'skill')
        .map(c => ({ name: c.name, words: catalogApi.triggerWords(c.meta.fields.description) }));
      for (let i = 0; i < triggers.length; i++) for (let j = i + 1; j < triggers.length; j++) {
        const shared = [...triggers[i].words].filter(w => triggers[j].words.has(w));
        if (shared.length) warnings.push('Общий триггер: ' + triggers[i].name + ' / ' + triggers[j].name + ': ' + shared.join(', '));
      }
      const lock = path.join(source, 'skills-lock.json');
      if (fs.existsSync(lock)) {
        let locked;
        try { locked = JSON.parse(fs.readFileSync(lock, 'utf8')); } catch { warnings.push('Невалидный skills-lock.json'); }
        for (const skill of locked?.skills || []) if (catalog.components.has('skill:' + skill.name)) warnings.push('Коллизия с skills-lock.json: ' + skill.name);
      }
    }
  }
  const result = { provider: loc.provider.id, scope: options.scope, components: Object.keys(state?.components || {}).length,
    files, warnings, mcp, providerLoaded: 'not-verified', runtimeConfigured: !!state?.config || !!state?.files.some(f => f.path.endsWith('/plugins/bear-skills.js')) };
  if (!options.json) for (const m of mcp) warnings.push(m.component + ': MCP ' + m.server + '/' + m.tool + ' требуется; config ' + m.configuration + '; session не проверена');
  output(options, result);
  return { ...result, failed: doctor && (files.missing + files.modified + files.brokenLinks > 0 ||
    warnings.some(w => /^(Потерянный ресурс|Неразрешённый|Отсутствует\/изменён native hook|Нет читаемой конфигурации hook)/.test(w))) };
}

function providers(options) {
  const result = adapters.map(p => ({ id: p.id, label: p.label, capabilities: p.capabilities,
    limitations: p.limitations, ...detection(p, options) }));
  if (options.json) console.log(JSON.stringify(result, null, 2));
  else for (const p of result) {
    console.log(p.id + ': ' + JSON.stringify(p.capabilities));
    console.log('  config: ' + p.configFound + '; CLI: ' + (p.binaries.join(', ') || 'не найден') + '; совместимость: не проверена; docs: ' + p.documentationChecked);
    for (const limit of p.limitations) console.log('  Ограничение: ' + limit);
  }
  return result;
}

module.exports = { optionsFrom, install, uninstall, diagnostics, providers, emptyState, componentRecord, output };
