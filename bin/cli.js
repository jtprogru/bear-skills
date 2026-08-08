#!/usr/bin/env node
/* eslint-disable no-console */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const HOME = os.homedir();
const REPO_URL = 'https://github.com/jtprogru/bear-skills.git';
const DEFAULT_SOURCE = path.join(HOME, '.bear-skills');
const DEFAULT_CLAUDE_HOME = path.join(HOME, '.claude');

// ─────────────────────────────────────────────────────────────────────────────
// Парсинг аргументов
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      let key, val;
      if (eq > -1) {
        key = a.slice(2, eq);
        val = a.slice(eq + 1);
      } else {
        key = a.slice(2);
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith('--')) {
          val = next;
          i++;
        } else {
          val = true;
        }
      }
      args.flags[key] = val;
    } else {
      args._.push(a);
    }
  }
  return args;
}

function resolveOpts(args) {
  return {
    vault: args.flags.vault
      ? path.resolve(String(args.flags.vault))
      : process.env.BEAR_VAULT
        ? path.resolve(process.env.BEAR_VAULT)
        : null,
    claudeHome: args.flags['claude-home']
      ? path.resolve(String(args.flags['claude-home']))
      : DEFAULT_CLAUDE_HOME,
    dryRun: !!args.flags['dry-run'],
    noClone: !!args.flags['no-clone'] || !!args.flags.source,
    force: !!args.flags.force,
  };
}

function resolveSource(args) {
  if (args.flags.source) return path.resolve(String(args.flags.source));
  return DEFAULT_SOURCE;
}

// ─────────────────────────────────────────────────────────────────────────────
// Git source-management
// ─────────────────────────────────────────────────────────────────────────────

function isGitRepo(dir) {
  return fs.existsSync(path.join(dir, '.git'));
}

function git(args, cwd) {
  execFileSync('git', args, { stdio: 'inherit', cwd });
}

function ensureSource(source, opts) {
  if (isGitRepo(source)) {
    if (opts.noClone) return;
    console.log(`📥 git pull в ${source}...`);
    try {
      git(['-C', source, 'pull', '--ff-only'], undefined);
    } catch {
      console.warn('  ⚠️  git pull не удался, продолжаю с локальной копией');
    }
    return;
  }
  if (opts.noClone) {
    if (!fs.existsSync(source)) {
      throw new Error(
        `source ${source} не существует, --no-clone/--source не позволяет клонировать`,
      );
    }
    return;
  }
  if (fs.existsSync(source) && fs.readdirSync(source).length > 0) {
    throw new Error(
      `${source} существует и не пустой, но не git-репо. Удали вручную или укажи --source`,
    );
  }
  console.log(`📥 git clone ${REPO_URL} → ${source}...`);
  git(['clone', REPO_URL, source]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Манифесты доменов
// ─────────────────────────────────────────────────────────────────────────────

// Простой YAML-парсер для нашего узкого формата:
//   name: <string>
//   description: <string>
//   requires_env:
//     - VAR1
//     - VAR2
//   requires_bin:
//     - foo                  # бинарь нужен всему домену: нет его — домен пропущен
//     bar:                   # бинарь нужен только перечисленным компонентам
//       - skill:some-skill   # нет его — пропущены только они, остальной домен ставится
//   targets:
//     rules:  <path-with-${vars}>
//     skills: <path>
//     agents: <path>
function parseManifestYaml(text) {
  const m = {
    name: null,
    description: null,
    requires_env: [],
    requires_bin: { domain: [], components: {} },
    targets: {},
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
      } else if (k === 'requires_bin') {
        section = 'requires_bin';
      } else if (k === 'targets') {
        section = 'targets';
      } else {
        section = null;
      }
      continue;
    }

    if (section === 'requires_env') {
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

// Есть ли исполняемый файл с таким именем в PATH.
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

// Подстановка ${VAR} из process.env + специальные переменные.
function expandPath(p, env) {
  return p.replace(/\$\{([A-Z_][A-Z0-9_]*)\}/g, (_, key) => {
    if (env[key] === undefined) {
      throw new Error(`не задана переменная ${key} для пути "${p}"`);
    }
    return env[key];
  });
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
    targets: m.targets,
    dir: domainDir,
    rulesSrc: path.join(domainDir, 'rules'),
    skillsSrc: path.join(domainDir, 'skills'),
    agentsSrc: path.join(domainDir, 'agents'),
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

function resolveTargets(domain, opts) {
  const env = {
    ...process.env,
    CLAUDE_HOME: opts.claudeHome,
    BEAR_VAULT: opts.vault || process.env.BEAR_VAULT || '',
  };
  const missing = domain.requires_env.filter((v) => !env[v]);
  if (missing.length > 0) {
    return { error: `требует env: ${missing.join(', ')}` };
  }
  const missingBins = (domain.requires_bin?.domain || []).filter((b) => !hasBin(b));
  if (missingBins.length > 0) {
    return { error: `требует бинарь в PATH: ${missingBins.join(', ')}` };
  }
  const targets = {};
  for (const [k, v] of Object.entries(domain.targets)) {
    targets[k] = path.resolve(expandPath(v, env));
  }
  return { targets };
}

// ─────────────────────────────────────────────────────────────────────────────
// FS-операции
// ─────────────────────────────────────────────────────────────────────────────

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

function ensureDir(dir, dryRun) {
  if (fs.existsSync(dir)) return;
  if (dryRun) {
    console.log(`  [dry] mkdir -p ${dir}`);
    return;
  }
  fs.mkdirSync(dir, { recursive: true });
}

function linkOne(src, dst, dryRun) {
  if (dryRun) {
    console.log(`  [dry] ln -sfn ${src} ${dst}`);
    return;
  }
  try {
    const st = fs.lstatSync(dst);
    if (st.isSymbolicLink() || st.isFile()) {
      fs.unlinkSync(dst);
    } else if (st.isDirectory()) {
      fs.rmSync(dst, { recursive: true, force: true });
    }
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  fs.symlinkSync(src, dst);
}

function unlinkSymlink(dst, dryRun) {
  let st;
  try {
    st = fs.lstatSync(dst);
  } catch {
    return false;
  }
  if (!st.isSymbolicLink()) return false;
  if (dryRun) {
    console.log(`  [dry] rm ${dst}`);
    return true;
  }
  fs.unlinkSync(dst);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Каталог компонентов
// ─────────────────────────────────────────────────────────────────────────────

function listDomainComponents(domain) {
  return {
    rules: listFiles(domain.rulesSrc, '.md').map((f) => f.replace(/\.md$/, '')),
    skills: listSubdirs(domain.skillsSrc),
    agents: listFiles(domain.agentsSrc, '.md').map((f) =>
      f.replace(/\.md$/, ''),
    ),
  };
}

// Компоненты домена, заблокированные отсутствующим бинарём.
// Возвращает Map "skill:name" → имя недостающего бинаря.
function blockedByMissingBin(domain) {
  const blocked = new Map();
  const components = domain.requires_bin?.components || {};
  for (const [bin, items] of Object.entries(components)) {
    if (hasBin(bin)) continue;
    for (const it of items) blocked.set(it, bin);
  }
  return blocked;
}

// Выкидывает из picked то, чего нельзя ставить без бинаря.
// Возвращает {picked, dropped: [{key, bin}]}.
function applyBinGate(picked, blocked) {
  if (blocked.size === 0) return { picked, dropped: [] };
  const dropped = [];
  const out = { rules: [], skills: [], agents: [] };
  const singular = { rules: 'rule', skills: 'skill', agents: 'agent' };
  for (const cat of ['rules', 'skills', 'agents']) {
    for (const n of picked[cat]) {
      const key = `${singular[cat]}:${n}`;
      const bin = blocked.get(key);
      if (bin) dropped.push({ key, bin });
      else out[cat].push(n);
    }
  }
  return { picked: out, dropped };
}

// Из позиционных аргументов делаем фильтр {domains: Set, items: Set}.
// items могут быть строками "skill:name", "rule:name", "agent:name", "name".
function parseSelection(args, allDomains) {
  const positional = args._.slice(1); // первый — команда
  const domainNames = new Set(allDomains.map((d) => d.name));
  const sel = { domains: new Set(), items: [] };
  let explicit = false;

  // Поддержка флага --domains=a,b
  const flagDomains = args.flags.domains;
  if (flagDomains && flagDomains !== true) {
    for (const d of String(flagDomains).split(',').map((s) => s.trim()).filter(Boolean)) {
      if (!domainNames.has(d)) throw new Error(`Домен "${d}" не найден.`);
      sel.domains.add(d);
      explicit = true;
    }
  }

  for (const p of positional) {
    explicit = true;
    if (p.includes(':')) {
      const [type, name] = p.split(':', 2);
      if (!['skill', 'rule', 'agent'].includes(type)) {
        throw new Error(`Неизвестный тип "${type}". Используй skill:/rule:/agent:`);
      }
      sel.items.push({ type, name });
    } else if (domainNames.has(p)) {
      sel.domains.add(p);
    } else {
      sel.items.push({ type: null, name: p }); // авто-детект позже
    }
  }

  return { selection: sel, explicit };
}

// Применяем selection к домену: возвращаем что именно ставить из него.
function pickFromDomain(domain, selection, explicit) {
  const all = listDomainComponents(domain);
  if (!explicit) {
    return all;
  }

  // Если домен явно перечислен — ставим из него всё.
  if (selection.domains.has(domain.name)) {
    return all;
  }

  // Иначе — ищем items, которые ссылаются на компоненты этого домена.
  const picked = { rules: [], skills: [], agents: [] };
  for (const it of selection.items) {
    const tryAdd = (cat, name) => {
      if (all[cat].includes(name) && !picked[cat].includes(name)) {
        picked[cat].push(name);
        return true;
      }
      return false;
    };
    if (it.type === 'skill') tryAdd('skills', it.name);
    else if (it.type === 'rule') tryAdd('rules', it.name);
    else if (it.type === 'agent') tryAdd('agents', it.name);
    else {
      // авто-детект
      tryAdd('skills', it.name) ||
        tryAdd('rules', it.name) ||
        tryAdd('agents', it.name);
    }
  }
  return picked;
}

// Симлинк-установка (этот CLI) и копирующая (плагин Claude Code, npx skills add)
// кладут скиллы в пересекающиеся места. Два канала разом дают дубли имён и
// непредсказуемое срабатывание, поэтому предупреждаем, но не блокируем.
function warnMixedInstall(opts) {
  const pluginsDir = path.join(opts.claudeHome, 'plugins');
  if (!fs.existsSync(pluginsDir)) return;
  let hits = [];
  const walk = (dir, depth) => {
    if (depth > 4) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name === 'skills' && /bear-skills/.test(dir)) {
        hits.push(path.join(dir, e.name));
        continue;
      }
      walk(path.join(dir, e.name), depth + 1);
    }
  };
  walk(pluginsDir, 0);
  if (hits.length === 0) return;
  console.log('');
  console.log('⚠️  bear-skills установлен ДВУМЯ каналами одновременно:');
  console.log(`   симлинки → ${path.join(opts.claudeHome, 'skills')}`);
  for (const h of hits) console.log(`   копии    → ${h}`);
  console.log('   Дубли имён делают срабатывание скиллов непредсказуемым.');
  console.log('   Оставь один канал: сними симлинки (bear-skills uninstall)');
  console.log('   либо удали плагин (claude plugin uninstall bear-skills).');
}

// ─────────────────────────────────────────────────────────────────────────────
// Команды
// ─────────────────────────────────────────────────────────────────────────────

function cmdInstall(args) {
  const opts = resolveOpts(args);
  const source = resolveSource(args);
  ensureSource(source, opts);
  const domains = loadAllDomains(source);
  if (domains.length === 0) {
    throw new Error(`В ${source} нет доменов (папки domains/<name>/manifest.yaml)`);
  }

  const { selection, explicit } = parseSelection(args, domains);

  // Валидация: явные имена должны где-то существовать
  if (explicit) {
    const allItems = new Set();
    for (const d of domains) {
      const c = listDomainComponents(d);
      c.rules.forEach((n) => allItems.add(`rule:${n}`));
      c.skills.forEach((n) => allItems.add(`skill:${n}`));
      c.agents.forEach((n) => allItems.add(`agent:${n}`));
    }
    for (const it of selection.items) {
      if (it.type) {
        if (!allItems.has(`${it.type}:${it.name}`)) {
          throw new Error(`Компонент ${it.type}:${it.name} не найден.`);
        }
      } else {
        const candidates = ['skill', 'rule', 'agent'].filter((t) =>
          allItems.has(`${t}:${it.name}`),
        );
        if (candidates.length === 0) {
          throw new Error(
            `Компонент "${it.name}" не найден. Запусти "bear-skills list".`,
          );
        }
        if (candidates.length > 1) {
          throw new Error(
            `Имя "${it.name}" неоднозначно (${candidates.join(', ')}). Уточни префиксом.`,
          );
        }
      }
    }
  }

  let totalLinked = 0;
  let skippedDomains = [];
  let droppedComponents = [];

  for (const d of domains) {
    // если явный отбор и этот домен не задействован — пропускаем
    if (explicit) {
      const picked = pickFromDomain(d, selection, explicit);
      if (
        picked.rules.length === 0 &&
        picked.skills.length === 0 &&
        picked.agents.length === 0
      ) {
        continue;
      }
    }

    const r = resolveTargets(d, opts);
    if (r.error) {
      skippedDomains.push({ name: d.name, reason: r.error });
      continue;
    }

    const gate = applyBinGate(
      pickFromDomain(d, selection, explicit),
      blockedByMissingBin(d),
    );
    const picked = gate.picked;
    droppedComponents.push(...gate.dropped.map((x) => ({ ...x, domain: d.name })));
    console.log(`\n📦 ${d.name}`);
    console.log(`   rules  → ${r.targets.rules || '—'}`);
    console.log(`   skills → ${r.targets.skills || '—'}`);
    console.log(`   agents → ${r.targets.agents || '—'}`);

    if (picked.rules.length > 0 && r.targets.rules) {
      ensureDir(r.targets.rules, opts.dryRun);
      for (const n of picked.rules) {
        const src = path.join(d.rulesSrc, `${n}.md`);
        const dst = path.join(r.targets.rules, `${n}.md`);
        linkOne(src, dst, opts.dryRun);
        console.log(`   rule:  ${n}`);
        totalLinked++;
      }
    }
    if (picked.skills.length > 0 && r.targets.skills) {
      ensureDir(r.targets.skills, opts.dryRun);
      for (const n of picked.skills) {
        const src = path.join(d.skillsSrc, n);
        const dst = path.join(r.targets.skills, n);
        linkOne(src, dst, opts.dryRun);
        console.log(`   skill: ${n}`);
        totalLinked++;
      }
    }
    if (picked.agents.length > 0 && r.targets.agents) {
      ensureDir(r.targets.agents, opts.dryRun);
      for (const n of picked.agents) {
        const src = path.join(d.agentsSrc, `${n}.md`);
        const dst = path.join(r.targets.agents, `${n}.md`);
        linkOne(src, dst, opts.dryRun);
        console.log(`   agent: ${n}`);
        totalLinked++;
      }
    }
  }

  console.log('');
  if (skippedDomains.length > 0) {
    console.log('⚠️  Пропущены домены:');
    for (const s of skippedDomains) {
      console.log(`   ${s.name}: ${s.reason}`);
    }
  }
  if (droppedComponents.length > 0) {
    console.log('⚠️  Пропущены компоненты (нет бинаря в PATH):');
    for (const c of droppedComponents) {
      console.log(`   [${c.domain}] ${c.key} — требует "${c.bin}"`);
    }
  }
  console.log(`\n✅ Развёрнуто компонентов: ${totalLinked}`);
  warnMixedInstall(opts);
}

function cmdUninstall(args) {
  const opts = resolveOpts(args);
  const source = resolveSource(args);
  if (!fs.existsSync(source)) {
    console.log(`Source ${source} не существует — сканирую цели на симлинки в bear-skills.`);
    return cmdUninstallByScan(opts);
  }
  const domains = loadAllDomains(source);
  const { selection, explicit } = parseSelection(args, domains);

  let removed = 0;
  for (const d of domains) {
    const r = resolveTargets(d, opts);
    if (r.error) continue;
    const picked = pickFromDomain(d, selection, explicit);

    for (const n of picked.rules) {
      if (r.targets.rules) {
        const dst = path.join(r.targets.rules, `${n}.md`);
        if (unlinkSymlink(dst, opts.dryRun)) {
          console.log(`  unlinked: ${dst}`);
          removed++;
        }
      }
    }
    for (const n of picked.skills) {
      if (r.targets.skills) {
        const dst = path.join(r.targets.skills, n);
        if (unlinkSymlink(dst, opts.dryRun)) {
          console.log(`  unlinked: ${dst}`);
          removed++;
        }
      }
    }
    for (const n of picked.agents) {
      if (r.targets.agents) {
        const dst = path.join(r.targets.agents, `${n}.md`);
        if (unlinkSymlink(dst, opts.dryRun)) {
          console.log(`  unlinked: ${dst}`);
          removed++;
        }
      }
    }
  }
  console.log(`✅ Снято симлинков: ${removed}`);
}

function cmdUninstallByScan(opts) {
  const candidates = new Set();
  if (opts.vault) {
    candidates.add(path.join(opts.vault, '.agents', 'rules'));
  }
  candidates.add(path.join(opts.claudeHome, 'rules'));
  candidates.add(path.join(opts.claudeHome, 'skills'));
  candidates.add(path.join(opts.claudeHome, 'agents'));

  let removed = 0;
  for (const dir of candidates) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      const dst = path.join(dir, name);
      let target;
      try {
        const st = fs.lstatSync(dst);
        if (!st.isSymbolicLink()) continue;
        target = fs.readlinkSync(dst);
      } catch {
        continue;
      }
      if (target.includes('bear-skills')) {
        if (unlinkSymlink(dst, opts.dryRun)) {
          console.log(`  unlinked: ${dst}`);
          removed++;
        }
      }
    }
  }
  console.log(`✅ Снято симлинков: ${removed}`);
}

function cmdSync(args) {
  cmdUninstall(args);
  cmdInstall(args);
}

function cmdStatus(args) {
  const opts = resolveOpts(args);
  const source = resolveSource(args);
  if (!fs.existsSync(source)) {
    console.log(`Source ${source} не существует. Запусти "bear-skills install".`);
    return;
  }
  const domains = loadAllDomains(source);
  console.log(`📍 Source: ${source}`);
  console.log(`📍 CLAUDE_HOME: ${opts.claudeHome}`);
  console.log(`📍 BEAR_VAULT:  ${opts.vault || '(не задан)'}\n`);

  for (const d of domains) {
    const r = resolveTargets(d, opts);
    if (r.error) {
      console.log(`📦 ${d.name}  ⚠️  ${r.error}\n`);
      continue;
    }
    const all = listDomainComponents(d);
    const blocked = blockedByMissingBin(d);
    console.log(`📦 ${d.name}`);
    const checkCat = (label, names, dstBase, suffix, singular) => {
      if (names.length === 0) return;
      console.log(`  ${label} (${names.length}):`);
      for (const n of names) {
        const missingBin = blocked.get(`${singular}:${n}`);
        if (missingBin) {
          console.log(`    ⏭  ${n}  (нет бинаря "${missingBin}")`);
          continue;
        }
        const dst = path.join(dstBase, n + (suffix || ''));
        let ok = false;
        try {
          ok = fs.lstatSync(dst).isSymbolicLink();
        } catch {}
        console.log(`    ${ok ? '✅' : '❌'} ${n}`);
      }
    };
    if (r.targets.rules) checkCat('rules', all.rules, r.targets.rules, '.md', 'rule');
    if (r.targets.skills) checkCat('skills', all.skills, r.targets.skills, '', 'skill');
    if (r.targets.agents) checkCat('agents', all.agents, r.targets.agents, '.md', 'agent');
    console.log('');
  }
}

function cmdList(args) {
  const source = resolveSource(args);
  if (!fs.existsSync(source)) {
    console.error(`Source ${source} не существует.`);
    process.exit(1);
  }
  const domains = loadAllDomains(source);
  console.log(`📦 Домены в ${source}\n`);
  for (const d of domains) {
    const all = listDomainComponents(d);
    const reqs = [];
    if (d.requires_env.length) reqs.push(`env: ${d.requires_env.join(', ')}`);
    if (d.requires_bin.domain.length) {
      reqs.push(`bin: ${d.requires_bin.domain.join(', ')}`);
    }
    const reqEnv = reqs.length ? ` [requires: ${reqs.join('; ')}]` : '';
    console.log(`▸ ${d.name}${reqEnv}`);
    if (d.description) console.log(`  ${d.description}`);
    const blocked = blockedByMissingBin(d);
    for (const [bin, items] of Object.entries(d.requires_bin.components)) {
      const mark = hasBin(bin) ? '✅' : '❌';
      console.log(`  ${mark} bin "${bin}" нужен: ${items.join(', ')}`);
    }
    if (blocked.size > 0) {
      console.log(`  ⚠️  ${blocked.size} компонент(ов) не будет установлено`);
    }
    if (all.rules.length) {
      console.log(`  rules (${all.rules.length}):`);
      for (const n of all.rules) console.log(`    rule:${n}`);
    }
    if (all.skills.length) {
      console.log(`  skills (${all.skills.length}):`);
      for (const n of all.skills) console.log(`    skill:${n}`);
    }
    if (all.agents.length) {
      console.log(`  agents (${all.agents.length}):`);
      for (const n of all.agents) console.log(`    agent:${n}`);
    }
    console.log('');
  }
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

function cmdCheck(args) {
  const source = resolveSource(args);
  if (!fs.existsSync(source)) {
    console.error(`Source ${source} не существует`);
    process.exit(1);
  }
  const domains = loadAllDomains(source);
  let fail = 0;

  for (const d of domains) {
    console.log(`🔍 [${d.name}] manifest`);
    if (!d.targets.rules && !d.targets.skills && !d.targets.agents) {
      console.log(`  ❌ нет ни одного targets`);
      fail = 1;
    } else {
      console.log(`  ✅ manifest OK`);
    }

    // requires_bin не должен ссылаться на несуществующие компоненты —
    // иначе гейт молча ничего не блокирует, а автор думает, что защитился.
    const all = listDomainComponents(d);
    const known = new Set([
      ...all.rules.map((n) => `rule:${n}`),
      ...all.skills.map((n) => `skill:${n}`),
      ...all.agents.map((n) => `agent:${n}`),
    ]);
    for (const [bin, items] of Object.entries(d.requires_bin.components)) {
      for (const it of items) {
        if (!known.has(it)) {
          console.log(`  ❌ requires_bin.${bin}: компонента ${it} нет в домене`);
          fail = 1;
        }
      }
    }

    console.log(`🔍 [${d.name}] skills:`);
    for (const s of listSubdirs(d.skillsSrc)) {
      const f = path.join(d.skillsSrc, s, 'SKILL.md');
      if (!fs.existsSync(f)) {
        console.log(`  ❌ ${s}: нет SKILL.md`);
        fail = 1;
        continue;
      }
      const r = readFrontmatter(f);
      if (r.error) {
        console.log(`  ❌ ${s}: ${r.error}`);
        fail = 1;
      } else console.log(`  ✅ ${s}`);
    }

    console.log(`🔍 [${d.name}] agents:`);
    for (const a of listFiles(d.agentsSrc, '.md')) {
      const r = readFrontmatter(path.join(d.agentsSrc, a));
      if (r.error) {
        console.log(`  ❌ ${a}: ${r.error}`);
        fail = 1;
      } else console.log(`  ✅ ${a}`);
    }
    console.log('');
  }

  if (fail) {
    console.log('❌ Проверка не прошла.');
    process.exit(1);
  } else {
    console.log('✅ Всё валидно.');
  }
}

// Сверяет skills-lock.json с тем, что реально лежит в ~/.agents/skills.
// Чужие скиллы не вендорятся — файл фиксирует, что не наше и откуда взято.
function cmdLockCheck(args) {
  const source = resolveSource(args);
  const lockPath = path.join(source, 'skills-lock.json');
  if (!fs.existsSync(lockPath)) {
    console.error(`Нет ${lockPath}`);
    process.exit(1);
  }
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  const base = args.flags['skills-dir']
    ? path.resolve(String(args.flags['skills-dir']))
    : path.resolve(lock.location.replace(/^~/, HOME));

  console.log(`📍 Каталог: ${base}\n`);
  if (!fs.existsSync(base)) {
    console.log('Каталога нет — сверять нечего.');
    return;
  }

  const listed = new Set(lock.skills.map((s) => s.name));
  let drift = 0;

  for (const s of lock.skills) {
    const f = path.join(base, s.name, 'SKILL.md');
    if (!fs.existsSync(f)) {
      console.log(`  ⚠️  ${s.name}: в lock есть, на диске нет`);
      drift++;
      continue;
    }
    const h = require('crypto')
      .createHash('sha256')
      .update(fs.readFileSync(f))
      .digest('hex');
    if (h !== s.sha256) {
      console.log(`  ⚠️  ${s.name}: SKILL.md изменился с момента фиксации`);
      console.log(`        было ${s.sha256.slice(0, 12)}…, стало ${h.slice(0, 12)}…`);
      drift++;
    } else {
      console.log(`  ✅ ${s.name}  (${s.source})`);
    }
  }

  const onDisk = fs
    .readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  const ours = new Set();
  for (const d of loadAllDomains(source)) {
    for (const n of listSubdirs(d.skillsSrc)) ours.add(n);
  }
  const unknown = onDisk.filter((n) => !listed.has(n) && !ours.has(n));
  if (unknown.length > 0) {
    console.log('\n  ❓ Не в lock и не в domains/ — происхождение неизвестно:');
    for (const n of unknown) console.log(`     ${n}`);
    drift += unknown.length;
  }

  console.log('');
  if (drift > 0) {
    console.log(`⚠️  Расхождений: ${drift}. Обнови skills-lock.json или разберись с источником.`);
  } else {
    console.log('✅ Lock совпадает с диском.');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// doctor — диагностика установки
// ─────────────────────────────────────────────────────────────────────────────

// Достаёт description из YAML-фронтматтера. Триггеры живут только там:
// модель решает, звать скилл или нет, по описанию, а не по телу файла.
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

// Фразы, по которым скиллы конкурируют за срабатывание. Совпадение триггеров
// в описаниях двух скиллов — главная причина, по которой вызывается не тот.
// Берём только «ёлочки» из description: там автор перечисляет пусковые фразы.
function triggerWords(description) {
  const quoted = [...description.matchAll(/«([^»]{4,60})»/g)]
    .map((m) => m[1].toLowerCase().trim())
    // Одно короткое слово — не триггер, а шум вроде «плохо» или «хорошо».
    .filter((s) => s.includes(' ') || s.length >= 8);
  return new Set(quoted);
}

function cmdDoctor(args) {
  const opts = resolveOpts(args);
  const source = resolveSource(args);
  const problems = [];
  const warnings = [];

  console.log(`📍 Source:      ${source}`);
  console.log(`📍 CLAUDE_HOME: ${opts.claudeHome}`);
  console.log(`📍 BEAR_VAULT:  ${opts.vault || '(не задан)'}\n`);

  if (!fs.existsSync(source)) {
    console.log(`❌ Source не существует. Запусти "bear-skills install".`);
    process.exit(1);
  }

  const domains = loadAllDomains(source);
  const ourSkills = new Map();
  for (const d of domains) {
    for (const n of listDomainComponents(d).skills) ourSkills.set(n, d.name);
  }

  // 1. Требования доменов
  console.log('🔍 Требования доменов');
  for (const d of domains) {
    const r = resolveTargets(d, opts);
    if (r.error) {
      warnings.push(`домен ${d.name} не ставится: ${r.error}`);
      console.log(`   ⚠️  ${d.name}: ${r.error}`);
      continue;
    }
    const blocked = blockedByMissingBin(d);
    if (blocked.size > 0) {
      const bins = [...new Set(blocked.values())].join(', ');
      warnings.push(`в домене ${d.name} пропущено ${blocked.size} компонент(ов): нет ${bins}`);
      console.log(`   ⚠️  ${d.name}: ${blocked.size} компонент(ов) без бинаря ${bins}`);
    } else {
      console.log(`   ✅ ${d.name}`);
    }
  }

  // 2. Битые симлинки
  console.log('\n🔍 Битые симлинки');
  const scanDirs = [
    path.join(opts.claudeHome, 'skills'),
    path.join(opts.claudeHome, 'agents'),
    path.join(opts.claudeHome, 'rules'),
  ];
  if (opts.vault) scanDirs.push(path.join(opts.vault, '.agents', 'rules'));

  let broken = 0;
  for (const dir of scanDirs) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      try {
        if (!fs.lstatSync(p).isSymbolicLink()) continue;
        if (!fs.existsSync(p)) {
          console.log(`   ❌ ${p} → ${fs.readlinkSync(p)}`);
          problems.push(`битый симлинк: ${p}`);
          broken++;
        }
      } catch {
        /* нечитаемое пропускаем */
      }
    }
  }
  if (broken === 0) console.log('   ✅ битых нет');

  // 3. Два канала установки разом
  console.log('\n🔍 Каналы установки');
  const skillsDir = path.join(opts.claudeHome, 'skills');
  let symlinked = 0;
  let copied = 0;
  if (fs.existsSync(skillsDir)) {
    for (const name of fs.readdirSync(skillsDir)) {
      if (!ourSkills.has(name)) continue;
      const p = path.join(skillsDir, name);
      try {
        if (fs.lstatSync(p).isSymbolicLink()) symlinked++;
        else copied++;
      } catch {
        /* пропускаем */
      }
    }
  }
  if (symlinked > 0 && copied > 0) {
    problems.push(`оба канала установки разом: ${symlinked} симлинков и ${copied} копий`);
    console.log(`   ❌ симлинков ${symlinked}, копий ${copied} — оставь один канал`);
  } else if (symlinked > 0) {
    console.log(`   ✅ симлинки (${symlinked})`);
  } else if (copied > 0) {
    console.log(`   ✅ копии (${copied})`);
  } else {
    console.log('   ⚠️  ничего не установлено');
    warnings.push('в CLAUDE_HOME нет ни одного скилла bear-skills');
  }

  // 4. Коллизии с чужими скиллами
  console.log('\n🔍 Коллизии имён с чужими скиллами');
  const lockPath = path.join(source, 'skills-lock.json');
  let collisions = 0;
  if (fs.existsSync(lockPath)) {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    for (const s of lock.skills) {
      if (ourSkills.has(s.name)) {
        console.log(`   ❌ ${s.name}: есть и у нас, и в lock (${s.source})`);
        problems.push(`коллизия имени: ${s.name}`);
        collisions++;
      }
    }
  }
  if (collisions === 0) console.log('   ✅ коллизий нет');

  // 5. Пересекающиеся триггеры
  console.log('\n🔍 Пересекающиеся триггеры');
  const triggers = [];
  for (const d of domains) {
    for (const n of listDomainComponents(d).skills) {
      const file = path.join(d.skillsSrc, n, 'SKILL.md');
      try {
        const text = fs.readFileSync(file, 'utf8');
        triggers.push({ name: n, words: triggerWords(frontmatterDescription(text)) });
      } catch {
        /* пропускаем */
      }
    }
  }
  let overlaps = 0;
  for (let i = 0; i < triggers.length; i++) {
    for (let j = i + 1; j < triggers.length; j++) {
      const shared = [...triggers[i].words].filter((w) => triggers[j].words.has(w));
      if (shared.length > 0) {
        console.log(
          `   ⚠️  ${triggers[i].name} ↔ ${triggers[j].name}: «${shared.join('», «')}»`,
        );
        warnings.push(`общий триггер у ${triggers[i].name} и ${triggers[j].name}`);
        overlaps++;
      }
    }
  }
  if (overlaps === 0) console.log('   ✅ дублей триггеров нет');

  // Итог
  console.log('');
  if (problems.length === 0 && warnings.length === 0) {
    console.log('✅ Проблем не найдено.');
    return;
  }
  if (problems.length > 0) {
    console.log(`❌ Проблем: ${problems.length}`);
    for (const p of problems) console.log(`   ${p}`);
  }
  if (warnings.length > 0) {
    console.log(`⚠️  Предупреждений: ${warnings.length}`);
    for (const w of warnings) console.log(`   ${w}`);
  }
  if (problems.length > 0) process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// stats — какие скиллы реально срабатывают
// ─────────────────────────────────────────────────────────────────────────────

// Считает вызовы скиллов по логам сессий Claude Code.
// Мёртвый скилл — это либо неудачное описание, либо ненужный скилл;
// и то и другое стоит увидеть.
function cmdStats(args) {
  const source = resolveSource(args);
  const projectsDir = args.flags['log-dir']
    ? path.resolve(String(args.flags['log-dir']))
    : path.join(HOME, '.claude', 'projects');
  const days = args.flags.since ? Number(args.flags.since) : null;
  const cutoff = days ? Date.now() - days * 86400000 : null;

  if (!fs.existsSync(projectsDir)) {
    console.log(`Нет логов сессий в ${projectsDir}.`);
    return;
  }

  const logs = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.jsonl')) logs.push(p);
    }
  };
  walk(projectsDir);

  const counts = new Map();
  let totalCalls = 0;
  for (const file of logs) {
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    if (!text.includes('"name":"Skill"')) continue;
    for (const line of text.split('\n')) {
      if (!line.includes('"name":"Skill"')) continue;
      let obj;
      try {
        obj = JSON.parse(line);
      } catch {
        continue;
      }
      if (cutoff && obj.timestamp && Date.parse(obj.timestamp) < cutoff) continue;
      const content = obj.message?.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (block.type !== 'tool_use' || block.name !== 'Skill') continue;
        const skill = block.input?.skill;
        if (!skill) continue;
        counts.set(skill, (counts.get(skill) || 0) + 1);
        totalCalls++;
      }
    }
  }

  const domains = loadAllDomains(source);
  const ours = new Map();
  for (const d of domains) {
    for (const n of listDomainComponents(d).skills) ours.set(n, d.name);
  }

  const period = days ? `за последние ${days} дн.` : 'за всё время';
  console.log(`📊 Вызовы скиллов ${period}: ${totalCalls} в ${logs.length} логах\n`);

  const used = [...counts.entries()]
    .filter(([n]) => ours.has(n))
    .sort((a, b) => b[1] - a[1]);
  const foreign = [...counts.entries()]
    .filter(([n]) => !ours.has(n))
    .sort((a, b) => b[1] - a[1]);
  const dead = [...ours.keys()].filter((n) => !counts.has(n)).sort();

  if (used.length > 0) {
    console.log('Наши скиллы:');
    for (const [name, n] of used) {
      console.log(`   ${String(n).padStart(4)}  ${name}  [${ours.get(name)}]`);
    }
  }
  if (dead.length > 0) {
    console.log(`\nНи разу не сработали (${dead.length}):`);
    for (const name of dead) console.log(`   ———  ${name}  [${ours.get(name)}]`);
    console.log('\n   Мёртвый скилл — это либо неудачное описание, по которому');
    console.log('   модель его не находит, либо скилл, который не нужен.');
  }
  if (foreign.length > 0) {
    console.log('\nЧужие скиллы:');
    for (const [name, n] of foreign) console.log(`   ${String(n).padStart(4)}  ${name}`);
  }
}

function cmdHelp() {
  const pkgPath = path.join(PACKAGE_ROOT, 'package.json');
  let version = '?';
  try {
    version = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version || '?';
  } catch {}
  console.log(`bear-skills ${version} — мульти-доменная коллекция правил, скиллов и агентов для Claude Code

Использование:
  npx github:jtprogru/bear-skills <команда> [домены|компоненты...] [флаги]
  bear-skills <команда> [домены|компоненты...] [флаги]   # если установлено глобально

Команды:
  install     Клонирует репо в ~/.bear-skills (если ещё нет) и разворачивает симлинки.
              Без аргументов — все домены, у которых выполнены requires_env.
              С именем домена — только этот домен (целиком).
              С компонентами skill:/rule:/agent: — точечно.
  uninstall   Снимает симлинки. Без аргументов — все. С компонентами — точечно.
  sync        uninstall + git pull + install
  status      Показать, что и куда развёрнуто, по доменам
  list        Список всех доменов и их компонентов
  check       Валидация манифестов и фронтматтера
  lock-check  Сверка skills-lock.json с чужими скиллами на диске
  doctor      Диагностика установки: битые симлинки, два канала разом,
              коллизии имён, пересекающиеся триггеры, требования доменов
  stats       Какие скиллы реально срабатывают, а какие мертвы (по логам сессий)
  help        Эта справка

Домены (примеры; точный список — bear-skills list):
  obsidian    PKB на Obsidian (требует BEAR_VAULT)
  git         Git workflow, релизы
  sre         SRE/Kubernetes — incident, runbooks, k8s-triage
  content     Контент-pipeline — TG-посты, статьи, туториалы

Примеры:
  # Полная установка всех доменов, где выполнены требования:
  npx github:jtprogru/bear-skills install --vault "$HOME/Obsidian/MyVault"

  # Только один домен:
  npx github:jtprogru/bear-skills install git

  # Несколько доменов:
  npx github:jtprogru/bear-skills install obsidian git --vault "$HOME/Obsidian/MyVault"

  # Точечная установка одного скилла:
  npx github:jtprogru/bear-skills install skill:obsidian-ingest --vault ...

  # Удалить домен целиком:
  npx github:jtprogru/bear-skills uninstall sre

Флаги:
  --vault <path>         Путь к Obsidian vault. Может быть задан env BEAR_VAULT.
  --claude-home <path>   Путь к ~/.claude (по умолчанию \$HOME/.claude)
  --domains <list>       Альтернативный способ выбора доменов (через запятую)
  --source <path>        Локальный source вместо ~/.bear-skills. Подразумевает --no-clone.
  --no-clone             Не делать git clone/pull
  --dry-run              Показать действия, ничего не меняя
  --skills-dir <path>    Каталог чужих скиллов для lock-check

Домены, у которых не выполнен requires_env, пропускаются с warning'ом —
например, без BEAR_VAULT obsidian-домен скипнется, но git/sre/content поставятся.

Аналогично requires_bin: бинарь, объявленный на уровне домена, пропускает
домен целиком; объявленный под конкретные компоненты — пропускает только их.
Без CLI srekit скиллы srekit-* скипнутся, а sre-k8s-triage поставится.
`);
}

const COMMANDS = {
  install: cmdInstall,
  uninstall: cmdUninstall,
  sync: cmdSync,
  status: cmdStatus,
  list: cmdList,
  check: cmdCheck,
  'lock-check': cmdLockCheck,
  doctor: cmdDoctor,
  stats: cmdStats,
  help: cmdHelp,
  '--help': cmdHelp,
  '-h': cmdHelp,
};

function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0] || 'help';
  const fn = COMMANDS[cmd];
  if (!fn) {
    console.error(`Неизвестная команда: ${cmd}\n`);
    cmdHelp();
    process.exit(1);
  }
  try {
    fn(args);
  } catch (e) {
    console.error('❌', e.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

// Экспорт для тестов: чистые функции разбора и отбора компонентов проверяются
// напрямую, без развёртывания симлинков в файловую систему.
module.exports = {
  parseManifestYaml,
  expandPath,
  hasBin,
  blockedByMissingBin,
  applyBinGate,
  parseSelection,
  pickFromDomain,
  readFrontmatter,
  loadAllDomains,
  listDomainComponents,
  frontmatterDescription,
  triggerWords,
};
