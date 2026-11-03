'use strict';
const path = require('node:path');
module.exports = {
  id: 'codex', label: 'Codex', binaries: ['codex'],
  capabilities: { skills: 'native', rules: 'references + hook index', agents: 'TOML (permissions limited)', commands: 'explicit skills', runtime: 'SessionStart' },
  docs: ['https://learn.chatgpt.com/docs/build-skills', 'https://learn.chatgpt.com/docs/agent-configuration/subagents', 'https://learn.chatgpt.com/docs/hooks'],
  root: o => o.scope === 'project' ? path.join(o.project, '.codex') : path.join(o.home, '.codex'),
  skillDir: o => path.join(o.scope === 'project' ? o.project : o.home, '.agents', 'skills'),
  ruleDir: (o, root) => path.join(root, '.bear-skills', 'rules'),
  agentExtension: '.toml', ruleExtension: '.md', hookFile: 'hooks.json', hookEvent: 'SessionStart',
  limitations: ['Нет отдельного native rules-каталога: ссылки скиллов и индекс через hook.',
    'Агенты с tools/hooks/permissionMode несовместимы: sandbox и разрешения наследуются от родителя.',
    'Hooks требуют ручного trust в /hooks; installer его не устанавливает.'],
};
