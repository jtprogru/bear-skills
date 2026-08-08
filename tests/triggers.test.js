'use strict';

// Детектор пересекающихся триггеров (bear-skills doctor). Ошибка в любую
// сторону обесценивает его: слишком широкий ловит кавычки из тела скилла и
// тонет в шуме, слишком узкий молчит всегда и выглядит исправным.

const test = require('node:test');
const assert = require('node:assert');
const { frontmatterDescription, triggerWords } = require('../bin/cli.js');

const SKILL = `---
name: demo
description: >
  Делает что-то полезное. Используй, когда пользователь говорит «написать пост»,
  «оформить мысль для канала», «короткий пост».
---

# demo

В теле тоже бывают «ёлочки», но это не триггеры — например «человеческая ошибка».
`;

test('description достаётся из фронтматтера целиком', () => {
  const d = frontmatterDescription(SKILL);
  assert.match(d, /Делает что-то полезное/);
  assert.match(d, /короткий пост/);
});

test('тело скилла в description не попадает', () => {
  const d = frontmatterDescription(SKILL);
  assert.ok(!d.includes('человеческая ошибка'), 'подхватил кавычки из тела');
});

test('триггеры берутся только из кавычек описания', () => {
  const words = triggerWords(frontmatterDescription(SKILL));
  assert.ok(words.has('написать пост'));
  assert.ok(words.has('оформить мысль для канала'));
  assert.ok(!words.has('человеческая ошибка'));
});

test('одиночные короткие слова триггерами не считаются', () => {
  const words = triggerWords('Пиши «хорошо», а не «плохо».');
  assert.strictEqual(words.size, 0);
});

test('пересечение триггеров обнаруживается', () => {
  const a = triggerWords('Используй, когда «написать постмортем», «разбор инцидента».');
  const b = triggerWords('Срабатывай на «разбор инцидента», «оформить итоги».');
  const shared = [...a].filter((w) => b.has(w));
  assert.deepStrictEqual(shared, ['разбор инцидента']);
});

test('непересекающиеся описания дают пустое пересечение', () => {
  const a = triggerWords('Используй, когда «написать постмортем».');
  const b = triggerWords('Используй, когда «разбей заметку на атомарные».');
  assert.deepStrictEqual([...a].filter((w) => b.has(w)), []);
});

test('фронтматтер без description даёт пустую строку', () => {
  assert.strictEqual(frontmatterDescription('---\nname: x\n---\n\nТело.'), '');
});

test('файл без фронтматтера не ломает разбор', () => {
  assert.strictEqual(frontmatterDescription('# Просто текст\n'), '');
});
