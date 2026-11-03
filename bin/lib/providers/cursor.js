'use strict';
const path = require('node:path');
module.exports = {
  id: 'cursor', label: 'Cursor', binaries: ['cursor', 'agent'],
  capabilities: { skills: 'native', rules: 'MDC (global via hook index)', agents: 'native (permissions limited)', commands: 'native', runtime: 'sessionStart' },
  docs: ['https://cursor.com/docs/plugins', 'https://cursor.com/docs/skills', 'https://cursor.com/docs/rules', 'https://cursor.com/docs/subagents', 'https://cursor.com/docs/hooks'],
  root: o => path.join(o.scope === 'project' ? o.project : o.home, '.cursor'),
  ruleDir: (o, root) => path.join(root, 'rules'),
  agentExtension: '.md', ruleExtension: '.mdc', hookFile: 'hooks.json', hookEvent: 'sessionStart',
  limitations: ['Global .mdc подключаются ссылками из sessionStart: автоматические project glob rules доступны только project scope.',
    'Произвольные agent tools allowlist и agent-local hooks не переносятся; компонент отмечается несовместимым.'],
};
