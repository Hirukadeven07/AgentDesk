import { describe, expect, it } from 'vitest';
import { globToRegExp, keepPath, makeTree, memoryTree, normalizePath } from './fileTree';

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

describe('makeTree reading', () => {
  /** A slow source that records which files it loaded and how many loads ran at once. */
  const slowSource = (paths: string[]) => {
    const loads: string[] = [];
    let running = 0;
    let most = 0;
    const load = async (p: string) => {
      loads.push(p);
      running++;
      most = Math.max(most, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      return `text of ${p}`;
    };
    return { entries: paths.map((path) => ({ path })), load, loads, most: () => most };
  };

  it('loads each file once, however often it is read', async () => {
    const src = slowSource(['AGENTS.md']);
    const tree = makeTree(src.entries, src.load);
    expect(await Promise.all([tree.read('AGENTS.md'), tree.read('AGENTS.md'), tree.read('./AGENTS.md')])).toEqual(['text of AGENTS.md', 'text of AGENTS.md', 'text of AGENTS.md']);
    expect(src.loads).toEqual(['AGENTS.md']);
  });

  it('with prefetch, starts loading the text files a find returns, at most 8 at a time', async () => {
    const paths = [...Array.from({ length: 20 }, (_, i) => `.roo/rules/${i}.md`), '.roo/rules/logo.png'];
    const src = slowSource(paths);
    const tree = makeTree(src.entries, src.load, { prefetch: true });
    const found = tree.find('.roo/rules/**');
    expect(found).toHaveLength(21);
    // nothing has been read yet, but loading has started
    await new Promise((r) => setTimeout(r, 60));
    expect(src.loads).toHaveLength(20);
    expect(src.loads).not.toContain('.roo/rules/logo.png');
    expect(src.most()).toBeLessThanOrEqual(8);
    // reading now uses what was already loaded
    expect(await tree.read('.roo/rules/3.md')).toBe('text of .roo/rules/3.md');
    expect(src.loads).toHaveLength(20);
  });

  it('without prefetch, a find loads nothing', async () => {
    const src = slowSource(['a.md', 'b.md']);
    const tree = makeTree(src.entries, src.load);
    tree.find('**/*.md');
    await new Promise((r) => setTimeout(r, 20));
    expect(src.loads).toEqual([]);
  });

  it('never prefetches a file over the size limit', async () => {
    const src = slowSource([]);
    const tree = makeTree([{ path: 'AGENTS.md', size: 300 * 1024 }], src.load, { prefetch: true });
    tree.find('**/*.md');
    await new Promise((r) => setTimeout(r, 20));
    expect(src.loads).toEqual([]);
  });
});

describe('makeTree prefetch priority', () => {
  it('reads a file an adapter is waiting for before files only fetched ahead', async () => {
    const order: string[] = [];
    const load = async (p: string) => {
      order.push(p);
      await new Promise((r) => setTimeout(r, 5));
      return p;
    };
    const paths = Array.from({ length: 30 }, (_, i) => `.claude/x${String(i).padStart(2, '0')}.md`);
    const tree = makeTree([...paths.map((path) => ({ path })), { path: 'AGENTS.md' }], load, { prefetch: true });
    tree.find('.claude/**');
    // a broad find queued 30 files ahead; the file actually needed must not wait behind them
    await tree.read('AGENTS.md');
    expect(order.indexOf('AGENTS.md')).toBeLessThan(9);
  });

  it('only fetches ahead the formats agent files are written in, not code', async () => {
    const loads: string[] = [];
    const tree = makeTree(['a.md', 'b.json', 'c.toml', 'd.yaml', 'e.xml', '.clinerules', 'f.ts', 'g.py', 'h.js'].map((path) => ({ path })), async (p) => (loads.push(p), p), {
      prefetch: true,
    });
    tree.find('**');
    await new Promise((r) => setTimeout(r, 20));
    expect(loads.sort()).toEqual(['.clinerules', 'a.md', 'b.json', 'c.toml', 'd.yaml', 'e.xml']);
  });
});
