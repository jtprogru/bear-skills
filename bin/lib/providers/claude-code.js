'use strict';
const path = require('node:path');
module.exports = {
  id: 'claude-code', label: 'Claude Code', binaries: ['claude'],
  capabilities: { skills: 'native', rules: 'native', agents: 'native', commands: 'native', runtime: 'SessionStart' },
  docs: ['https://code.claude.com/docs/en/skills', 'https://code.claude.com/docs/en/sub-agents', 'https://code.claude.com/docs/en/hooks'],
  root: o => o.scope === 'project' ? path.join(o.project, '.claude') : path.join(o.home, '.claude'),
  ruleDir: (o, root, c) => o.scope === 'global' && o.vault && c.domain === 'obsidian'
    ? path.join(o.vault, '.agents', 'rules') : path.join(root, 'rules'),
  agentExtension: '.md', ruleExtension: '.md', hookFile: 'settings.json', hookEvent: 'SessionStart',
  limitations: ['Project hooks требуют доверия workspace; installer не выдаёт разрешений.'],
};
