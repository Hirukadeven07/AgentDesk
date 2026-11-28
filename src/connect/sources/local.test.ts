import { describe, expect, it } from 'vitest';
import { scan } from '../scan';
import { fromManifestText, fromPickedFiles, type PickedFile } from './local';

/** A file as `<input type="file" webkitdirectory>` gives it: the path starts with the picked folder's name. */
const picked = (webkitRelativePath: string, text: string): PickedFile & { reads: number } => {
  const f = {
    webkitRelativePath,
    size: new TextEncoder().encode(text).length,
    reads: 0,
    text: async () => {
      f.reads++;
      return text;
    },
  };
  return f;
};

describe('fromPickedFiles', () => {
  it('drops the picked folder from every path and names the project after it', async () => {
    const { name, tree } = fromPickedFiles([picked('my-app/CLAUDE.md', 'Hi'), picked('my-app/.claude/agents/r.md', 'R')]);
    expect(name).toBe('my-app');
    expect(tree.paths).toEqual(['.claude/agents/r.md', 'CLAUDE.md']);
    expect(await tree.read('CLAUDE.md')).toBe('Hi');
  });

  it('skips node_modules and .git, and never reads a file it does not need', async () => {
    const dep = picked('app/node_modules/x/SKILL.md', 'no');
    const big = picked('app/AGENTS.md', 'x'.repeat(300 * 1024));
    const { tree } = fromPickedFiles([picked('app/AGENTS.md.bak', ''), dep, picked('app/.git/HEAD', ''), big]);
    expect(tree.paths).toEqual(['AGENTS.md', 'AGENTS.md.bak']);
    // over 256 KB: refused from its size alone, without reading it
    expect(await tree.read('AGENTS.md')).toBeNull();
    expect(big.reads).toBe(0);
    expect(dep.reads).toBe(0);
  });

  it('works with files that have no folder in their path, as from a plain file picker', () => {
    const { name, tree } = fromPickedFiles([picked('', 'x')].map((f) => Object.assign(f, { name: 'agentsdeck.json' })));
    expect(name).toBe('Picked files');
    expect(tree.paths).toEqual(['agentsdeck.json']);
  });

  it('connects a picked project end to end', async () => {
    const { tree } = fromPickedFiles([
      picked('shop/CLAUDE.md', 'Use pnpm.'),
      picked('shop/.claude/skills/pr/SKILL.md', '---\nname: pr\ndescription: Write PR bodies.\n---\nBody'),
    ]);
    const { summary, data } = await scan(tree);
    expect(summary).toMatchObject({ agents: 1, skills: 1, platforms: ['claude-code'] });
    expect(data.offFloorAgents[0].instructions).toBe('Use pnpm.');
  });
});

describe('fromManifestText', () => {
  it('makes a one-file project from pasted manifest text', async () => {
    const { name, tree } = fromManifestText('{"version": 1, "agents": [{"id": "bot", "provider": "Vertex AI"}]}');
    expect(name).toBe('Pasted manifest');
    const { data, warnings } = await scan(tree);
    expect(warnings).toEqual([]);
    expect(data.offFloorAgents.map((a) => [a.id, a.description])).toEqual([['bot', 'Runs on Vertex AI.']]);
  });
});
