#!/usr/bin/env node
/* eslint-disable no-console */

// Раннер evals по трёхрукой схеме.
//
// Проблема, которую он решает: «скилл лучше, чем ничего» — бесполезное
// утверждение. Половина эффекта любого скилла воспроизводится словами
// «отвечай кратко и по делу», и сравнение с пустотой приписывает скиллу
// заслуги обычной вежливой просьбы.
//
// Поэтому каждый промпт прогоняется тремя руками:
//   baseline — голый промпт, без системного сообщения
//   terse    — промпт + одна строка «отвечай кратко и по делу»
//   skill    — то же terse + тело SKILL.md
//
// Честная дельта — skill против terse. Дельта против baseline печатается
// отдельно и помечена как завышенная, чтобы её нельзя было процитировать
// как результат скилла.
//
// Числа берутся из поля usage ответа API — это замер, а не оценка.
// Раннер ничего не выдумывает: если прогона не было, числа нет.

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_MODEL = 'claude-opus-5';
const MAX_TOKENS = 16000;

const TERSE_SYSTEM = 'Отвечай кратко и по делу. Без преамбул и подведения итогов.';

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

function loadSdk() {
  try {
    return require('@anthropic-ai/sdk');
  } catch {
    throw new Error(
      'нет @anthropic-ai/sdk. Поставь его: npm install --save-dev @anthropic-ai/sdk',
    );
  }
}

// Собирает все evals.json из доменов.
function findEvals(filterName) {
  const found = [];
  const domainsDir = path.join(REPO_ROOT, 'domains');
  for (const domain of fs.readdirSync(domainsDir)) {
    const skillsDir = path.join(domainsDir, domain, 'skills');
    if (!fs.existsSync(skillsDir)) continue;
    for (const skill of fs.readdirSync(skillsDir)) {
      const file = path.join(skillsDir, skill, 'evals', 'evals.json');
      if (!fs.existsSync(file)) continue;
      if (filterName && skill !== filterName) continue;
      found.push({
        domain,
        skill,
        file,
        skillMd: path.join(skillsDir, skill, 'SKILL.md'),
      });
    }
  }
  return found;
}

// Тело SKILL.md без YAML-фронтматтера: в системное сообщение идёт инструкция,
// а не метаданные для каталога скиллов.
function skillBody(file) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  if (lines[0] !== '---') return text;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') return lines.slice(i + 1).join('\n').trim();
  }
  return text;
}

function systemFor(arm, body) {
  if (arm === 'baseline') return undefined;
  if (arm === 'terse') return TERSE_SYSTEM;
  return `${TERSE_SYSTEM}\n\n${body}`;
}

async function runArm(client, model, arm, prompt, body) {
  const system = systemFor(arm, body);
  const req = {
    model,
    max_tokens: MAX_TOKENS,
    messages: [{ role: 'user', content: prompt }],
  };
  if (system) req.system = system;

  const started = Date.now();
  const response = await client.messages.create(req);
  const elapsedMs = Date.now() - started;

  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');

  const u = response.usage;
  return {
    arm,
    text,
    elapsed_ms: elapsedMs,
    stop_reason: response.stop_reason,
    usage: {
      input_tokens: u.input_tokens,
      output_tokens: u.output_tokens,
      cache_read_input_tokens: u.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens: u.cache_creation_input_tokens ?? 0,
    },
  };
}

// Судья сравнивает ответ с expected_output. Отдельный вызов и отдельный
// контекст: та же модель, которая писала ответ, не годится в судьи себе.
async function judge(client, model, prompt, expected, actual) {
  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system:
      'Ты оцениваешь, соответствует ли ответ ожидаемому результату. ' +
      'Отвечай ровно одной строкой формата: <0-10> | <одна фраза почему>. ' +
      'Оценивай существо, а не стиль и не длину.',
    messages: [
      {
        role: 'user',
        content: `Задача:\n${prompt}\n\nОжидалось:\n${expected}\n\nПолучено:\n${actual}`,
      },
    ],
  });
  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  const m = text.match(/^(\d+(?:\.\d+)?)\s*\|\s*(.+)$/);
  return {
    score: m ? Number(m[1]) : null,
    note: m ? m[2] : text,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  };
}

function pct(a, b) {
  if (!b) return null;
  return Math.round(((a - b) / b) * 1000) / 10;
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2));

  if (flags.help || positional[0] === 'help') {
    console.log(`bear-skills evals — трёхрукий прогон evals.json

Использование:
  node bin/evals.js [скилл] [флаги]

Флаги:
  --list            Показать скиллы с evals.json и выйти
  --model <id>      Модель (по умолчанию ${DEFAULT_MODEL})
  --judge           Оценивать ответы судьёй против expected_output
  --limit <n>       Не больше n промптов на скилл
  --out <path>      Куда писать сырой результат (по умолчанию evals/results/)
  --dry-run         Показать план прогона, не вызывая API

Схема прогона на каждый промпт:
  baseline — голый промпт
  terse    — промпт + «отвечай кратко и по делу»
  skill    — terse + тело SKILL.md

Честная дельта — skill против terse. Дельта против baseline печатается
отдельно и помечена как завышенная: половину эффекта скилла даёт обычная
просьба отвечать кратко, и приписывать её скиллу нечестно.

Нужен ANTHROPIC_API_KEY или активный профиль ant auth login.
`);
    return;
  }

  const targets = findEvals(positional[0]);
  if (flags.list) {
    console.log('Скиллы с evals.json:\n');
    for (const t of findEvals()) {
      const n = JSON.parse(fs.readFileSync(t.file, 'utf8')).evals.length;
      console.log(`  ${t.skill.padEnd(30)} [${t.domain}]  промптов: ${n}`);
    }
    return;
  }

  if (targets.length === 0) {
    console.log(
      positional[0]
        ? `У скилла "${positional[0]}" нет evals/evals.json.`
        : 'Ни у одного скилла нет evals/evals.json.',
    );
    return;
  }

  const model = flags.model && flags.model !== true ? String(flags.model) : DEFAULT_MODEL;
  const limit = flags.limit ? Number(flags.limit) : Infinity;

  if (flags['dry-run']) {
    let calls = 0;
    console.log(`План прогона (модель ${model}):\n`);
    for (const t of targets) {
      const evals = JSON.parse(fs.readFileSync(t.file, 'utf8')).evals.slice(0, limit);
      const per = evals.length * 3 + (flags.judge ? evals.length * 3 : 0);
      calls += per;
      console.log(`  ${t.skill}: промптов ${evals.length}, вызовов ${per}`);
    }
    console.log(`\nВсего вызовов API: ${calls}. Ничего не выполнено (--dry-run).`);
    return;
  }

  // SDK экспортируется по-разному в зависимости от версии и сборки:
  // как default-экспорт ESM-интеропа или напрямую модулем.
  const mod = loadSdk();
  const Anthropic = typeof mod === 'function' ? mod : mod.default || mod.Anthropic;
  if (typeof Anthropic !== 'function') {
    throw new Error('не удалось найти конструктор в @anthropic-ai/sdk');
  }
  const client = new Anthropic();

  const results = [];
  for (const t of targets) {
    const spec = JSON.parse(fs.readFileSync(t.file, 'utf8'));
    const body = skillBody(t.skillMd);
    const evals = spec.evals.slice(0, limit);

    console.log(`\n📊 ${t.skill}  [${t.domain}]  промптов: ${evals.length}`);

    for (const e of evals) {
      const row = { skill: t.skill, domain: t.domain, id: e.id, prompt: e.prompt, arms: {} };
      for (const arm of ['baseline', 'terse', 'skill']) {
        process.stdout.write(`   #${e.id} ${arm.padEnd(9)} `);
        try {
          const r = await runArm(client, model, arm, e.prompt, body);
          row.arms[arm] = r;
          process.stdout.write(
            `out ${String(r.usage.output_tokens).padStart(5)} tok, ${r.elapsed_ms} ms\n`,
          );
        } catch (err) {
          row.arms[arm] = { arm, error: err.message };
          process.stdout.write(`❌ ${err.message}\n`);
        }
      }

      if (flags.judge && e.expected_output) {
        for (const arm of ['baseline', 'terse', 'skill']) {
          const a = row.arms[arm];
          if (!a || a.error) continue;
          try {
            a.judge = await judge(client, model, e.prompt, e.expected_output, a.text);
          } catch (err) {
            a.judge = { score: null, note: `ошибка судьи: ${err.message}` };
          }
        }
        const s = (arm) => row.arms[arm]?.judge?.score;
        console.log(
          `      судья: baseline ${s('baseline') ?? '—'}, terse ${s('terse') ?? '—'}, skill ${s('skill') ?? '—'}`,
        );
      }

      results.push(row);
    }
  }

  // ─── Сводка ───────────────────────────────────────────────────────────────

  const ok = results.filter((r) => r.arms.terse?.usage && r.arms.skill?.usage);
  console.log('\n' + '─'.repeat(70));

  if (ok.length === 0) {
    console.log('Ни одного полного прогона — сводка не считается.');
  } else {
    const sum = (arm, field) =>
      ok.reduce((acc, r) => acc + (r.arms[arm]?.usage?.[field] ?? 0), 0);

    const outBase = sum('baseline', 'output_tokens');
    const outTerse = sum('terse', 'output_tokens');
    const outSkill = sum('skill', 'output_tokens');
    const inTerse = sum('terse', 'input_tokens');
    const inSkill = sum('skill', 'input_tokens');

    console.log(`Прогонов: ${ok.length}, модель: ${model}\n`);
    console.log('Выход (output_tokens, суммарно):');
    console.log(`   baseline ${String(outBase).padStart(7)}`);
    console.log(`   terse    ${String(outTerse).padStart(7)}`);
    console.log(`   skill    ${String(outSkill).padStart(7)}`);
    console.log('');
    console.log(`Честная дельта (skill против terse): ${pct(outSkill, outTerse)}% выхода`);
    console.log(
      `Дельта против baseline: ${pct(outSkill, outBase)}% — ЗАВЫШЕНА, не цитировать как эффект скилла`,
    );
    console.log('');
    console.log(
      `Цена скилла на входе: +${inSkill - inTerse} input_tokens за ${ok.length} прогонов ` +
        `(${Math.round((inSkill - inTerse) / ok.length)} на вызов)`,
    );

    if (flags.judge) {
      const avg = (arm) => {
        const xs = ok.map((r) => r.arms[arm]?.judge?.score).filter((x) => typeof x === 'number');
        return xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null;
      };
      console.log('');
      console.log('Оценка судьи (0-10):');
      console.log(`   baseline ${avg('baseline') ?? '—'}`);
      console.log(`   terse    ${avg('terse') ?? '—'}`);
      console.log(`   skill    ${avg('skill') ?? '—'}`);
      const d = avg('skill') !== null && avg('terse') !== null ? avg('skill') - avg('terse') : null;
      if (d !== null) {
        console.log(`\n   Честная дельта качества: ${d > 0 ? '+' : ''}${Math.round(d * 10) / 10}`);
        if (d <= 0) {
          console.log('   Скилл не выигрывает у обычной просьбы отвечать кратко.');
          console.log('   Это результат прогона, а не повод его прятать.');
        }
      }
    }
  }

  // Сырые результаты коммитятся: числа в документации должны быть проверяемы.
  const outPath =
    flags.out && flags.out !== true
      ? path.resolve(String(flags.out))
      : path.join(REPO_ROOT, 'evals', 'results', `run-${results.length}-prompts.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(
    outPath,
    `${JSON.stringify({ model, arms: ['baseline', 'terse', 'skill'], results }, null, 2)}\n`,
  );
  console.log(`\n💾 Сырой результат: ${outPath}`);
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
