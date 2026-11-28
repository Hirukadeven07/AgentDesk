import { describe, expect, it } from 'vitest';
import { connectProject, describeFound } from './connect';
import { PLATFORM_LABELS } from './platforms';
import type { PickedFile } from './sources/local';

const file = (webkitRelativePath: string, text: string): PickedFile => ({ webkitRelativePath, size: text.length, text: async () => text });

describe('connectProject', () => {
  it('connects a picked folder', async () => {
    const r = await connectProject({ kind: 'folder', files: [file('shop/CLAUDE.md', 'Use pnpm.'), file('shop/.cursor/rules/a.mdc', '---\nglobs: *.ts\n---\nTyped.')] });
    expect(r.ok && r.project.name).toBe('shop');
    expect(r.ok && r.project.summary).toMatchObject({ agents: 2, skills: 1 });
  });

  it('connects a pasted manifest', async () => {
    const r = await connectProject({ kind: 'manifest', text: '{"version": 1, "agents": [{"id": "bot"}]}' });
    expect(r.ok && r.project.data.offFloorAgents.map((a) => a.id)).toEqual(['bot']);
  });

  it('connects a GitHub repo, keeping the warnings from the source', async () => {
    const fetchImpl = (async (url: string) =>
      url.includes('api.github.com')
        ? Response.json({ truncated: true, tree: [{ path: 'AGENTS.md', type: 'blob', size: 5 }] })
        : new Response('Hello')) as typeof fetch;
    const r = await connectProject({ kind: 'github', input: 'acme/shop' }, fetchImpl);
    expect(r.ok && r.project.name).toBe('acme/shop');
    expect(r.ok && r.project.warnings).toEqual(['GitHub listed only part of this repository because it is very large, so some agents or skills may be missing.']);
  });

  it('explains a project with nothing to show, instead of connecting it', async () => {
    const r = await connectProject({ kind: 'folder', files: [file('site/index.html', '<p>hi</p>')] });
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/^No agents or skills were found in site\. AgentsDeck looks for Claude Code, Codex/) });
  });

  it("passes on GitHub's own explanation", async () => {
    const fetchImpl = (async () => new Response('{}', { status: 404 })) as unknown as typeof fetch;
    expect(await connectProject({ kind: 'github', input: 'acme/secret' }, fetchImpl)).toEqual({ ok: false, error: 'acme/secret was not found. AgentsDeck can only read public repositories.' });
  });

  it('explains an empty folder, an empty paste and a broken manifest', async () => {
    expect(await connectProject({ kind: 'folder', files: [] })).toEqual({ ok: false, error: 'That folder is empty.' });
    expect(await connectProject({ kind: 'manifest', text: '  ' })).toEqual({ ok: false, error: 'Paste the contents of an agentsdeck.json file first.' });
    expect(await connectProject({ kind: 'manifest', text: '{ nope' })).toEqual({ ok: false, error: 'agentsdeck.json is not valid JSON' });
  });
});

describe('describeFound', () => {
  it('says what was found and where from, in plain words', () => {
    expect(
      describeFound({ agents: 6, skills: 14, mcpServers: 2, platforms: ['claude-code', 'cursor', 'agent-skills'], duplicates: 0, skippedFixtures: 0 }, PLATFORM_LABELS),
    ).toBe('6 agents · 14 skills · 2 MCP servers from Claude Code, Cursor, SKILL.md');
    expect(describeFound({ agents: 1, skills: 1, mcpServers: 0, platforms: ['manifest'], duplicates: 0, skippedFixtures: 0 }, PLATFORM_LABELS)).toBe(
      '1 agent · 1 skill from agentsdeck.json',
    );
  });
});
