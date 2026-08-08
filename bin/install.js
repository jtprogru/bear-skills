#!/usr/bin/env node
/* eslint-disable no-console */

// Копирующий установщик для агентов, которые не умеют симлинк-модель bin/cli.js.
//
// Разница между двумя каналами:
//   bin/cli.js   — симлинки из репозитория. Правишь в репо, видно сразу. Для себя.
//   bin/install.js — копии из зеркала. Работает без клона репозитория рядом,
//                    ставит в любой обнаруженный агент. Для чужих машин.
//
// Массив PROVIDERS — единственный источник правды о том, куда что кладётся.
// Добавить агента = добавить запись, а не написать новую ветку кода.

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO_ROOT = path.resolve(__dirname, '..');
const HOME = os.homedir();

// mech: как агент ждёт компоненты.
//   'claude'  — skills/<name>/, agents/<name>.md, rules/<name>.md рядом
//   'flat-md' — всё одним каталогом markdown-файлов
const PROVIDERS = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    mech: 'claude',
    root: path.join(HOME, '.claude'),
    detect: () => fs.existsSync(path.join(HOME, '.claude')),
  },
  {
    id: 'codex',
    label: 'Codex CLI',
    mech: 'flat-md',
    root: path.join(HOME, '.codex', 'skills'),
    detect: () => fs.existsSync(path.join(HOME, '.codex')),
  },
  {
    id: 'cursor',
    label: 'Cursor',
    mech: 'flat-md',
    root: path.join(HOME, '.cursor', 'rules'),
    detect: () => fs.existsSync(path.join(HOME, '.cursor')),
  },
  {
    id: 'opencode',
    label: 'opencode',
    mech: 'claude',
    root: path.join(HOME, '.config', 'opencode'),
    detect: () => fs.existsSync(path.join(HOME, '.config', 'opencode')),
  },
];

// Маркер-файл: по нему uninstall понимает, что именно поставили мы,
// и не трогает чужое, случайно оказавшееся рядом.
const MANIFEST_NAME = '.bear-skills-installed.json';

// ─────────────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      positional.push(a);
      continue;
    }
    const eq = a.indexOf('=');
    if (eq > -1) {
      flags[a.slice(2, eq)] = a.slice(eq + 1);
    } else {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[a.slice(2)] = next;
        i++;
      } else {
        flags[a.slice(2)] = true;
      }
    }
  }
  return { flags, positional };
}

function mirrorSources() {
  const missing = ['skills', 'agents', 'rules'].filter(
    (d) => !fs.existsSync(path.join(REPO_ROOT, d)),
  );
  if (missing.length > 0) {
    throw new Error(
      `Нет зеркала (${missing.join(', ')}). Собери его: node bin/mirror.js`,
    );
  }
  const skills = fs
    .readdirSync(path.join(REPO_ROOT, 'skills'), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  const agents = fs
    .readdirSync(path.join(REPO_ROOT, 'agents'))
    .filter((f) => f.endsWith('.md'));
  const rules = fs
    .readdirSync(path.join(REPO_ROOT, 'rules'))
    .filter((f) => f.endsWith('.md'));
  return { skills, agents, rules };
}

function copyTree(src, dst, dryRun) {
  if (dryRun) {
    console.log(`  [dry] cp -R ${src} → ${dst}`);
    return;
  }
  fs.rmSync(dst, { recursive: true, force: true });
  fs.cpSync(src, dst, { recursive: true });
}

function copyFile(src, dst, dryRun) {
  if (dryRun) {
    console.log(`  [dry] cp ${path.basename(src)} → ${dst}`);
    return;
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

// Симлинк-канал (bin/cli.js) и копирующий канал кладут в одно место.
// Два канала разом дают дубли и непредсказуемое срабатывание — предупреждаем.
function warnSymlinkChannel(provider) {
  if (provider.mech !== 'claude') return;
  const skillsDir = path.join(provider.root, 'skills');
  if (!fs.existsSync(skillsDir)) return;
  const linked = [];
  for (const name of fs.readdirSync(skillsDir)) {
    const p = path.join(skillsDir, name);
    try {
      if (!fs.lstatSync(p).isSymbolicLink()) continue;
      if (fs.readlinkSync(p).includes('bear-skills')) linked.push(name);
    } catch {
      /* пропускаем нечитаемое */
    }
  }
  if (linked.length === 0) return;
  console.log('');
  console.log(`  ⚠️  В ${skillsDir} уже стоят симлинки bear-skills (${linked.length} шт).`);
  console.log('     Это второй канал установки. Копии перезапишут симлинки, и правки');
  console.log('     в репозитории перестанут подхватываться на лету.');
  console.log('     Оставь один канал: bear-skills uninstall — снять симлинки.');
}

function installTo(provider, sources, opts) {
  console.log(`\n📦 ${provider.label}  → ${provider.root}`);
  warnSymlinkChannel(provider);

  const installed = { skills: [], agents: [], rules: [] };

  if (provider.mech === 'claude') {
    for (const name of sources.skills) {
      copyTree(
        path.join(REPO_ROOT, 'skills', name),
        path.join(provider.root, 'skills', name),
        opts.dryRun,
      );
      installed.skills.push(name);
    }
    for (const file of sources.agents) {
      copyFile(
        path.join(REPO_ROOT, 'agents', file),
        path.join(provider.root, 'agents', file),
        opts.dryRun,
      );
      installed.agents.push(file);
    }
    for (const file of sources.rules) {
      copyFile(
        path.join(REPO_ROOT, 'rules', file),
        path.join(provider.root, 'rules', file),
        opts.dryRun,
      );
      installed.rules.push(file);
    }
  } else {
    // flat-md: агент читает плоский каталог markdown. Скилл кладём как
    // <name>.md, чтобы не плодить вложенность, которую такой агент не обойдёт.
    for (const name of sources.skills) {
      copyFile(
        path.join(REPO_ROOT, 'skills', name, 'SKILL.md'),
        path.join(provider.root, `${name}.md`),
        opts.dryRun,
      );
      installed.skills.push(name);
    }
    for (const file of sources.rules) {
      copyFile(
        path.join(REPO_ROOT, 'rules', file),
        path.join(provider.root, file),
        opts.dryRun,
      );
      installed.rules.push(file);
    }
  }

  const count =
    installed.skills.length + installed.agents.length + installed.rules.length;
  console.log(
    `   скиллов: ${installed.skills.length}, агентов: ${installed.agents.length}, правил: ${installed.rules.length}`,
  );

  if (!opts.dryRun) {
    fs.mkdirSync(provider.root, { recursive: true });
    fs.writeFileSync(
      path.join(provider.root, MANIFEST_NAME),
      `${JSON.stringify({ provider: provider.id, installed }, null, 2)}\n`,
    );
  }
  return count;
}

function uninstallFrom(provider, opts) {
  const manifestPath = path.join(provider.root, MANIFEST_NAME);
  if (!fs.existsSync(manifestPath)) {
    console.log(`\n📦 ${provider.label}: не установлено этим инсталлятором, пропускаю`);
    return 0;
  }
  const { installed } = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log(`\n📦 ${provider.label}  → ${provider.root}`);
  let removed = 0;

  const rm = (p) => {
    if (!fs.existsSync(p)) return;
    if (opts.dryRun) {
      console.log(`  [dry] rm -rf ${p}`);
      removed++;
      return;
    }
    fs.rmSync(p, { recursive: true, force: true });
    removed++;
  };

  if (provider.mech === 'claude') {
    for (const n of installed.skills) rm(path.join(provider.root, 'skills', n));
    for (const f of installed.agents) rm(path.join(provider.root, 'agents', f));
    for (const f of installed.rules) rm(path.join(provider.root, 'rules', f));
  } else {
    for (const n of installed.skills) rm(path.join(provider.root, `${n}.md`));
    for (const f of installed.rules) rm(path.join(provider.root, f));
  }
  if (!opts.dryRun) fs.rmSync(manifestPath, { force: true });
  console.log(`   удалено: ${removed}`);
  return removed;
}

function help() {
  console.log(`bear-skills install — копирующая установка в обнаруженные AI-агенты

Использование:
  node bin/install.js [флаги]

Флаги:
  --list          Показать обнаруженных агентов и выйти
  --only <ids>    Ставить только в перечисленных (через запятую): claude-code,codex
  --uninstall     Снять то, что поставил этот инсталлятор
  --dry-run       Показать действия, ничего не меняя
  --all           Ставить во всех известных агентов, даже не обнаруженных
  --help          Эта справка

Агенты определяются по наличию их конфигурационного каталога:
${PROVIDERS.map((p) => `  ${p.id.padEnd(12)} ${p.label} — ${p.root}`).join('\n')}

Для своей машины удобнее симлинк-модель: bear-skills install (bin/cli.js).
Правки в репозитории подхватываются без переустановки.
`);
}

function main() {
  const { flags } = parseArgs(process.argv.slice(2));
  if (flags.help) return help();

  const opts = { dryRun: !!flags['dry-run'] };
  const detected = PROVIDERS.filter((p) => (flags.all ? true : p.detect()));

  if (flags.list) {
    console.log('Известные агенты:\n');
    for (const p of PROVIDERS) {
      console.log(`  ${p.detect() ? '✅' : '⬜'} ${p.id.padEnd(12)} ${p.label}`);
      console.log(`     ${p.root}`);
    }
    return;
  }

  let targets = detected;
  if (flags.only && flags.only !== true) {
    const ids = String(flags.only)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const known = new Set(PROVIDERS.map((p) => p.id));
    for (const id of ids) {
      if (!known.has(id)) {
        throw new Error(`Неизвестный агент "${id}". Список: node bin/install.js --list`);
      }
    }
    targets = PROVIDERS.filter((p) => ids.includes(p.id));
  }

  if (targets.length === 0) {
    console.log('Не найдено ни одного поддерживаемого агента.');
    console.log('Список известных: node bin/install.js --list');
    console.log('Поставить принудительно: node bin/install.js --all');
    return;
  }

  if (flags.uninstall) {
    let total = 0;
    for (const p of targets) total += uninstallFrom(p, opts);
    console.log(`\n✅ Снято компонентов: ${total}`);
    return;
  }

  const sources = mirrorSources();
  let total = 0;
  for (const p of targets) total += installTo(p, sources, opts);
  console.log(`\n✅ Установлено компонентов: ${total}`);
  console.log('\nСкиллы домена obsidian требуют переменную BEAR_VAULT, скиллы');
  console.log('srekit* — CLI srekit. Без них они просто не сработают.');
}

try {
  main();
} catch (e) {
  console.error('❌', e.message);
  process.exit(1);
}
