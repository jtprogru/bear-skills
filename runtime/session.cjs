#!/usr/bin/env node
'use strict';
// Native hooks must fail open without breaking the user's session.
const fs = require('node:fs');
const path = require('node:path');
try {
  const inventory = JSON.parse(fs.readFileSync(path.join(__dirname, 'installation.json'), 'utf8'));
  if (inventory.schemaVersion === 1 && Object.keys(inventory.components).length) {
    let context = fs.readFileSync(path.join(__dirname, 'contract.md'), 'utf8');
    if (inventory.provider === 'codex' || inventory.provider === 'cursor') {
      context += '\n' + fs.readFileSync(path.join(__dirname, 'index.md'), 'utf8');
    }
    const output = inventory.provider === 'cursor' ? { additional_context: context }
      : { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context } };
    process.stdout.write(JSON.stringify(output) + '\n');
  }
} catch { /* no credentials, flags or personal config writes at runtime */ }
