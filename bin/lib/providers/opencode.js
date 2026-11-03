'use strict';
const path = require('node:path');
module.exports = {
  id: 'opencode', label: 'OpenCode', binaries: ['opencode'],
  capabilities: { skills: 'native', rules: 'instructions index', agents: 'native + mode', commands: 'native', runtime: 'local plugin' },
  docs: ['https://opencode.ai/docs/skills/', 'https://opencode.ai/docs/agents/', 'https://opencode.ai/docs/commands/', 'https://opencode.ai/docs/plugins/'],
  root: o => o.scope === 'project' ? path.join(o.project, '.opencode') : path.join(o.xdgConfig || path.join(o.home, '.config'), 'opencode'),
  ruleDir: (o, root) => path.join(root, '.bear-skills', 'rules'),
  agentExtension: '.md', ruleExtension: '.md',
  limitations: ['Agent-local Claude hooks не переносятся; компонент отмечается несовместимым.',
    'Plugin подключает общий контракт и индекс через native instructions; все правила сразу не инжектируются.'],
};
