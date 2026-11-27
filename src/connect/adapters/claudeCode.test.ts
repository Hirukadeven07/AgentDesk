import { describe, expect, it } from 'vitest';
import { memoryTree } from '../fileTree';
import { claudeCode } from './claudeCode';

const md = (frontmatter: string, body: string) => `---\n${frontmatter}\n---\n\n${body}\n`;

/** A project laid out the way Claude Code reads it. */
const project = memoryTree({
  'CLAUDE.md': '# Project\n\nRun npm test before you commit.\n',
  '.claude/settings.json': JSON.stringify({ model: 'opus', permissions: { allow: ['Bash(npm test)'] } }),
  '.claude/agents/code-reviewer.md': md('name: code-reviewer\ndescription: Reviews diffs for bugs.\ntools: Read, Grep, Glob\nmodel: sonnet\nskills:\n  - pr', 'You are a careful reviewer.'),
  '.claude/agents/team/docs-writer.md': md('name: docs-writer\ndescription: Writes docs.', 'You write docs.'),
  '.claude/commands/ship.md': md('description: Commit, push and open a PR', 'Run the checks, then push.'),
  '.claude/commands/frontend/component.md': 'Create a React component named $ARGUMENTS.\n\nUse the design tokens.',
  '.mcp.json': JSON.stringify({ mcpServers: { github: { type: 'http', url: 'https://example.test/mcp' }, db: { command: 'npx', args: ['db-mcp'] } } }),
  'src/index.ts': 'export {}',
});

describe('claudeCode adapter', () => {
  it('detects a Claude Code project by CLAUDE.md, .claude/, .mcp.json or a plugin', () => {
    expect(claudeCode.detect(memoryTree({ 'CLAUDE.md': '' }))).toBe(true);
    expect(claudeCode.detect(memoryTree({ '.claude/settings.json': '{}' }))).toBe(true);
    expect(claudeCode.detect(memoryTree({ '.mcp.json': '{}' }))).toBe(true);
    expect(claudeCode.detect(memoryTree({ 'p/.claude-plugin/plugin.json': '{}' }))).toBe(true);
    expect(claudeCode.detect(memoryTree({ 'AGENTS.md': '', 'src/a.ts': '' }))).toBe(false);
  });

  it('reports the primary agent with CLAUDE.md as its instructions and the model from settings', async () => {
    const { agents } = await claudeCode.parse(project);
    expect(agents[0]).toEqual({
      id: 'claude-code',
      name: 'Claude Code',
      kind: 'primary',
      description: 'The main Claude Code agent for this project.',
      instructions: '# Project\n\nRun npm test before you commit.\n',
      model: 'opus',
      tools: [],
      skills: [],
      origin: { platform: 'claude-code', path: 'CLAUDE.md' },
    });
  });

  it('reads custom agents, including ones in subfolders', async () => {
    const { agents } = await claudeCode.parse(project);
    expect(agents.slice(1)).toEqual([
      {
        id: 'code-reviewer',
        name: 'code-reviewer',
        kind: 'custom',
        description: 'Reviews diffs for bugs.',
        instructions: 'You are a careful reviewer.\n',
        model: 'sonnet',
        tools: ['Read', 'Grep', 'Glob'],
        skills: ['pr'],
        origin: { platform: 'claude-code', path: '.claude/agents/code-reviewer.md' },
      },
      {
        id: 'docs-writer',
        name: 'docs-writer',
        kind: 'custom',
        description: 'Writes docs.',
        instructions: 'You write docs.\n',
        tools: [],
        skills: [],
        origin: { platform: 'claude-code', path: '.claude/agents/team/docs-writer.md' },
      },
    ]);
  });

  it('reads slash commands as skills, using the first line when there is no description', async () => {
    const { skills } = await claudeCode.parse(project);
    expect(skills.map((s) => [s.id, s.description, s.origin.path])).toEqual([
      ['component', 'Create a React component named $ARGUMENTS.', '.claude/commands/frontend/component.md'],
      ['ship', 'Commit, push and open a PR', '.claude/commands/ship.md'],
    ]);
    expect(skills[1].instructions).toBe('Run the checks, then push.\n');
  });

  it('reads MCP servers from .mcp.json', async () => {
    const { mcpServers } = await claudeCode.parse(project);
    expect(mcpServers).toEqual([
      { name: 'github', origin: { platform: 'claude-code', path: '.mcp.json' } },
      { name: 'db', origin: { platform: 'claude-code', path: '.mcp.json' } },
    ]);
  });

  it('leaves SKILL.md files to the agent-skills adapter', async () => {
    const { skills } = await claudeCode.parse(memoryTree({ 'CLAUDE.md': '', '.claude/skills/pr/SKILL.md': md('name: pr\ndescription: d', 'b') }));
    expect(skills).toEqual([]);
  });

  it('uses the file name for an agent without a name, and warns about a missing description', async () => {
    const { agents, warnings } = await claudeCode.parse(memoryTree({ '.claude/agents/helper.md': 'Just help.' }));
    expect(agents.map((a) => a.id)).toEqual(['claude-code', 'helper']);
    expect(warnings).toEqual(['.claude/agents/helper.md has no description']);
  });

  it('points the primary agent at .claude/ when there is no CLAUDE.md', async () => {
    const { agents } = await claudeCode.parse(memoryTree({ '.claude/settings.json': '{}' }));
    expect(agents[0]).toMatchObject({ id: 'claude-code', origin: { path: '.claude/settings.json' } });
    expect(agents[0].instructions).toBeUndefined();
  });

  it('gives CLAUDE.md with plain line endings, as checked out on Windows', async () => {
    const { agents } = await claudeCode.parse(memoryTree({ 'CLAUDE.md': '﻿# Project\r\n\r\nUse pnpm.\r\n' }));
    expect(agents[0].instructions).toBe('# Project\n\nUse pnpm.\n');
  });

  it('reads .claude/CLAUDE.md when there is no CLAUDE.md at the root', async () => {
    const { agents } = await claudeCode.parse(memoryTree({ '.claude/CLAUDE.md': 'Use pnpm.' }));
    expect(agents[0]).toMatchObject({ instructions: 'Use pnpm.', origin: { path: '.claude/CLAUDE.md' } });
  });

  it('warns about broken JSON instead of failing', async () => {
    const { mcpServers, warnings } = await claudeCode.parse(memoryTree({ '.mcp.json': '{ not json', '.claude/settings.json': '[' }));
    expect(mcpServers).toEqual([]);
    expect(warnings).toEqual(['.claude/settings.json is not valid JSON', '.mcp.json is not valid JSON']);
  });

  describe('plugins', () => {
    const marketplace = memoryTree({
      '.claude-plugin/marketplace.json': '{}',
      'plugins/review/.claude-plugin/plugin.json': JSON.stringify({ name: 'review', description: 'Review tools', mcpServers: { linter: { command: 'lint-mcp' } } }),
      'plugins/review/agents/security.md': md('name: security\ndescription: Finds security bugs.\ntools: Read', 'Look for injection.'),
      'plugins/review/commands/check.md': md('description: Run every check', 'Run them.'),
      'plugins/review/skills/lint/SKILL.md': md('name: lint\ndescription: d', 'b'),
      'plugins/review/.mcp.json': JSON.stringify({ mcpServers: { search: { url: 'https://example.test' } } }),
      'plugins/notes/.claude-plugin/plugin.json': '{}',
      'plugins/notes/agents/scribe.md': md('description: Takes notes.', 'Write it down.'),
    });

    it('reads plugin agents and commands, namespaced by plugin', async () => {
      const { agents, skills } = await claudeCode.parse(marketplace);
      expect(agents.map((a) => [a.id, a.kind, a.origin.path])).toEqual([
        ['notes:scribe', 'custom', 'plugins/notes/agents/scribe.md'],
        ['review:security', 'custom', 'plugins/review/agents/security.md'],
      ]);
      expect(skills.map((s) => s.id)).toEqual(['review:check']);
    });

    it("reads a plugin's MCP servers from plugin.json and its .mcp.json", async () => {
      const { mcpServers } = await claudeCode.parse(marketplace);
      expect(mcpServers.map((m) => [m.name, m.origin.path])).toEqual([
        ['review:linter', 'plugins/review/.claude-plugin/plugin.json'],
        ['review:search', 'plugins/review/.mcp.json'],
      ]);
    });

    it('has no primary agent when the repo only ships plugins', async () => {
      const { agents } = await claudeCode.parse(marketplace);
      expect(agents.some((a) => a.kind === 'primary')).toBe(false);
    });

    it('reads a plugin that sits at the root of the repo', async () => {
      const { agents } = await claudeCode.parse(memoryTree({
        '.claude-plugin/plugin.json': JSON.stringify({ name: 'solo' }),
        'agents/helper.md': md('name: helper\ndescription: Helps.', 'Help.'),
      }));
      expect(agents.map((a) => a.id)).toEqual(['solo:helper']);
    });
  });
});
