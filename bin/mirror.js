#!/usr/bin/env node
/* eslint-disable no-console */

// Генератор плоского зеркала domains/ в корень репозитория.
//
// Зачем: единственный источник правды — domains/<домен>/{rules,skills,agents}.
// Но канал дистрибуции «плагин Claude Code» и `npx skills add` ожидают плоские
// skills/<name>/SKILL.md и agents/<name>.md в корне. Вместо того чтобы держать
// пять параллельных копий руками (и получить рассинхрон), зеркало генерируется
// и коммитится, а CI проверяет актуальность через `mirror --check`.
//
// Отдельная задача зеркала — переписать ссылки на правила. В симлинк-модели
// правило лежит в ~/.claude/rules/<name>.md (или в vault для obsidian), но при
// установке плагином такого пути нет. В зеркале ссылка становится относительной:
// skills/<name>/SKILL.md → ../../rules/<name>.md.

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const DOMAINS_DIR = path.join(REPO_ROOT, 'domains');
const MIRROR_DIRS = ['skills', 'agents', 'rules'];

const BANNER_HTML =
  '<!-- СГЕНЕРИРОВАНО bin/mirror.js. Не редактировать: правки затрёт следующая генерация.\n' +
  '     Источник правды — domains/<домен>/. -->';

// ─────────────────────────────────────────────────────────────────────────────
// Сбор источника
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

function collect() {
  const out = { skills: [], agents: [], rules: [] };
  for (const domain of listSubdirs(DOMAINS_DIR)) {
    const base = path.join(DOMAINS_DIR, domain);
    for (const name of listSubdirs(path.join(base, 'skills'))) {
      out.skills.push({ domain, name, src: path.join(base, 'skills', name) });
    }
    for (const file of listFiles(path.join(base, 'agents'), '.md')) {
      out.agents.push({
        domain,
        name: file.replace(/\.md$/, ''),
        src: path.join(base, 'agents', file),
      });
    }
    for (const file of listFiles(path.join(base, 'rules'), '.md')) {
      out.rules.push({
        domain,
        name: file.replace(/\.md$/, ''),
        src: path.join(base, 'rules', file),
      });
    }
  }
  return out;
}

// Коллизии имён между доменами сломали бы плоское зеркало молча:
// второй скилл затёр бы первый. Ловим до записи.
function assertNoCollisions(collected) {
  for (const kind of MIRROR_DIRS) {
    const seen = new Map();
    for (const item of collected[kind]) {
      if (seen.has(item.name)) {
        throw new Error(
          `Коллизия имён в ${kind}: "${item.name}" есть и в домене ` +
            `${seen.get(item.name)}, и в ${item.domain}. ` +
            `Плоское зеркало требует уникальных имён.`,
        );
      }
      seen.set(item.name, item.domain);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Трансформация содержимого
// ─────────────────────────────────────────────────────────────────────────────

// Вставляет баннер сразу после YAML-фронтматтера, чтобы не сломать его парсинг.
function withBanner(text) {
  const lines = text.split('\n');
  if (lines[0] !== '---') return `${BANNER_HTML}\n\n${text}`;
  let close = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      close = i;
      break;
    }
  }
  if (close < 0) return `${BANNER_HTML}\n\n${text}`;
  const head = lines.slice(0, close + 1).join('\n');
  const tail = lines.slice(close + 1).join('\n');
  return `${head}\n\n${BANNER_HTML}\n${tail}`;
}

// Переписывает ссылки на правила под структуру зеркала.
// depth — на сколько уровней файл лежит глубже корня зеркала.
function rewriteRuleLinks(text, depth) {
  const up = '../'.repeat(depth);
  return text
    .replace(/~\/\.claude\/rules\//g, `${up}rules/`)
    .replace(/(?<![\w/.])\.agents\/rules\//g, `${up}rules/`);
}

function transform(text, depth) {
  return withBanner(rewriteRuleLinks(text, depth));
}

const TEXT_EXT = new Set(['.md', '.txt', '.json', '.yaml', '.yml']);

// Мусор ОС и интерпретаторов: в domains/ появляется от запуска скриптов,
// источником правды не является и в зеркало не попадает.
const JUNK_NAMES = new Set(['.DS_Store', '__pycache__', '.pytest_cache', '.ruff_cache']);
const isJunk = (entry) => JUNK_NAMES.has(entry.name) || entry.name.endsWith('.pyc');

// Собирает желаемое содержимое зеркала как Map относительный-путь → содержимое.
function buildDesired(collected) {
  const files = new Map();

  const addTree = (srcDir, dstPrefix, baseDepth) => {
    const walk = (dir, rel) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (isJunk(entry)) continue;
        const abs = path.join(dir, entry.name);
        const relPath = rel ? path.join(rel, entry.name) : entry.name;
        if (entry.isDirectory()) {
          walk(abs, relPath);
          continue;
        }
        const dst = path.join(dstPrefix, relPath);
        const ext = path.extname(entry.name).toLowerCase();
        const raw = fs.readFileSync(abs);
        if (TEXT_EXT.has(ext)) {
          const depth = baseDepth + relPath.split(path.sep).length - 1;
          const body =
            ext === '.md'
              ? transform(raw.toString('utf8'), depth)
              : rewriteRuleLinks(raw.toString('utf8'), depth);
          files.set(dst, Buffer.from(body, 'utf8'));
        } else {
          files.set(dst, raw);
        }
      }
    };
    walk(srcDir, '');
  };

  for (const s of collected.skills) {
    // skills/<name>/SKILL.md — два уровня от корня зеркала
    addTree(s.src, path.join('skills', s.name), 2);
  }
  for (const a of collected.agents) {
    const raw = fs.readFileSync(a.src, 'utf8');
    files.set(path.join('agents', `${a.name}.md`), Buffer.from(transform(raw, 1), 'utf8'));
  }
  for (const r of collected.rules) {
    const raw = fs.readFileSync(r.src, 'utf8');
    files.set(path.join('rules', `${r.name}.md`), Buffer.from(transform(raw, 1), 'utf8'));
  }
  return files;
}

// ─────────────────────────────────────────────────────────────────────────────
// Запись и сверка
// ─────────────────────────────────────────────────────────────────────────────

function listMirrorOnDisk() {
  const found = new Map();
  for (const kind of MIRROR_DIRS) {
    const base = path.join(REPO_ROOT, kind);
    if (!fs.existsSync(base)) continue;
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (isJunk(entry)) continue;
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(abs);
        else found.set(path.relative(REPO_ROOT, abs), fs.readFileSync(abs));
      }
    };
    walk(base);
  }
  return found;
}

function diffMirror(desired) {
  const actual = listMirrorOnDisk();
  const missing = [];
  const changed = [];
  const extra = [];
  for (const [rel, content] of desired) {
    const cur = actual.get(rel);
    if (cur === undefined) missing.push(rel);
    else if (!cur.equals(content)) changed.push(rel);
  }
  for (const rel of actual.keys()) {
    if (!desired.has(rel)) extra.push(rel);
  }
  return { missing, changed, extra };
}

function writeMirror(desired) {
  for (const kind of MIRROR_DIRS) {
    fs.rmSync(path.join(REPO_ROOT, kind), { recursive: true, force: true });
  }
  for (const [rel, content] of desired) {
    const abs = path.join(REPO_ROOT, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const clean = args.includes('--clean');

  if (clean) {
    for (const kind of MIRROR_DIRS) {
      fs.rmSync(path.join(REPO_ROOT, kind), { recursive: true, force: true });
    }
    console.log('🧹 Зеркало удалено.');
    return;
  }

  const collected = collect();
  assertNoCollisions(collected);
  const desired = buildDesired(collected);

  if (check) {
    const { missing, changed, extra } = diffMirror(desired);
    const total = missing.length + changed.length + extra.length;
    if (total === 0) {
      console.log(`✅ Зеркало актуально (${desired.size} файлов).`);
      return;
    }
    console.log('❌ Зеркало разошлось с domains/:');
    for (const f of missing) console.log(`   отсутствует: ${f}`);
    for (const f of changed) console.log(`   устарел:     ${f}`);
    for (const f of extra) console.log(`   лишний:      ${f}`);
    console.log('\nПочини: node bin/mirror.js');
    process.exit(1);
  }

  writeMirror(desired);
  console.log(
    `🪞 Зеркало собрано: ${collected.skills.length} скиллов, ` +
      `${collected.agents.length} агентов, ${collected.rules.length} правил ` +
      `(${desired.size} файлов).`,
  );
}

try {
  main();
} catch (e) {
  console.error('❌', e.message);
  process.exit(1);
}
