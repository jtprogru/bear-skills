'use strict';

const fs = require('node:fs');
const path = require('node:path');

function parseManifestYaml(text) {
  const m = {
    name: null,
    description: null,
    requires_env: [],
    requires_bin: { domain: [], components: {} },
    targets: {},
    dependencies: {},
    requires_mcp: {},
  };
  const lines = text.split('\n');
  let section = null;
  // Для requires_bin: имя бинаря, чей вложенный список компонентов сейчас читаем,
  // и отступ его ключа — по нему отличаем `- item` домена от `- item` компонента.
  let currentBin = null;
  let currentBinIndent = 0;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.replace(/#.*$/, '').trimEnd();
    if (!line.trim()) continue;

    // Top-level: key: value
    const topMatch = line.match(/^([a-z_]+):\s*(.*)$/);
    const isIndented = /^\s+/.test(raw);

    if (!isIndented && topMatch) {
      const [, k, v] = topMatch;
      currentBin = null;
      if (k === 'name') {
        m.name = v.trim();
        section = null;
      } else if (k === 'description') {
        m.description = v.trim();
        section = null;
      } else if (k === 'requires_env') {
        section = 'requires_env';
        if (v.trim() && v.trim() !== '[]') {
          if (!/^\[\s*[A-Z_][A-Z0-9_]*(?:\s*,\s*[A-Z_][A-Z0-9_]*)*\s*\]$/.test(v.trim())) throw new Error('manifest: неверный requires_env');
          m.requires_env.push(...v.trim().slice(1, -1).split(',').map(x => x.trim()));
        }
      } else if (k === 'requires_bin') {
        section = 'requires_bin';
        if (v.trim() && v.trim() !== '[]') throw new Error('manifest: requires_bin использует блочную запись');
      } else if (k === 'targets') {
        section = 'targets';
      } else if (k === 'dependencies' || k === 'requires_mcp') {
        section = k;
      } else {
        section = null;
      }
      continue;
    }

    if (section === 'dependencies' || section === 'requires_mcp') {
      const key = line.match(/^  ([a-zA-Z0-9_:.-]+):\s*$/);
      const item = line.match(/^    -\s+([a-zA-Z0-9_:.-]+)\s*$/);
      if (key) {
        currentBin = key[1];
        if (Object.hasOwn(m[section], currentBin)) throw new Error(`manifest: duplicate ${currentBin}`);
        m[section][currentBin] = [];
      } else if (item && currentBin) m[section][currentBin].push(item[1]);
      else throw new Error(`manifest ${m.name}: неверная строка ${section}: ${line}`);
    } else if (section === 'requires_env') {
      const itemMatch = line.match(/^\s*-\s+(.+)$/);
      if (itemMatch) m.requires_env.push(itemMatch[1].trim());
    } else if (section === 'requires_bin') {
      const indent = raw.match(/^\s*/)[0].length;
      const itemMatch = line.match(/^\s*-\s+(.+)$/);
      const keyMatch = line.match(/^\s*([A-Za-z0-9_.-]+):\s*$/);
      if (keyMatch) {
        currentBin = keyMatch[1];
        currentBinIndent = indent;
        if (!m.requires_bin.components[currentBin]) {
          m.requires_bin.components[currentBin] = [];
        }
      } else if (itemMatch) {
        // Элемент глубже ключа бинаря — его компонент; иначе доменный бинарь.
        if (currentBin && indent > currentBinIndent) {
          m.requires_bin.components[currentBin].push(itemMatch[1].trim());
        } else {
          currentBin = null;
          m.requires_bin.domain.push(itemMatch[1].trim());
        }
      }
    } else if (section === 'targets') {
      const subMatch = line.match(/^\s+([a-z_]+):\s*(.+)$/);
      if (subMatch) m.targets[subMatch[1]] = subMatch[2].trim();
    }
  }
  if (!m.name) throw new Error('manifest: нет поля name');
  if (!m.targets.rules && !m.targets.skills && !m.targets.agents) {
    throw new Error(`manifest ${m.name}: ни одного targets.<rules|skills|agents>`);
  }
  for (const [bin, items] of Object.entries(m.requires_bin.components)) {
    if (items.length === 0) {
      throw new Error(
        `manifest ${m.name}: requires_bin.${bin} объявлен, но список компонентов пуст`,
      );
    }
    for (const it of items) {
      if (!/^(skill|rule|agent):.+$/.test(it)) {
        throw new Error(
          `manifest ${m.name}: requires_bin.${bin} — "${it}" не в форме skill:/rule:/agent:<name>`,
        );
      }
    }
  }
  return m;
}

function hasBin(name) {
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const dir of dirs) {
    const candidate = path.join(dir, name);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      if (fs.statSync(candidate).isFile()) return true;
    } catch {
      /* следующий каталог */
    }
  }
  return false;
}

function loadDomain(domainDir) {
  const manifestPath = path.join(domainDir, 'manifest.yaml');
  if (!fs.existsSync(manifestPath)) return null;
  const text = fs.readFileSync(manifestPath, 'utf8');
  const m = parseManifestYaml(text);
  return {
    name: m.name,
    description: m.description || '',
    requires_env: m.requires_env || [],
    requires_bin: m.requires_bin || { domain: [], components: {} },
    dependencies: m.dependencies,
    requires_mcp: m.requires_mcp,
    targets: m.targets,
    dir: domainDir,
    rulesSrc: path.join(domainDir, 'rules'),
    skillsSrc: path.join(domainDir, 'skills'),
    agentsSrc: path.join(domainDir, 'agents'),
    commandsSrc: path.join(domainDir, 'commands'),
  };
}

function loadAllDomains(source) {
  const domainsDir = path.join(source, 'domains');
  if (!fs.existsSync(domainsDir)) return [];
  return fs
    .readdirSync(domainsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => loadDomain(path.join(domainsDir, d.name)))
    .filter(Boolean);
}

function listSubdirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

function listFiles(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && (!ext || d.name.endsWith(ext)))
    .map((d) => d.name);
}

function listDomainComponents(domain) {
  return {
    commands: domain.commandsSrc ? listFiles(domain.commandsSrc, '.md').map(f => f.replace(/\.md$/, '')) : [],
    rules: listFiles(domain.rulesSrc, '.md').map((f) => f.replace(/\.md$/, '')),
    skills: listSubdirs(domain.skillsSrc),
    agents: listFiles(domain.agentsSrc, '.md').map((f) =>
      f.replace(/\.md$/, ''),
    ),
  };
}

function readFrontmatter(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  if (lines[0] !== '---') return { error: 'нет YAML-фронтматтера' };
  let close = -1;
  for (let i = 1; i < Math.min(lines.length, 40); i++) {
    if (lines[i] === '---') {
      close = i;
      break;
    }
  }
  if (close < 0) return { error: 'фронтматтер не закрыт' };
  const fm = lines.slice(1, close).join('\n');
  if (!/^name:/m.test(fm)) return { error: 'нет поля name' };
  if (!/^description:/m.test(fm)) return { error: 'нет поля description' };
  return { ok: true };
}

module.exports = { parseManifestYaml, hasBin, loadDomain, loadAllDomains, listSubdirs, listFiles, listDomainComponents, readFrontmatter };

const KINDS = { skill: 'skills', rule: 'rules', agent: 'agents', command: 'commands' };
const NAME = /^[a-z0-9][a-z0-9_-]*$/;
const ID = /^(skill|rule|agent|command):[a-z0-9][a-z0-9_-]*$/;
const JUNK = new Set(['.DS_Store', '__pycache__', '.pytest_cache', '.ruff_cache']);

// Keep original frontmatter for Claude. Other adapters must explicitly handle
// or reject each capability-bearing field; this parser only extracts scalars.
function frontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return { fields: {}, body: text, header: '' };
  const fields = {};
  let key;
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^([\w-]+):\s*(.*)$/);
    if (m) {
      key = m[1];
      let value = m[2].trim();
      if (value.startsWith('"')) {
        try { value = JSON.parse(value); } catch { throw new Error('Неверный YAML scalar: ' + key); }
      } else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1).replace(/''/g, "'");
      fields[key] = value;
    } else if (key === 'description' && /^\s+\S/.test(line)) {
      fields[key] = /^[>|][-+]?$/.test(fields[key]) ? line.trim() : fields[key] + ' ' + line.trim();
    }
  }
  return { fields, body: text.slice(match[0].length), header: match[1] };
}

function walkFiles(dir) {
  const files = [];
  function walk(base) {
    for (const entry of fs.readdirSync(base, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (JUNK.has(entry.name) || entry.name.endsWith('.pyc')) continue;
      const file = path.join(base, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Симлинк в исходном пакете: ' + file);
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile()) files.push(file);
      else throw new Error('Необычный тип исходного файла: ' + file);
    }
  }
  walk(dir);
  return files;
}

function loadCatalog(source) {
  const domains = loadAllDomains(source);
  if (!domains.length) throw new Error('В ' + source + ' нет domains/<name>/manifest.yaml');
  const components = new Map();
  const domainNames = new Set();
  for (const d of domains) {
    if (!NAME.test(d.name) || domainNames.has(d.name)) throw new Error('Неверное/повторное имя домена: ' + d.name);
    domainNames.add(d.name);
    for (const [kind, folder] of Object.entries(KINDS)) {
      const base = path.join(d.dir, folder);
      if (!fs.existsSync(base)) continue;
      for (const entry of fs.readdirSync(base, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (JUNK.has(entry.name)) continue;
        if (entry.isSymbolicLink()) throw new Error('Симлинк в каталоге: ' + base + '/' + entry.name);
        if (kind === 'skill' ? !entry.isDirectory() : !entry.isFile() || !entry.name.endsWith('.md')) continue;
        const name = kind === 'skill' ? entry.name : entry.name.slice(0, -3);
        const id = kind + ':' + name;
        if (!NAME.test(name) || components.has(id)) throw new Error('Коллизия/неверное имя компонента: ' + id);
        const src = path.join(base, entry.name);
        const files = kind === 'skill' ? walkFiles(src) : [src];
        const entryFile = kind === 'skill' ? path.join(src, 'SKILL.md') : src;
        const meta = frontmatter(fs.readFileSync(entryFile, 'utf8'));
        if (kind !== 'rule' && !meta.fields.description) throw new Error(id + ': нет description');
        components.set(id, { id, kind, name, domain: d.name, src, files, entryFile, meta,
          dependencies: d.dependencies?.[id] || [], bins: [...d.requires_bin.domain],
          env: d.requires_env, mcp: [] });
      }
    }
  }
  for (const d of domains) {
    for (const id of Object.keys(d.dependencies || {})) {
      if (components.get(id)?.domain !== d.name) throw new Error(d.name + ': неизвестный компонент dependencies ' + id);
    }
    for (const [bin, ids] of Object.entries(d.requires_bin.components)) {
      if (!/^[A-Za-z0-9_.-]+$/.test(bin)) throw new Error('Неверное имя CLI: ' + bin);
      for (const id of ids) {
        if (components.get(id)?.domain !== d.name) throw new Error(d.name + ': неизвестный компонент requires_bin ' + id);
        components.get(id).bins.push(bin);
      }
    }
    for (const [requirement, ids] of Object.entries(d.requires_mcp || {})) {
      const [server, tool, extra] = requirement.split(':');
      if (!server || !tool || extra || !ids.length) throw new Error('Неверное requires_mcp: ' + requirement);
      for (const id of ids) {
        if (components.get(id)?.domain !== d.name) throw new Error(d.name + ': неизвестный компонент requires_mcp ' + id);
        components.get(id).mcp.push({ server, tool });
      }
    }
  }
  const visiting = new Set(), visited = new Set();
  function visit(id, chain = []) {
    if (!ID.test(id) || !components.has(id)) throw new Error('Неизвестная зависимость: ' + [...chain, id].join(' → '));
    if (visiting.has(id)) throw new Error('Цикл зависимостей: ' + [...chain, id].join(' → '));
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dep of components.get(id).dependencies) visit(dep, [...chain, id]);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of components.keys()) visit(id);
  for (const c of components.values()) {
    const reachable = new Set([c.id]);
    const collect = id => {
      for (const dep of components.get(id).dependencies) if (!reachable.has(dep)) { reachable.add(dep); collect(dep); }
    };
    collect(c.id);
    for (const file of c.files.filter(f => /\.(md|txt|json|yaml|yml)$/.test(f))) {
      const text = fs.readFileSync(file, 'utf8');
      for (const m of text.matchAll(/\{\{((?:rule|skill|agent|command):[a-z0-9_-]+)\}\}/g)) {
        if (!components.has(m[1])) throw new Error('Неизвестная resource-ссылка: ' + file + ' → ' + m[1]);
        if (!reachable.has(m[1])) throw new Error('Resource отсутствует в dependencies: ' + c.id + ' → ' + m[1]);
      }
    }
  }
  return { source, domains, components };
}

function select(catalog, selectors = []) {
  if (!selectors.length) return [...catalog.components.keys()];
  const selected = new Set();
  for (const item of selectors) {
    if (catalog.domains.some(d => d.name === item)) {
      for (const c of catalog.components.values()) if (c.domain === item) selected.add(c.id);
    } else {
      const matches = [...catalog.components.values()].filter(c => item === c.id || item === c.name);
      if (matches.length !== 1) throw new Error('Компонент "' + item + '" ' + (matches.length ? 'неоднозначен' : 'не найден'));
      selected.add(matches[0].id);
    }
  }
  return [...selected];
}

function resolveDependencies(catalog, roots, unavailable = () => null) {
  const selected = new Set(), skipped = [];
  function visit(id, chain, result) {
    if (result.has(id)) return;
    const component = catalog.components.get(id);
    if (!component) throw new Error('Компонент ' + id + ' не найден');
    const reason = unavailable(component);
    if (reason) throw new Error([...chain, id].join(' → ') + ': ' + reason);
    for (const dep of component.dependencies) visit(dep, [...chain, id], result);
    result.add(id);
  }
  for (const id of roots) {
    const result = new Set();
    try {
      visit(id, [], result);
      for (const dep of result) selected.add(dep);
    } catch (e) { skipped.push({ id, reason: e.message }); }
  }
  return { selected: [...selected], skipped };
}

module.exports = { ...module.exports, KINDS, NAME, ID, frontmatter, walkFiles, loadCatalog, select, resolveDependencies };


function frontmatterDescription(text) {
  const lines = text.split('\n');
  if (lines[0] !== '---') return '';
  let close = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      close = i;
      break;
    }
  }
  if (close < 0) return '';
  const fm = lines.slice(1, close);
  const start = fm.findIndex((l) => /^description:/.test(l));
  if (start < 0) return '';
  const out = [fm[start].replace(/^description:\s*[>|]?-?\s*/, '')];
  for (let i = start + 1; i < fm.length; i++) {
    if (/^\S/.test(fm[i])) break; // следующий ключ верхнего уровня
    out.push(fm[i].trim());
  }
  return out.join(' ');
}


function triggerWords(description) {
  const quoted = [...description.matchAll(/«([^»]{4,60})»/g)]
    .map((m) => m[1].toLowerCase().trim())
    // Одно короткое слово — не триггер, а шум вроде «плохо» или «хорошо».
    .filter((s) => s.includes(' ') || s.length >= 8);
  return new Set(quoted);
}

module.exports = { ...module.exports, frontmatterDescription, triggerWords };
