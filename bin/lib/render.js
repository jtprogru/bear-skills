'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { destination } = require('./providers');
const { frontmatter } = require('./catalog');
const TEXT = new Set(['.md', '.mdc', '.txt', '.json', '.yaml', '.yml']);
const q = JSON.stringify;
const slash = p => p.split(path.sep).join('/');
const quoteArg = s => "'" + s.replace(/'/g, "'\\''") + "'";

function rewrite(text, file, catalog, locate) {
  return text.replace(/\{\{(rule|skill|agent|command):([a-z0-9_-]+)\}\}/g, (_, kind, name) => {
    const target = catalog.components.get(kind + ':' + name);
    if (!target) throw new Error(file + ': неизвестная ссылка ' + kind + ':' + name);
    return slash(path.relative(path.dirname(file), locate(target))) || '.';
  });
}

function agentText(c, text, provider) {
  const { fields: f, body, header } = frontmatter(text);
  if (provider.id === 'claude-code') {
    // Explicit choices made by a user still take precedence at invocation time.
    return '---\n' + header.replace(/^model:.*(?:\n|$)/m, '') + '\n---\n' + body;
  }
  if (provider.id === 'codex') return 'name = ' + q(c.name) + '\ndescription = ' + q(f.description) +
    '\ndeveloper_instructions = ' + q(body) + '\n';
  let out = '---\nname: ' + q(c.name) + '\ndescription: ' + q(f.description) + '\n';
  if (provider.id === 'cursor') out += 'model: inherit\n';
  if (provider.id === 'opencode') {
    out += 'mode: subagent\n';
    if (f.tools) {
      const mapping = { Read: ['read'], Write: ['edit'], Edit: ['edit'], Glob: ['glob'],
        Grep: ['grep'], Bash: ['bash'], Skill: ['skill'], WebFetch: ['webfetch'],
        WebSearch: ['websearch'], Task: ['task'] };
      const allowed = new Set(f.tools.split(',').flatMap(t => mapping[t.trim()]));
      // Never grant permissions automatically: allowed capabilities still ask
      // the user. Unknown/MCP tools remain denied by this agent's allowlist.
      out += 'permission:\n  "*": deny\n';
      for (const tool of allowed) out += '  ' + tool + ': ask\n';
    }
  }
  return out + '---\n' + body;
}

function renderComponent(c, catalog, options, loc) {
  const base = destination(c, options, loc);
  const locate = target => destination(target, options, loc);
  const result = [];
  for (const src of c.files) {
    const skillCommand = c.kind === 'command' && loc.provider.id === 'codex';
    const file = c.kind === 'skill' ? path.join(base, path.relative(c.src, src))
      : skillCommand ? path.join(base, 'SKILL.md') : base;
    const raw = fs.readFileSync(src);
    let data = raw;
    if (TEXT.has(path.extname(src))) {
      let text = rewrite(raw.toString('utf8'), file, catalog, locate);
      if (c.domain === 'bear') {
        const flags = ' --provider ' + loc.provider.id + ' --scope ' + options.scope +
          (options.scope === 'project' ? ' --project ' + quoteArg(options.project) : ' --home ' + quoteArg(options.home) + ' --provider-home ' + quoteArg(loc.root));
        text = text.replace(/\bbear-skills (install|uninstall|sync|status|doctor|migrate|providers)\b/g, (_, command) => 'bear-skills ' + command + flags);
        text = text.replace(/\bbear-skills (list|check)\b/g, (_, command) => 'bear-skills ' + command + ' --source ' + quoteArg(options.source));
      }
      if (src === c.entryFile && ['skill', 'agent'].includes(c.kind) && c.dependencies.length) {
        text += '\n## Ресурсы установки\n\nПеред работой прочитай необходимые правила и скиллы. Пути ниже относятся к этому файлу:\n\n' +
          c.dependencies.map(id => {
            const target = catalog.components.get(id), targetPath = locate(target);
            const entry = target.kind === 'skill' ? path.join(targetPath, 'SKILL.md') : targetPath;
            return '- [' + id + '](<' + slash(path.relative(path.dirname(file), entry)) + '>)';
          }).join('\n') + '\n';
      }
      if (c.kind === 'agent') text = agentText(c, text, loc.provider);
      if (c.kind === 'rule' && loc.provider.id === 'cursor') text =
        '---\ndescription: ' + q(c.name + ' — правила домена ' + c.domain) + '\nalwaysApply: false\n---\n' + text;
      if (skillCommand) {
        const meta = frontmatter(text);
        text = '---\nname: bear-command-' + c.name + '\ndescription: ' + q(meta.fields.description) +
          '\n---\n' + meta.body.replace(/\$ARGUMENTS/g, 'аргументе запроса пользователя');
      }
      if (c.kind === 'skill' && loc.provider.id === 'codex' && path.basename(src) === 'SKILL.md') {
        text = text.replace(/^disable-model-invocation:.*\n/gm, '');
      }
      data = Buffer.from(text);
    }
    const mode = fs.statSync(src).mode & 0o777;
    result.push({ path: file, component: c.id, source: src, mode,
      kind: options.mode === 'symlink' && raw.equals(data) ? 'symlink' : 'file', data });
  }
  if (loc.provider.id === 'codex' && (c.meta.fields['disable-model-invocation'] === 'true' || c.kind === 'command')) {
    const file = path.join(base, 'agents', 'openai.yaml');
    // Keep any existing UI metadata while setting the native invocation policy.
    const existing = result.find(f => f.path === file);
    let yaml = existing ? existing.data.toString('utf8') : '';
    if (/^policy:/m.test(yaml)) {
      if (!/^\s+allow_implicit_invocation:/m.test(yaml)) throw new Error(c.id + ': неоднозначный agents/openai.yaml policy');
      yaml = yaml.replace(/^(\s+allow_implicit_invocation:).*/m, '$1 false');
    } else yaml += '\npolicy:\n  allow_implicit_invocation: false\n';
    if (existing) { existing.data = Buffer.from(yaml); existing.kind = 'file'; }
    else result.push({ path: file, component: c.id, kind: 'file', data: Buffer.from(yaml), mode: 0o644 });
  }
  return result;
}

function indexText(components, loc, options) {
  const domains = [...new Set(components.map(c => c.domain))].sort();
  let index = '# bear-skills\n\nАктивные домены: ' + domains.join(', ') +
    '. Перед работой прочитай правила соответствующего домена. Ссылки внутри пакетов разрешай относительно файла инструкции.\n';
  for (const c of components.filter(c => c.kind === 'rule')) {
    const target = c.destination || destination(c, options, loc);
    index += '\n- ' + c.domain + ': [' + c.name + '](<' + slash(target) + '>)';
  }
  return index + '\n';
}

function runtimeFiles(source, components, loc, options) {
  if (!components.length) return [];
  const files = [];
  function add(name, data, mode = 0o644) {
    files.push({ path: path.join(loc.stateDir, name), component: '@runtime', kind: 'file', mode, data: Buffer.from(data) });
  }
  add('contract.md', fs.readFileSync(path.join(source, 'runtime', 'contract.md')));
  add('session.cjs', fs.readFileSync(path.join(source, 'runtime', 'session.cjs')), 0o755);
  add('index.md', indexText(components, loc, options));
  if (loc.provider.id === 'opencode') {
    const instructions = [path.join(loc.stateDir, 'contract.md'), path.join(loc.stateDir, 'index.md')];
    const data = 'export const BearSkills = async () => ({\n' +
      '  config: async (config) => {\n' +
      '    config.instructions = [...new Set([...(config.instructions || []), ...' + q(instructions) + '])];\n' +
      '  },\n});\n';
    files.push({ path: path.join(loc.root, 'plugins', 'bear-skills.js'), component: '@runtime', kind: 'file',
      mode: 0o644, data: Buffer.from(data) });
  }
  return files;
}

module.exports = { rewrite, agentText, renderComponent, runtimeFiles, indexText };
