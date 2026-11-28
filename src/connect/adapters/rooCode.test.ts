import { describe, expect, it } from 'vitest';
import { memoryTree } from '../fileTree';
import { rooCode } from './rooCode';

const roomodesYaml = `customModes:
  - slug: docs-writer
    name: 📝 Docs Writer
    roleDefinition: You are Roo, a technical writer.
    whenToUse: Use for writing and editing documentation.
    customInstructions: Keep sentences short.
    groups:
      - read
      - - edit
        - fileRegex: \\.mdx?$
          description: Markdown files only
  - slug: reviewer
    name: Reviewer
    roleDefinition: You review pull requests.
    description: Reviews code
    groups: [read, command]
`;

const project = memoryTree({
  '.roomodes': roomodesYaml,
  '.roorules': 'Prefer pnpm.\n',
  '.roo/rules/01-general.md': 'Be concise.\n',
  '.roo/rules/02-api.txt': 'Validate inputs.\n',
  '.roo/rules-docs-writer/1_style.xml': '<style>Use active voice.</style>\n',
  '.roorules-reviewer': 'Check tests first.\n',
  '.roo/rules-code/safe-writes.md': 'Use safeWriteJson.\n',
  '.roo/commands/release.md': '---\ndescription: Cut a release\nargument-hint: <version>\n---\nBump and tag.\n',
  '.roo/mcp.json': JSON.stringify({ mcpServers: { context7: { command: 'npx' } } }),
});

describe('rooCode adapter', () => {
  it('detects .roomodes, a .roo folder or .roorules files', () => {
    expect(rooCode.detect(memoryTree({ '.roomodes': '' }))).toBe(true);
    expect(rooCode.detect(memoryTree({ '.roo/rules/a.md': '' }))).toBe(true);
    expect(rooCode.detect(memoryTree({ '.roorules': '' }))).toBe(true);
    expect(rooCode.detect(memoryTree({ '.roorules-code': '' }))).toBe(true);
    expect(rooCode.detect(memoryTree({ '.clinerules': '' }))).toBe(false);
  });

  it('gives the primary agent .roorules and every file in .roo/rules/, in order', async () => {
    const { agents } = await rooCode.parse(project);
    expect(agents[0]).toEqual({
      id: 'roo-code',
      name: 'Roo Code',
      kind: 'primary',
      description: 'The main Roo Code agent for this project.',
      instructions: 'Prefer pnpm.\n\n# 01-general (.roo/rules/01-general.md)\n\nBe concise.\n\n# 02-api (.roo/rules/02-api.txt)\n\nValidate inputs.\n',
      tools: [],
      skills: [],
      origin: { platform: 'roo-code', path: '.roorules' },
    });
  });

  it('reads custom modes as agents, with their mode rules and tool groups', async () => {
    const { agents } = await rooCode.parse(project);
    expect(agents.slice(1)).toEqual([
      {
        id: 'docs-writer',
        name: '📝 Docs Writer',
        kind: 'custom',
        description: 'Use for writing and editing documentation.',
        instructions:
          'You are Roo, a technical writer.\n\nKeep sentences short.\n\n# 1_style (.roo/rules-docs-writer/1_style.xml)\n\n<style>Use active voice.</style>\n',
        tools: ['read', 'edit'],
        skills: [],
        origin: { platform: 'roo-code', path: '.roomodes' },
      },
      {
        id: 'reviewer',
        name: 'Reviewer',
        kind: 'custom',
        description: 'Reviews code',
        instructions: 'You review pull requests.\n\n# .roorules-reviewer\n\nCheck tests first.\n',
        tools: ['read', 'command'],
        skills: [],
        origin: { platform: 'roo-code', path: '.roomodes' },
      },
    ]);
  });

  it('reads .roomodes written as JSON', async () => {
    const json = JSON.stringify({ customModes: [{ slug: 'qa', name: 'QA', roleDefinition: 'You test things.', groups: ['read'] }] });
    const { agents } = await rooCode.parse(memoryTree({ '.roomodes': json }));
    expect(agents.map((a) => a.id)).toEqual(['roo-code', 'qa']);
  });

  it('shows rules for a built-in mode as a skill, and reads commands and MCP servers', async () => {
    const { skills, mcpServers } = await rooCode.parse(project);
    expect(skills.map((s) => [s.id, s.description, s.origin.path])).toEqual([
      ['rules-code', 'Extra rules for the code mode', '.roo/rules-code/safe-writes.md'],
      ['release', 'Cut a release', '.roo/commands/release.md'],
    ]);
    expect(mcpServers).toEqual([{ name: 'context7', origin: { platform: 'roo-code', path: '.roo/mcp.json' } }]);
  });

  it('warns about broken .roomodes, and about a mode with no slug', async () => {
    const broken = await rooCode.parse(memoryTree({ '.roomodes': 'customModes: [' }));
    expect(broken.warnings).toEqual([expect.stringMatching(/^\.roomodes is not valid YAML or JSON/)]);
    const noSlug = await rooCode.parse(memoryTree({ '.roomodes': 'customModes:\n  - name: Nameless\n' }));
    expect(noSlug.warnings).toEqual(['.roomodes has a mode with no slug']);
    expect(noSlug.agents.map((a) => a.id)).toEqual(['roo-code']);
  });
});
