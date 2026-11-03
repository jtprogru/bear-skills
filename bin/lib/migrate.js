'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { loadCatalog, select, NAME, walkFiles } = require('./catalog');
const { layout, destination } = require('./providers');
const { emptyState, componentRecord, output } = require('./installer');
const { stat, assertSafe, snapshot, record, readInventory, apply } = require('./storage');

function migrate(options) {
  const loc = layout(options);
  if (readInventory(loc, options)) throw new Error('Уже есть современная опись; используй sync.');
  const catalog = loadCatalog(options.source);
  const selected = new Set(select(catalog, options.selectors));
  const state = emptyState(loc, options), conflicts = [], warnings = [], replacements = [];
  const legacyRoot = loc.provider.id === 'codex' ? path.join(loc.root, 'skills')
    : loc.provider.id === 'cursor' ? path.join(loc.root, 'rules') : loc.root;
  const legacyFile = path.join(legacyRoot, '.bear-skills-installed.json');
  // Historical paths are narrowly added for migration and recorded as such.
  if (loc.provider.id === 'codex') loc.allowed.push(legacyRoot);
  let legacy;
  if (stat(legacyFile)) {
    assertSafe(legacyFile, loc.allowed, { leafLink: false });
    legacy = JSON.parse(fs.readFileSync(legacyFile, 'utf8'));
    if (legacy.provider !== loc.provider.id || !legacy.installed) throw new Error('Неверная старая опись: ' + legacyFile);
    for (const kind of ['skills', 'agents', 'rules']) {
      if (!Array.isArray(legacy.installed[kind])) throw new Error('Неверная старая опись: ' + kind);
      for (const name of legacy.installed[kind]) {
        if (!NAME.test(kind === 'skills' ? name : name.replace(/\.md$/, ''))) throw new Error('Небезопасное имя в старой описи: ' + name);
      }
    }
  }
  for (const c of catalog.components.values()) {
    if (!selected.has(c.id) || c.kind === 'command') continue;
    const normal = destination(c, options, loc);
    const oldDest = loc.provider.id === 'codex' || loc.provider.id === 'cursor'
      ? path.join(legacyRoot, c.name + '.md') : normal;
    const current = stat(oldDest);
    if (!current) continue;
    assertSafe(oldDest, loc.allowed);
    const captured = [];
    if (current.isSymbolicLink() && path.resolve(path.dirname(oldDest), fs.readlinkSync(oldDest)) === path.resolve(c.src)) {
      captured.push(record({ path: oldDest, component: c.id, source: fs.readlinkSync(oldDest), kind: 'symlink', mode: 0o777 }));
    } else {
      const category = c.kind + 's';
      const declared = legacy?.installed[category]?.includes(c.kind === 'skill' ? c.name : c.name + '.md');
      if (!declared || current.isSymbolicLink()) { conflicts.push('Не подтверждена принадлежность: ' + oldDest); continue; }
      // Old inventory has no checksum: accept only byte-identical source/mirror
      // files. Additional or edited resources remain conflicts.
      const oldFiles = current.isDirectory() ? walkFiles(oldDest) : [oldDest];
      for (const file of oldFiles) {
        assertSafe(file, loc.allowed, { leafLink: false });
        const rel = current.isDirectory() ? path.relative(oldDest, file) : '';
        const src = c.kind === 'skill' ? path.join(c.src, rel || 'SKILL.md') : c.src;
        const mirror = c.kind === 'skill' ? path.join(options.source, 'skills', c.name, rel || 'SKILL.md')
          : path.join(options.source, category, c.name + '.md');
        const data = fs.readFileSync(file);
        if (![src, mirror].some(p => stat(p)?.isFile() && data.equals(fs.readFileSync(p)))) {
          if (options.overwrite) {
            const mode = stat(file).mode & 0o777;
            captured.push(record({ path: file, component: c.id, kind: 'file', mode, data }));
            replacements.push({ path: file, kind: 'file', mode, data, before: snapshot(file), backup: true });
            warnings.push('Принят по --overwrite с backup: ' + file);
          } else conflicts.push('Старая опись без checksum; изменённый/неизвестный файл: ' + file);
        } else captured.push(record({ path: file, component: c.id, kind: 'file', mode: stat(file).mode & 0o777, data }));
      }
    }
    state.files.push(...captured);
    const mode = options.modeExplicit ? options.mode : current.isSymbolicLink() ? 'symlink' : 'copy';
    state.components[c.id] = { ...componentRecord(c, { ...options, mode }, loc), destination: oldDest };
    state.roots.push(c.id);
  }
  if (new Set(state.files.map(f => f.path)).size !== state.files.length) conflicts.push('Несколько legacy-компонентов претендуют на один файл; принадлежность неоднозначна.');
  if (legacy) warnings.push('Старая опись сохранена для аудита: ' + legacyFile);
  warnings.push('migrate принимает владение подтверждёнными файлами. sync затем добавит зависимости и native форматы.');
  state.legacy = { manifest: legacy ? legacyFile : null, migratedAt: new Date().toISOString() };
  const result = { provider: loc.provider.id, scope: options.scope, components: state.roots.length,
    conflicts, warnings, changes: [{ path: loc.stateFile, action: 'write' }] };
  if (!conflicts.length && !options.dryRun) result.backups = apply(loc, replacements, null, state, null);
  output(options, result);
  return { ...result, failed: conflicts.length > 0 };
}
module.exports = { migrate };
