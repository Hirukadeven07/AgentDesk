import { describe, expect, it } from 'vitest';
import { memoryTree } from '../fileTree';
import { cursor } from './cursor';

const rule = (frontmatter: string, body: string) => `---\n${frontmatter}\n---\n${body}\n`;

const project = memoryTree({
  '.cursorrules': 'Prefer small functions.\n',
  '.cursor/rules/style.mdc': rule('description: House style\nglobs:\nalwaysApply: true', 'Use 2-space indents.'),
  '.cursor/rules/react.mdc': rule('description:\nglobs: src/**/*.tsx, src/**/*.jsx\nalwaysApply: false', 'Use function components.'),
  '.cursor/rules/api.mdc': rule('description: How to add an API route\nalwaysApply: false', 'Put routes in src/api.'),
  '.cursor/rules/release.md': 'Steps to cut a release.',
  '.cursor/rules/templates/RULE.md': rule('description: Page templates\nalwaysApply: false', 'Use the page shell.'),
  'apps/web/.cursor/rules/web.mdc': rule('alwaysApply: true', 'Web-only rule.'),
  '.cursor/agents/verifier.md': rule('name: verifier\ndescription: Checks that work is done.\nmodel: fast', 'Run the tests and report.'),
  '.cursor/commands/review.md': 'Review the staged changes.\n',
  '.cursor/mcp.json': JSON.stringify({ mcpServers: { linear: { url: 'https://example.test/mcp' } } }),
});

describe('cursor adapter', () => {
  it('detects a .cursor folder or .cursorrules', () => {
    expect(cursor.detect(memoryTree({ '.cursorrules': '' }))).toBe(true);
    expect(cursor.detect(memoryTree({ '.cursor/mcp.json': '{}' }))).toBe(true);
    expect(cursor.detect(memoryTree({ 'pkg/.cursor/rules/a.mdc': '' }))).toBe(true);
    expect(cursor.detect(memoryTree({ 'AGENTS.md': '' }))).toBe(false);
  });

  it('gives the primary agent .cursorrules and the always-applied rules at the root as its instructions', async () => {
    const { agents } = await cursor.parse(project);
    expect(agents[0]).toEqual({
      id: 'cursor',
      name: 'Cursor',
      kind: 'primary',
      description: 'The main Cursor agent for this project.',
      instructions: 'Prefer small functions.\n\n# style (.cursor/rules/style.mdc)\n\nUse 2-space indents.\n',
      tools: [],
      skills: [],
      origin: { platform: 'cursor', path: '.cursorrules' },
    });
  });

  it('shows every other rule as a skill, describing when it applies', async () => {
    const { skills } = await cursor.parse(project);
    const rules = skills.filter((s) => s.origin.path.includes('/rules/'));
    expect(rules.map((s) => [s.id, s.description, s.origin.path])).toEqual([
      ['api', 'How to add an API route', '.cursor/rules/api.mdc'],
      ['react', 'Applies to src/**/*.tsx, src/**/*.jsx', '.cursor/rules/react.mdc'],
      ['release', 'Steps to cut a release.', '.cursor/rules/release.md'],
      ['templates', 'Page templates', '.cursor/rules/templates/RULE.md'],
      ['web', 'Always applies in apps/web/', 'apps/web/.cursor/rules/web.mdc'],
    ]);
    expect(rules[0].instructions).toBe('Put routes in src/api.\n');
  });

  it('describes a rule with no description or globs as one you mention by name', async () => {
    const { skills } = await cursor.parse(memoryTree({ '.cursor/rules/manual.mdc': rule('alwaysApply: false', '') }));
    expect(skills[0].description).toBe('Applied when mentioned as @manual');
  });

  it('reads custom agents, commands and MCP servers', async () => {
    const { agents, skills, mcpServers } = await cursor.parse(project);
    expect(agents[1]).toEqual({
      id: 'verifier',
      name: 'verifier',
      kind: 'custom',
      description: 'Checks that work is done.',
      instructions: 'Run the tests and report.\n',
      model: 'fast',
      tools: [],
      skills: [],
      origin: { platform: 'cursor', path: '.cursor/agents/verifier.md' },
    });
    expect(skills.find((s) => s.id === 'review')).toMatchObject({ description: 'Review the staged changes.', origin: { path: '.cursor/commands/review.md' } });
    expect(mcpServers).toEqual([{ name: 'linear', origin: { platform: 'cursor', path: '.cursor/mcp.json' } }]);
  });

  it('reads unquoted globs the way Cursor writes them, which is not valid YAML, without a warning', async () => {
    // copied from a real project: `*` starts a YAML alias, but Cursor reads these lines as plain text
    const { agents, skills, warnings } = await cursor.parse(memoryTree({
      '.cursor/rules/ts.mdc': '---\nglobs: *.ts,*.tsx,*.d.ts\nalwaysApply: false\n---\n\n# TS rules\n',
      '.cursor/rules/vue.mdc': '---\nglobs: *.vue\nalwaysApply: false\n---\n\n# Vue rules\n',
      '.cursor/rules/core.mdc': '---\ndescription: Core: always\nglobs: *\nalwaysApply: true\n---\nCore.\n',
    }));
    expect(warnings).toEqual([]);
    expect(skills.map((s) => [s.id, s.description])).toEqual([
      ['ts', 'Applies to *.ts, *.tsx, *.d.ts'],
      ['vue', 'Applies to *.vue'],
    ]);
    expect(agents[0].instructions).toBe('# core (.cursor/rules/core.mdc)\n\nCore.\n');
  });

  it('still warns about frontmatter it cannot read at all', async () => {
    const { warnings } = await cursor.parse(memoryTree({ '.cursor/rules/x.mdc': '---\n[[[\n---\nBody' }));
    expect(warnings).toEqual([expect.stringMatching(/^\.cursor\/rules\/x\.mdc has invalid frontmatter: /)]);
  });

  it('accepts alwaysApply written as a string', async () => {
    const { agents, skills } = await cursor.parse(memoryTree({ '.cursor/rules/a.mdc': rule('alwaysApply: "true"', 'Always.') }));
    expect(agents[0]).toMatchObject({ instructions: '# a (.cursor/rules/a.mdc)\n\nAlways.\n', origin: { path: '.cursor/rules/a.mdc' } });
    expect(skills).toEqual([]);
  });

  it('has a primary agent with no instructions when there are no always-applied rules', async () => {
    const { agents } = await cursor.parse(memoryTree({ '.cursor/mcp.json': '{}' }));
    expect(agents[0].instructions).toBeUndefined();
    expect(agents[0].origin.path).toBe('.cursor/mcp.json');
  });

  it('leaves SKILL.md files under .cursor/skills to the agent-skills adapter', async () => {
    const { skills } = await cursor.parse(memoryTree({ '.cursor/skills/x/SKILL.md': rule('name: x\ndescription: d', 'b') }));
    expect(skills).toEqual([]);
  });
});
