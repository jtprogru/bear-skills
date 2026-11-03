#!/usr/bin/env node
/* eslint-disable no-console */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const { frontmatterDescription, triggerWords, parseManifestYaml, hasBin, loadDomain, loadAllDomains, listSubdirs, listFiles, listDomainComponents, readFrontmatter } = require('./lib/catalog');

const installer = require('./lib/installer');
const { migrate } = require('./lib/migrate');

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
        if (['dry-run', 'no-clone', 'force', 'overwrite', 'json', 'help', 'list', 'all', 'uninstall'].includes(key)) {
          if (!['true', 'false'].includes(val)) throw new Error('--' + key + ': ожидается true|false');
          val = val === 'true';
        }
      } else {
        key = a.slice(2);
        const next = ['dry-run', 'no-clone', 'force', 'overwrite', 'json', 'help', 'list', 'all', 'uninstall'].includes(key) ? undefined : argv[i + 1];
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
  if (opts.dryRun) {
    if (!fs.existsSync(source)) throw new Error(`Source ${source} отсутствует; dry-run не клонирует репозиторий. Укажи --source.`);
    return;
  }
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


// Есть ли исполняемый файл с таким именем в PATH.


// Подстановка ${VAR} из process.env + специальные переменные.
function expandPath(p, env) {
  return p.replace(/\$\{([A-Z_][A-Z0-9_]*)\}/g, (_, key) => {
    if (env[key] === undefined) {
      throw new Error(`не задана переменная ${key} для пути "${p}"`);
    }
    return env[key];
  });
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

// ─────────────────────────────────────────────────────────────────────────────
// Каталог компонентов
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Команды
// ─────────────────────────────────────────────────────────────────────────────

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
    if (all.commands.length) {
      console.log(`  commands (${all.commands.length}):`);
      for (const n of all.commands) console.log(`    command:${n}`);
    }
    if (all.agents.length) {
      console.log(`  agents (${all.agents.length}):`);
      for (const n of all.agents) console.log(`    agent:${n}`);
    }
    console.log('');
  }
}

function cmdCheck(args) {
  const source = resolveSource(args);
  if (!fs.existsSync(source)) {
    console.error(`Source ${source} не существует`);
    process.exit(1);
  }
  require('./lib/catalog').loadCatalog(source);
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
// Сам файл локальный и в git не хранится: хеши и location описывают машину.
function cmdLockCheck(args) {
  const source = resolveSource(args);
  const lockPath = path.join(source, 'skills-lock.json');
  if (!fs.existsSync(lockPath)) {
    console.log(`Нет ${lockPath} — сверять не с чем.`);
    console.log('Файл локальный, в репозитории его нет. Заведи вручную:');
    console.log('  {"version":1,"location":"~/.agents/skills","skills":[]}');
    console.log('и добавь записи вида {"name","source","license","sha256","files"}.');
    return;
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


// Фразы, по которым скиллы конкурируют за срабатывание. Совпадение триггеров
// в описаниях двух скиллов — главная причина, по которой вызывается не тот.
// Берём только «ёлочки» из description: там автор перечисляет пусковые фразы.


// ─────────────────────────────────────────────────────────────────────────────
// stats — какие скиллы реально срабатывают
// ─────────────────────────────────────────────────────────────────────────────

// Считает вызовы скиллов по логам сессий Claude Code.
// Мёртвый скилл — это либо неудачное описание, либо ненужный скилл;
// и то и другое стоит увидеть.
function cmdStats(args) {
  if (args.flags.provider && !['claude', 'claude-code'].includes(args.flags.provider)) throw new Error('stats поддерживает только session logs Claude Code');
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
  console.log(`bear-skills — Claude Code, Codex, Cursor, OpenCode

bear-skills <команда> [домены|skill:имя|rule:имя|agent:имя|command:имя] [флаги]

Команды:
  install     Каталог → зависимости → файлы → конфликты → установка
  sync        Обновить установленные компоненты; без uninstall
  uninstall   Удалить по описи, сохранить пользовательские изменения
  migrate     Принять подтверждённые legacy-файлы в опись; затем sync
  providers   Возможности, обнаруженные установки, статус совместимости
  status      Целостность файлов и отдельный статус загрузки провайдером
  doctor      Зависимости, ссылки, ресурсы, дубли и состояние MCP
  list        Каталог доменов и компонентов
  check       Манифесты, frontmatter, зависимости и циклы
  lock-check  Локальный skills-lock.json
  stats       Статистика вызовов из логов Claude Code

Выбор установки:
  --provider <id>        claude-code (по умолчанию), codex, cursor, opencode
  --scope global|project  По умолчанию global
  --project <path>       Корень проекта; для project scope, по умолчанию cwd
  --mode copy|symlink    По умолчанию symlink; преобразованные файлы материализуются
  --source <path>        Локальный source; подразумевает --no-clone
  --no-clone             Не клонировать и не обновлять source
  --home <path>          Изолированный пользовательский корень для всех путей
  --provider-home <path> Переопределить native config root в global scope
  --claude-home <path>   Совместимый alias для Claude Code
  --vault <path>         Obsidian vault, также BEAR_VAULT
  --domains a,b          Дополнительный выбор доменов
  --dry-run              Полностью без записи, mkdir, clone/pull
  --overwrite            Заменить конфликтующие файлы с backup; пути проверяются всегда
  --json                 Машинный отчёт для managed-команд

Примеры:
  bear-skills install git --provider codex --scope project --project ./app --mode copy
  bear-skills migrate --provider claude-code --source . --dry-run
  bear-skills sync --provider codex --scope project --project ./app --source .

Недоступная CLI/env-зависимость или несовместимость пропускает компонент и его
потребителей с объяснением. Явная установка такого компонента завершается ошибкой.
MCP config не доказывает доступность сессии. Hook trust выдаётся вручную в провайдере.
`);
}

function runManaged(args) {
  const options = installer.optionsFrom(args);
  const command = args._[0];
  if (command === 'install' || command === 'sync') {
    if (command === 'sync' && !args.flags.source) {
      const loc = require('./lib/providers').layout(options);
      const state = require('./lib/storage').readInventory(loc, options);
      if (state) options.source = state.source;
    }
    ensureSource(options.source, { dryRun: options.dryRun, noClone: !!args.flags['no-clone'] || !!args.flags.source });
  }
  const result = command === 'migrate' ? migrate(options)
    : command === 'install' || command === 'sync' ? installer.install(options, command)
    : command === 'uninstall' ? installer.uninstall(options)
    : command === 'providers' ? installer.providers(options)
    : installer.diagnostics(options, command === 'doctor');
  if (result.failed) process.exitCode = 1;
  return result;
}

const COMMANDS = {
  install: runManaged,
  uninstall: runManaged,
  sync: runManaged,
  status: runManaged,
  providers: runManaged,
  migrate: runManaged,
  list: cmdList,
  check: cmdCheck,
  'lock-check': cmdLockCheck,
  doctor: runManaged,
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
  parseArgs, runManaged,
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
