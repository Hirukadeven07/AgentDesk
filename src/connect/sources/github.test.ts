import { describe, expect, it } from 'vitest';
import { scan } from '../scan';
import { fromGitHub, GitHubError, parseGitHubInput } from './github';

describe('parseGitHubInput', () => {
  it('reads owner/repo, full links, .git links and links to a branch or folder', () => {
    expect(parseGitHubInput('anthropics/claude-code')).toEqual({ owner: 'anthropics', repo: 'claude-code', ref: 'HEAD', dir: '' });
    expect(parseGitHubInput(' https://github.com/openai/codex ')).toEqual({ owner: 'openai', repo: 'codex', ref: 'HEAD', dir: '' });
    expect(parseGitHubInput('github.com/openai/codex.git')).toEqual({ owner: 'openai', repo: 'codex', ref: 'HEAD', dir: '' });
    expect(parseGitHubInput('https://github.com/a/b/tree/dev')).toEqual({ owner: 'a', repo: 'b', ref: 'dev', dir: '' });
    expect(parseGitHubInput('https://github.com/a/b/tree/main/apps/web/')).toEqual({ owner: 'a', repo: 'b', ref: 'main', dir: 'apps/web/' });
    expect(parseGitHubInput('git@github.com:a/b.git')).toEqual({ owner: 'a', repo: 'b', ref: 'HEAD', dir: '' });
  });

  it('rejects anything that is not a GitHub repo', () => {
    for (const bad of ['', 'claude-code', 'https://gitlab.com/a/b', 'a/b/c', 'a b/c']) expect(parseGitHubInput(bad)).toBeNull();
  });
});

type Call = { url: string };

/** A fake fetch for GitHub: the tree API answer, and raw files by path. */
function fakeGitHub(tree: { path: string; type?: string; size?: number; mode?: string }[], files: Record<string, string>, opts: { status?: number; headers?: Record<string, string>; truncated?: boolean } = {}) {
  const calls: Call[] = [];
  const fetchImpl = async (url: string) => {
    calls.push({ url });
    if (url.startsWith('https://api.github.com/')) {
      if (opts.status) return new Response('{"message":"x"}', { status: opts.status, headers: opts.headers });
      return Response.json({ sha: 'abc', truncated: !!opts.truncated, tree: tree.map((t) => ({ type: 'blob', size: 10, ...t })) });
    }
    const path = decodeURIComponent(url.replace(/^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\//, ''));
    return path in files ? new Response(files[path]) : new Response('404', { status: 404 });
  };
  return { fetchImpl: fetchImpl as typeof fetch, calls };
}

describe('fromGitHub', () => {
  it('lists the repo with one API call and reads only the files adapters ask for', async () => {
    const { fetchImpl, calls } = fakeGitHub(
      [{ path: 'CLAUDE.md' }, { path: 'src', type: 'tree' }, { path: 'src/index.ts' }, { path: '.claude/skills/pr/SKILL.md' }, { path: 'node_modules/x/SKILL.md' }],
      { 'CLAUDE.md': 'Use pnpm.', '.claude/skills/pr/SKILL.md': '---\nname: pr\ndescription: PR bodies.\n---\nBody' },
    );
    const { name, tree, warnings } = await fromGitHub('acme/shop', fetchImpl);
    expect(name).toBe('acme/shop');
    expect(warnings).toEqual([]);
    expect(tree.paths).toEqual(['.claude/skills/pr/SKILL.md', 'CLAUDE.md', 'src/index.ts']);
    const { summary } = await scan(tree);
    expect(summary).toMatchObject({ agents: 1, skills: 1 });
    // files are fetched ahead as adapters find them, so the order varies; which ones never does
    expect(calls[0].url).toBe('https://api.github.com/repos/acme/shop/git/trees/HEAD?recursive=1');
    expect(calls.slice(1).map((c) => c.url).sort()).toEqual([
      'https://raw.githubusercontent.com/acme/shop/HEAD/.claude/skills/pr/SKILL.md',
      'https://raw.githubusercontent.com/acme/shop/HEAD/CLAUDE.md',
    ]);
  });

  it('connects only the folder a link points at', async () => {
    const { fetchImpl, calls } = fakeGitHub([{ path: 'apps/web/AGENTS.md' }, { path: 'apps/api/AGENTS.md' }], { 'apps/web/AGENTS.md': 'Web rules.' });
    const { name, tree } = await fromGitHub('https://github.com/acme/mono/tree/main/apps/web', fetchImpl);
    expect(name).toBe('acme/mono/apps/web');
    expect(tree.paths).toEqual(['AGENTS.md']);
    expect(await tree.read('AGENTS.md')).toBe('Web rules.');
    expect(calls.at(-1)!.url).toBe('https://raw.githubusercontent.com/acme/mono/main/apps/web/AGENTS.md');
  });

  it('never fetches a file GitHub says is over the size limit', async () => {
    const { fetchImpl, calls } = fakeGitHub([{ path: 'AGENTS.md', size: 300 * 1024 }], { 'AGENTS.md': 'big' });
    const { tree } = await fromGitHub('a/b', fetchImpl);
    expect(await tree.read('AGENTS.md')).toBeNull();
    expect(calls).toHaveLength(1);
  });

  it('warns when GitHub only listed part of a very large repo', async () => {
    const { fetchImpl } = fakeGitHub([{ path: 'a.md' }], {}, { truncated: true });
    expect((await fromGitHub('a/b', fetchImpl)).warnings).toEqual(['GitHub listed only part of this repository because it is very large, so some agents or skills may be missing.']);
  });

  it('explains a private or missing repo, the rate limit, and a bad link', async () => {
    await expect(fromGitHub('a/b', fakeGitHub([], {}, { status: 404 }).fetchImpl)).rejects.toThrow(
      new GitHubError('a/b was not found. AgentsDeck can only read public repositories.'),
    );
    const reset = String(Math.floor(Date.UTC(2026, 10, 28, 15, 30) / 1000));
    await expect(fromGitHub('a/b', fakeGitHub([], {}, { status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': reset } }).fetchImpl)).rejects.toThrow(
      /GitHub's limit of 60 repository reads an hour has been reached\. Try again after \d\d:\d\d/,
    );
    await expect(fromGitHub('not a repo', fakeGitHub([], {}).fetchImpl)).rejects.toThrow(
      new GitHubError('That is not a GitHub repository. Paste a link like https://github.com/owner/repo, or owner/repo.'),
    );
  });

  it('explains a network failure', async () => {
    const offline = (async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;
    await expect(fromGitHub('a/b', offline)).rejects.toThrow(new GitHubError('Could not reach GitHub. Check your connection and try again.'));
  });
});

describe('fromGitHub symlinks', () => {
  /** The layout of cline/cline: commands and skills linked from .claude into .clinerules and .cline. */
  const linked = () => {
    const files: Record<string, string> = {
      '.clinerules/workflows/release.md': 'Cut a release.\n',
      '.cline/skills/tuistory/SKILL.md': '---\nname: tuistory\ndescription: Terminal UI stories.\n---\nBody\n',
      '.cline/skills/tuistory/scripts/run.sh': 'echo',
      // what GitHub serves for a symlink: the path it points at
      '.claude/commands/release.md': '../../.clinerules/workflows/release.md',
      '.claude/skills/tuistory': '../../.cline/skills/tuistory',
      '.claude/commands/broken.md': '../../nowhere.md',
      '.claude/escape.md': '../../../outside/repo.md',
    };
    const tree = [
      { path: '.clinerules/workflows/release.md', size: 15 },
      { path: '.cline/skills/tuistory/SKILL.md', size: 70 },
      { path: '.cline/skills/tuistory/scripts/run.sh', size: 4 },
      { path: '.claude/commands/release.md', mode: '120000' },
      { path: '.claude/skills/tuistory', mode: '120000' },
      { path: '.claude/commands/broken.md', mode: '120000' },
      { path: '.claude/escape.md', mode: '120000' },
    ];
    return fakeGitHub(tree, files);
  };

  it('reads a linked file as the file it points at', async () => {
    const { tree } = await fromGitHub('cline/cline', linked().fetchImpl);
    expect(await tree.read('.claude/commands/release.md')).toBe('Cut a release.\n');
  });

  it('shows the files of a linked folder under the link, as Claude Code sees them', async () => {
    const { tree } = await fromGitHub('cline/cline', linked().fetchImpl);
    expect(tree.has('.claude/skills/tuistory/SKILL.md')).toBe(true);
    expect(tree.has('.claude/skills/tuistory/scripts/run.sh')).toBe(true);
    expect(await tree.read('.claude/skills/tuistory/SKILL.md')).toContain('name: tuistory');
  });

  it('drops a link to nothing or out of the repo', async () => {
    const { tree } = await fromGitHub('cline/cline', linked().fetchImpl);
    expect(tree.has('.claude/commands/broken.md')).toBe(false);
    expect(tree.has('.claude/escape.md')).toBe(false);
    expect(tree.paths.some((p) => p.includes('outside'))).toBe(false);
  });

  it('connects the linked command and skill once each, with their real text', async () => {
    const { tree } = await fromGitHub('cline/cline', linked().fetchImpl);
    const { data, summary } = await scan(tree);
    expect(data.skills.release.desc).toBe('Cut a release.');
    // the skill is found under .cline/skills and through the .claude/skills link: one rack
    expect(Object.keys(data.skills).filter((id) => id.startsWith('tuistory'))).toEqual(['tuistory']);
    // and the release command is also Cline's release workflow, the same text: one rack each
    expect(Object.keys(data.skills).filter((id) => id.startsWith('release'))).toEqual(['release']);
    expect(summary.duplicates).toBe(2);
  });
});
