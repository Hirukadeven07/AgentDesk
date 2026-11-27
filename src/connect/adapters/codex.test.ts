import { describe, expect, it } from 'vitest';
import { memoryTree } from '../fileTree';
import { codex } from './codex';

const config = `
model = "gpt-5.5-codex"
approval_policy = "on-request"

[agents]
max_threads = 6
max_depth = 1

[agents.reviewer]
description = "Reviews changes for correctness and missing tests."

[agents.explorer]
description = "Maps the codebase before a change."
config_file = "agents/pr-explorer.toml"

[mcp_servers.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp"]

[mcp_servers.docs]
url = "https://example.test/mcp"
enabled = false
`;

const explorer = `
name = "pr-explorer"
description = "Read-only explorer for pull requests."
model = "gpt-5.5-codex-mini"
developer_instructions = """
Explore the code. Never edit files.
"""
`;

const project = memoryTree({
  'AGENTS.md': '# Repo guide\n\nRun `pnpm test` before every commit.\n',
  'packages/api/AGENTS.md': 'Use the API style guide.',
  '.codex/config.toml': config,
  '.codex/agents/pr-explorer.toml': explorer,
  '.codex/agents/docs-writer.toml': 'name = "docs-writer"\ndescription = "Writes docs."\ndeveloper_instructions = "Write clear docs."\n',
});

describe('codex adapter', () => {
  it('detects AGENTS.md, AGENTS.override.md or a .codex folder', () => {
    expect(codex.detect(memoryTree({ 'AGENTS.md': '' }))).toBe(true);
    expect(codex.detect(memoryTree({ 'AGENTS.override.md': '' }))).toBe(true);
    expect(codex.detect(memoryTree({ 'apps/web/AGENTS.md': '' }))).toBe(true);
    expect(codex.detect(memoryTree({ '.codex/config.toml': '' }))).toBe(true);
    expect(codex.detect(memoryTree({ 'CLAUDE.md': '' }))).toBe(false);
  });

  it('reports the primary agent with the root AGENTS.md and the model from config.toml', async () => {
    const { agents } = await codex.parse(project);
    expect(agents[0]).toEqual({
      id: 'codex',
      name: 'Codex',
      kind: 'primary',
      description: 'The main Codex agent for this project.',
      instructions: '# Repo guide\n\nRun `pnpm test` before every commit.\n',
      model: 'gpt-5.5-codex',
      tools: [],
      skills: [],
      origin: { platform: 'codex', path: 'AGENTS.md' },
    });
  });

  it('prefers AGENTS.override.md, as Codex does', async () => {
    const { agents } = await codex.parse(memoryTree({ 'AGENTS.md': 'normal', 'AGENTS.override.md': 'override' }));
    expect(agents[0]).toMatchObject({ instructions: 'override', origin: { path: 'AGENTS.override.md' } });
  });

  it("does not use a subfolder's AGENTS.md as the project's instructions, but still points at it", async () => {
    const { agents } = await codex.parse(memoryTree({ 'apps/web/src/AGENTS.md': 'deep', 'apps/AGENTS.md': 'only about apps/' }));
    expect(agents[0].instructions).toBeUndefined();
    expect(agents[0].origin.path).toBe('apps/AGENTS.md');
  });

  it('reads custom agents from .codex/agents/*.toml and roles from config.toml, without duplicates', async () => {
    const { agents } = await codex.parse(project);
    expect(agents.slice(1)).toEqual([
      {
        id: 'docs-writer',
        name: 'docs-writer',
        kind: 'custom',
        description: 'Writes docs.',
        instructions: 'Write clear docs.',
        tools: [],
        skills: [],
        origin: { platform: 'codex', path: '.codex/agents/docs-writer.toml' },
      },
      {
        id: 'pr-explorer',
        name: 'pr-explorer',
        kind: 'custom',
        description: 'Read-only explorer for pull requests.',
        instructions: 'Explore the code. Never edit files.\n',
        model: 'gpt-5.5-codex-mini',
        tools: [],
        skills: [],
        origin: { platform: 'codex', path: '.codex/agents/pr-explorer.toml' },
      },
      {
        id: 'reviewer',
        name: 'reviewer',
        kind: 'custom',
        description: 'Reviews changes for correctness and missing tests.',
        tools: [],
        skills: [],
        origin: { platform: 'codex', path: '.codex/config.toml' },
      },
    ]);
  });

  it('reads MCP servers from config.toml', async () => {
    const { mcpServers } = await codex.parse(project);
    expect(mcpServers).toEqual([
      { name: 'context7', origin: { platform: 'codex', path: '.codex/config.toml' } },
      { name: 'docs', origin: { platform: 'codex', path: '.codex/config.toml' } },
    ]);
  });

  it('warns about broken TOML and an agent file missing its required fields', async () => {
    const { agents, warnings } = await codex.parse(memoryTree({
      '.codex/config.toml': 'model = ',
      '.codex/agents/half.toml': 'name = "half"\n',
    }));
    expect(agents.map((a) => a.id)).toEqual(['codex', 'half']);
    expect(warnings).toEqual([
      expect.stringMatching(/^\.codex\/config\.toml is not valid TOML/),
      '.codex/agents/half.toml has no description',
      '.codex/agents/half.toml has no developer_instructions',
    ]);
  });

  it('keeps a role whose config_file is missing, and warns about it', async () => {
    const { agents, warnings } = await codex.parse(memoryTree({ '.codex/config.toml': '[agents.fixer]\ndescription = "Fixes bugs."\nconfig_file = "../shared/fixer.toml"\n' }));
    expect(agents[1]).toMatchObject({ id: 'fixer', description: 'Fixes bugs.', origin: { path: '.codex/config.toml' } });
    expect(warnings).toEqual(['.codex/config.toml role "fixer" points at shared/fixer.toml, which is not in the project']);
  });

  it('uses the file name when an agent file has no name', async () => {
    const { agents } = await codex.parse(memoryTree({ '.codex/agents/tester.toml': 'description = "Tests."\ndeveloper_instructions = "Test."\n' }));
    expect(agents[1]).toMatchObject({ id: 'tester', name: 'tester' });
  });

  it('cleans up line endings in AGENTS.md', async () => {
    const { agents } = await codex.parse(memoryTree({ 'AGENTS.md': '﻿Line one\r\nLine two\r\n' }));
    expect(agents[0].instructions).toBe('Line one\nLine two\n');
  });
});
