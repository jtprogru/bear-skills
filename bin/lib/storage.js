'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { ID, NAME } = require('./catalog');
const { destination } = require('./providers');

const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const inside = (base, file) => file === base || file.startsWith(base + path.sep);
function stat(file) {
  try { return fs.lstatSync(file); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}

// Canonicalize the existing ancestor once (macOS /var and /tmp are aliases).
// Descendants of an installation root must never redirect through symlinks.
function canonical(file) {
  file = path.resolve(file);
  let parent = file;
  const tail = [];
  while (!fs.existsSync(parent)) {
    tail.unshift(path.basename(parent));
    const next = path.dirname(parent);
    if (next === parent) throw new Error('Невозможно разрешить путь: ' + file);
    parent = next;
  }
  return path.join(fs.realpathSync(parent), ...tail);
}

function assertSafe(file, allowed, { leafLink = true, replacingParents = new Map() } = {}) {
  if (!path.isAbsolute(file) || path.normalize(file) !== file) throw new Error('Небезопасный путь: ' + file);
  const base = allowed.filter(root => inside(root, file)).sort((a, b) => b.length - a.length)[0];
  if (!base || file === base) throw new Error('Путь вне разрешённых каталогов: ' + file);
  // Check ancestors all the way up, including the root itself.
  let cursor = path.dirname(file);
  while (true) {
    const s = stat(cursor);
    if (s && (!s.isDirectory() || s.isSymbolicLink())) {
      if (!replacingParents.has(cursor) || !matches(replacingParents.get(cursor), snapshot(cursor))) {
        throw new Error('Небезопасный родитель: ' + cursor);
      }
    }
    const next = path.dirname(cursor);
    if (next === cursor) break;
    cursor = next;
  }
  const s = stat(file);
  if (s?.isSymbolicLink() && !leafLink) throw new Error('Симлинк вместо файла: ' + file);
  if (s && !s.isFile() && !s.isSymbolicLink() && !s.isDirectory()) throw new Error('Небезопасный тип: ' + file);
  if (s?.isFile() && s.nlink > 1) throw new Error('Hardlink вместо файла: ' + file);
}

function snapshot(file) {
  const s = stat(file);
  if (!s) return null;
  if (s.isSymbolicLink()) return { kind: 'symlink', link: fs.readlinkSync(file), mode: 0o777 };
  if (s.isFile()) return { kind: 'file', data: fs.readFileSync(file), mode: s.mode & 0o777 };
  return { kind: 'directory' };
}

function fingerprint(s) {
  return s && { kind: s.kind, sha256: hash(s.kind === 'symlink' ? s.link : s.data || ''), mode: s.mode };
}
function matches(record, current) {
  if (!record || !current || record.kind !== current.kind) return false;
  const f = fingerprint(current);
  return record.sha256 === f.sha256 && (record.kind === 'symlink' || record.mode === f.mode);
}
function record(file) {
  return { path: file.path, component: file.component, kind: file.kind, source: file.source,
    sha256: hash(file.kind === 'symlink' ? file.source : file.data), mode: file.kind === 'symlink' ? 0o777 : file.mode };
}

function readInventory(loc, options) {
  assertSafe(loc.stateFile, loc.allowed, { leafLink: false });
  if (!stat(loc.stateFile)) return null;
  const state = JSON.parse(fs.readFileSync(loc.stateFile, 'utf8'));
  if (state.schemaVersion !== 1 || state.provider !== loc.provider.id || state.scope !== options.scope ||
      state.root !== loc.root || state.skills !== loc.skills || (options.scope === 'project' && state.project !== options.project) ||
      !Array.isArray(state.files) || !state.components || typeof state.components !== 'object' || !Array.isArray(state.directories)) {
    throw new Error('Несовместимая/неверная опись: ' + loc.stateFile);
  }
  const seen = new Set();
  if (state.vault) {
    if (!path.isAbsolute(state.vault) || path.normalize(state.vault) !== state.vault || state.vault === path.parse(state.vault).root) {
      throw new Error('Неверный vault в описи');
    }
    if (loc.provider.id === 'claude-code' && options.scope === 'global') loc.allowed.push(path.join(state.vault, '.agents', 'rules'));
  }
  for (const [id, c] of Object.entries(state.components)) {
    if (!ID.test(id) || c.id !== id || c.kind + ':' + c.name !== id || !NAME.test(c.domain) ||
        !['dependencies', 'env', 'bins', 'mcp'].every(k => Array.isArray(c[k]))) throw new Error('Неверный компонент описи: ' + id);
    const expected = destination(c, { ...options, vault: state.vault || options.vault }, loc);
    const legacy = loc.provider.id === 'codex' ? path.join(loc.root, 'skills', c.name + '.md')
      : loc.provider.id === 'cursor' ? path.join(loc.root, 'rules', c.name + '.md') : expected;
    if (c.destination !== expected && (!state.legacy || c.destination !== legacy)) throw new Error('Небезопасный destination в описи: ' + id);
  }
  for (const f of state.files) {
    assertSafe(f.path, loc.allowed);
    if (seen.has(f.path) || !['file', 'symlink'].includes(f.kind) || !/^[0-9a-f]{64}$/.test(f.sha256) ||
        !Number.isInteger(f.mode) || (f.component !== '@runtime' && !Object.hasOwn(state.components, f.component))) {
      throw new Error('Неверная запись описи: ' + f.path);
    }
    if (f.path === loc.stateFile || inside(path.join(loc.stateDir, 'backups'), f.path)) throw new Error('Опись владеет служебным путём');
    if (f.component === '@runtime') {
      const valid = ['contract.md', 'session.cjs', 'index.md'].map(n => path.join(loc.stateDir, n));
      if (loc.provider.id === 'opencode') valid.push(path.join(loc.root, 'plugins', 'bear-skills.js'));
      if (!valid.includes(f.path)) throw new Error('Неверный runtime path: ' + f.path);
    } else {
      const c = state.components[f.component];
      const tree = c.kind === 'skill' || (c.kind === 'command' && loc.provider.id === 'codex');
      if (tree ? !inside(c.destination, f.path) : f.path !== c.destination) throw new Error('Файл вне компонента: ' + f.path);
    }
    seen.add(f.path);
  }
  for (const dir of state.directories) assertSafe(path.join(dir, '.path-check'), loc.allowed);
  if (state.config) {
    const expected = loc.provider.hookFile && path.join(loc.root, loc.provider.hookFile);
    if (state.config.path !== expected || state.config.event !== loc.provider.hookEvent) throw new Error('Неверный config в описи');
    assertSafe(state.config.path, loc.allowed, { leafLink: false });
  }
  return state;
}

const shellQuote = s => "'" + s.replace(/'/g, "'\\''") + "'";
function hookSpec(loc) {
  if (!loc.provider.hookFile) return null;
  const command = 'node ' + shellQuote(path.join(loc.stateDir, 'session.cjs'));
  return { path: path.join(loc.root, loc.provider.hookFile), event: loc.provider.hookEvent,
    entry: loc.provider.id === 'cursor' ? { command }
      : { hooks: [{ type: 'command', command }] } };
}

// Own one exact hook entry, never the user's whole settings file.
function configChange(loc, old, wanted, overwrite) {
  if (!old && !wanted) return null;
  const spec = wanted || old;
  assertSafe(spec.path, loc.allowed, { leafLink: false });
  const before = snapshot(spec.path);
  if (before && before.kind !== 'file') throw new Error('Config не обычный файл: ' + spec.path);
  let data = {};
  try { if (before) data = JSON.parse(before.data.toString('utf8')); }
  catch { throw new Error('Невалидный JSON config: ' + spec.path + ' (содержимое скрыто)'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Config должен быть JSON object');
  if (data.hooks !== undefined && (!data.hooks || typeof data.hooks !== 'object' || Array.isArray(data.hooks))) throw new Error('Неверный config.hooks');
  const entries = data.hooks?.[spec.event] || [];
  if (!Array.isArray(entries)) throw new Error('Неверный hooks.' + spec.event);
  const exact = x => JSON.stringify(x);
  let remaining = [...entries];
  let backup = false;
  if (old) {
    const index = remaining.findIndex(x => exact(x) === exact(old.entry));
    if (index < 0 && before) {
      if (!overwrite) throw new Error('Конфликт: изменён/удалён hook bear-skills в ' + spec.path);
      backup = true;
      // An altered entry cannot safely be recognized as ours. Keep it; explicit
      // overwrite adds the known hook, and doctor reports potential duplicates.
    } else if (index >= 0) remaining.splice(index, 1);
  }
  if (wanted) {
    if (!old && remaining.some(x => exact(x) === exact(wanted.entry))) throw new Error('Hook уже существует без описи; используй migrate');
    remaining.push(wanted.entry);
  }
  data.hooks ||= {};
  if (remaining.length) data.hooks[spec.event] = remaining;
  else delete data.hooks[spec.event];
  if (!Object.keys(data.hooks).length) delete data.hooks;
  let versionAdded = old?.versionAdded || false;
  if (loc.provider.id === 'cursor' && wanted) {
    if (data.version !== undefined && data.version !== 1) throw new Error('Неподдерживаемая версия Cursor hooks.json');
    if (data.version === undefined) { data.version = 1; versionAdded = true; }
  } else if (!wanted && versionAdded && data.version === 1) delete data.version;
  const content = Buffer.from(JSON.stringify(data, null, 2) + '\n');
  return { path: spec.path, before, data: Object.keys(data).length ? content : null, backup,
    record: wanted ? { ...wanted, versionAdded } : null };
}

function virtualSnapshot(file, replacingParents) {
  return [...replacingParents.keys()].some(parent => file !== parent && inside(parent, file)) ? null : snapshot(file);
}

function preflight(loc, desired, oldFiles, removing, overwrite, replacingParents = new Map()) {
  const owned = new Map(oldFiles.map(f => [f.path, f]));
  const changes = [], conflicts = [], seen = new Set();
  for (const file of desired) {
    assertSafe(file.path, loc.allowed, { replacingParents });
    if (seen.has(file.path)) throw new Error('Коллизия destination: ' + file.path);
    seen.add(file.path);
    const current = virtualSnapshot(file.path, replacingParents);
    const previous = owned.get(file.path);
    if (current?.kind === 'directory') throw new Error('Каталог вместо файла: ' + file.path);
    const foreign = current && !matches(previous, current);
    if (foreign && !overwrite) { conflicts.push('Конфликт: чужой/изменённый файл ' + file.path); continue; }
    if (!foreign && matches(record(file), current)) continue;
    changes.push({ ...file, before: current, backup: !!foreign });
  }
  for (const previous of removing) {
    assertSafe(previous.path, loc.allowed);
    const current = snapshot(previous.path);
    if (!current) continue;
    if (current.kind === 'directory') throw new Error('Каталог вместо управляемого файла: ' + previous.path);
    const changed = !matches(previous, current);
    if (changed && !overwrite) { conflicts.push('Конфликт: изменённый файл ' + previous.path); continue; }
    changes.unshift({ path: previous.path, before: current, data: null, backup: changed });
  }
  return { changes, conflicts };
}

function writeAtomic(file, value) {
  const temp = file + '.bear-tmp-' + crypto.randomBytes(8).toString('hex');
  try {
    if (value.kind === 'symlink') fs.symlinkSync(value.source || value.link, temp);
    else {
      fs.writeFileSync(temp, value.data, { flag: 'wx', mode: value.mode || 0o600 });
      fs.chmodSync(temp, value.mode || 0o600);
    }
    fs.renameSync(temp, file);
  } finally { if (stat(temp)) fs.unlinkSync(temp); }
}

function apply(loc, changes, config, inventory, oldState, replacingParents = new Map()) {
  const created = [], applied = [], backups = [];
  const mkdir = dir => {
    if (stat(dir)) return;
    mkdir(path.dirname(dir));
    fs.mkdirSync(dir);
    created.push(dir);
  };
  assertSafe(loc.stateFile, loc.allowed, { leafLink: false });
  mkdir(loc.stateDir);
  const lock = path.join(loc.stateDir, 'install.lock');
  let fd;
  try { fd = fs.openSync(lock, 'wx', 0o600); }
  catch (e) {
    for (const dir of created.reverse()) { try { fs.rmdirSync(dir); } catch {} }
    throw new Error('Установка уже выполняется или оставлен lock: ' + lock + ' (' + e.code + ')');
  }
  const backupRoot = path.join(loc.stateDir, 'backups', Date.now() + '-' + crypto.randomBytes(4).toString('hex'));
  const ops = [...changes];
  if (config && !(config.before?.data?.equals(config.data || Buffer.alloc(0))) && (config.before || config.data)) {
    ops.push({ path: config.path, kind: 'file', mode: config.before?.mode || 0o600,
      data: config.data, before: config.before, backup: config.backup });
  }
  ops.push({ path: loc.stateFile, kind: 'file', mode: 0o600,
    data: Buffer.from(JSON.stringify(inventory, null, 2) + '\n'), before: oldState });
  try {
    // Optimistic concurrency check under lock. No write to component files until
    // every path and snapshot has been rechecked.
    for (const op of ops) {
      assertSafe(op.path, loc.allowed, { leafLink: op.path !== loc.stateFile && op.path !== config?.path, replacingParents });
      if (JSON.stringify(fingerprint(virtualSnapshot(op.path, replacingParents))) !== JSON.stringify(fingerprint(op.before))) {
        throw new Error('Файл изменился во время подготовки: ' + op.path);
      }
    }
    for (const op of ops) {
      if (op.backup && op.before) {
        const backup = path.join(backupRoot, String(backups.length).padStart(4, '0'));
        assertSafe(backup, loc.allowed, { leafLink: false });
        mkdir(path.dirname(backup));
        writeAtomic(backup, op.before);
        backups.push({ original: op.path, backup });
      }
      mkdir(path.dirname(op.path));
      if (op.path === loc.stateFile) {
        inventory.directories = [...new Set([...inventory.directories, ...created])]
          .filter(dir => loc.allowed.some(root => inside(root, dir))).sort();
        op.data = Buffer.from(JSON.stringify(inventory, null, 2) + '\n');
      }
      if (op.data === null && op.kind !== 'symlink') fs.unlinkSync(op.path);
      else writeAtomic(op.path, op);
      applied.push(op);
    }
    if (backups.length) writeAtomic(path.join(backupRoot, 'index.json'), {
      kind: 'file', mode: 0o600, data: Buffer.from(JSON.stringify(backups, null, 2) + '\n') });
  } catch (e) {
    for (const op of applied.reverse()) {
      if (op.before) {
        if (stat(op.path)?.isDirectory()) {
          // Only directories made by this transaction can obstruct restoring a
          // legacy directory symlink. No recursive removal of user data.
          for (const dir of [...created].sort((a, b) => b.length - a.length)) {
            if (inside(op.path, dir)) { try { fs.rmdirSync(dir); } catch {} }
          }
        }
        writeAtomic(op.path, op.before);
      }
      else if (stat(op.path)) fs.unlinkSync(op.path);
    }
    throw e;
  } finally {
    fs.closeSync(fd);
    fs.unlinkSync(lock);
    for (const dir of [...created].reverse()) { try { fs.rmdirSync(dir); } catch {} }
  }
  // Only empty, explicitly recorded directories can be removed.
  for (const dir of [...inventory.directories].sort((a, b) => b.length - a.length)) {
    assertSafe(path.join(dir, '.path-check'), loc.allowed);
    try { fs.rmdirSync(dir); } catch (e) { if (!['ENOTEMPTY', 'EEXIST', 'ENOENT'].includes(e.code)) throw e; }
  }
  return backups;
}

module.exports = { hash, inside, stat, canonical, assertSafe, snapshot, fingerprint, matches, record,
  readInventory, hookSpec, configChange, preflight, apply, shellQuote };
