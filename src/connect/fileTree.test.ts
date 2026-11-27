import { describe, expect, it } from 'vitest';
import { globToRegExp, keepPath, memoryTree, normalizePath } from './fileTree';

describe('normalizePath', () => {
  it('uses forward slashes and no leading ./ or /', () => {
    expect(normalizePath('.\\.claude\\agents\\a.md')).toBe('.claude/agents/a.md');
    expect(normalizePath('/AGENTS.md')).toBe('AGENTS.md');
    expect(normalizePath('./docs//x.md')).toBe('docs/x.md');
  });
});

describe('keepPath', () => {
  it('keeps agent and skill files', () => {
    expect(keepPath('.claude/agents/reviewer.md')).toBe(true);
    expect(keepPath('packages/api/AGENTS.md')).toBe(true);
  });

  it('skips dependency, build and VCS folders at any depth', () => {
    expect(keepPath('node_modules/x/SKILL.md')).toBe(false);
    expect(keepPath('apps/web/node_modules/x/AGENTS.md')).toBe(false);
    expect(keepPath('.git/HEAD')).toBe(false);
    expect(keepPath('dist/index.js')).toBe(false);
    expect(keepPath('py/.venv/lib/x.py')).toBe(false);
  });

  it('does not skip a file just because its name looks like a skipped folder', () => {
    expect(keepPath('docs/dist.md')).toBe(true);
  });
});

describe('globToRegExp', () => {
  const m = (glob: string, path: string) => globToRegExp(glob).test(path);

  it('matches one folder level with *', () => {
    expect(m('.claude/agents/*.md', '.claude/agents/reviewer.md')).toBe(true);
    expect(m('.claude/agents/*.md', '.claude/agents/team/reviewer.md')).toBe(false);
  });

  it('matches any depth, including none, with **/', () => {
    expect(m('**/AGENTS.md', 'AGENTS.md')).toBe(true);
    expect(m('**/AGENTS.md', 'packages/api/AGENTS.md')).toBe(true);
    expect(m('**/AGENTS.md', 'packages/api/NOT_AGENTS.md')).toBe(false);
    expect(m('**/skills/*/SKILL.md', '.claude/skills/pr/SKILL.md')).toBe(true);
  });

  it('treats dots and other regex characters literally', () => {
    expect(m('.mcp.json', '.mcp.json')).toBe(true);
    expect(m('.mcp.json', 'xmcpxjson')).toBe(false);
    expect(m('a+b.md', 'a+b.md')).toBe(true);
  });
});

describe('memoryTree', () => {
  const tree = memoryTree({
    '.claude\\agents\\reviewer.md': 'hello',
    'node_modules/pkg/SKILL.md': 'ignored',
    'AGENTS.md': 'root',
    'packages/api/AGENTS.md': 'nested',
  });

  it('lists kept files, sorted, with normalized paths', () => {
    expect(tree.paths).toEqual(['.claude/agents/reviewer.md', 'AGENTS.md', 'packages/api/AGENTS.md']);
  });

  it('finds files by glob', () => {
    expect(tree.find('**/AGENTS.md')).toEqual(['AGENTS.md', 'packages/api/AGENTS.md']);
    expect(tree.find('.cursor/rules/*.mdc')).toEqual([]);
  });

  it('reads a file, and gives null for one it does not have', async () => {
    expect(await tree.read('.claude/agents/reviewer.md')).toBe('hello');
    expect(await tree.read('node_modules/pkg/SKILL.md')).toBeNull();
    expect(await tree.read('missing.md')).toBeNull();
  });

  it('says whether it has a file', () => {
    expect(tree.has('AGENTS.md')).toBe(true);
    expect(tree.has('GEMINI.md')).toBe(false);
  });

  it('refuses to read a file that is too large', async () => {
    const big = memoryTree({ 'AGENTS.md': 'x'.repeat(300 * 1024) });
    expect(await big.read('AGENTS.md')).toBeNull();
  });
});
