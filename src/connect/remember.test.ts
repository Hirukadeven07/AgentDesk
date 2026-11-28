import { describe, expect, it } from 'vitest';
import type { Connected } from './connect';
import { connectProject } from './connect';
import { addressFor, forgetProject, loadProject, repoFromAddress, saveProject, startWith, type KeyValueStore } from './remember';
import { canonicalRepo, parseGitHubInput } from './sources/github';

const memoryStore = (): KeyValueStore & { map: Map<string, string> } => {
  const map = new Map<string, string>();
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) };
};

const project = async (): Promise<Connected> => {
  const r = await connectProject({ kind: 'manifest', text: '{"version": 1, "agents": [{"id": "bot"}]}' });
  if (!r.ok) throw new Error(r.error);
  return r.project;
};
const fromGitHub = (p: Connected, repo: string): Connected => ({ ...p, name: repo, from: { kind: 'github', repo } });

describe('remembering a project', () => {
  it('saves and loads the whole project, which survives JSON', async () => {
    const store = memoryStore();
    const p = await project();
    expect(saveProject(p, store)).toBe(true);
    expect(loadProject(store)).toEqual(p);
    forgetProject(store);
    expect(loadProject(store)).toBeNull();
  });

  it('ignores something saved by another version, or not a project at all', () => {
    const store = memoryStore();
    store.setItem('agentsdeck:project', JSON.stringify({ v: 99, project: {} }));
    expect(loadProject(store)).toBeNull();
    store.setItem('agentsdeck:project', '{ broken');
    expect(loadProject(store)).toBeNull();
  });

  it('copes when the browser refuses to store anything', async () => {
    const refusing: KeyValueStore = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    };
    expect(saveProject(await project(), refusing)).toBe(false);
    expect(loadProject(refusing)).toBeNull();
    expect(() => forgetProject(refusing)).not.toThrow();
  });
});

describe('sharing a GitHub project as a link', () => {
  it('records the repo, branch and folder in the shortest form that connects them again', () => {
    expect(canonicalRepo(parseGitHubInput('https://github.com/acme/shop.git')!)).toBe('acme/shop');
    expect(canonicalRepo(parseGitHubInput('https://github.com/acme/mono/tree/main/apps/web')!)).toBe('https://github.com/acme/mono/tree/main/apps/web');
    expect(canonicalRepo(parseGitHubInput('github.com/acme/shop/tree/dev')!)).toBe('https://github.com/acme/shop/tree/dev');
  });

  it('puts a GitHub project in the address, keeps the layer, and takes it out again', async () => {
    const p = fromGitHub(await project(), 'acme/shop');
    const shared = addressFor('https://agentsdeck.vercel.app/#roster', p);
    expect(shared).toBe('https://agentsdeck.vercel.app/?repo=acme/shop#roster');
    expect(repoFromAddress(shared)).toBe('acme/shop');
    expect(addressFor(shared, null)).toBe('https://agentsdeck.vercel.app/#roster');
    // a folder or pasted manifest has no link
    expect(addressFor(shared, await project())).toBe('https://agentsdeck.vercel.app/#roster');
  });

  it('keeps a full link with a branch and folder readable and working', async () => {
    const repo = 'https://github.com/acme/mono/tree/main/apps/web';
    const shared = addressFor('https://agentsdeck.vercel.app/', fromGitHub(await project(), repo));
    expect(shared).toBe(`https://agentsdeck.vercel.app/?repo=${repo}`);
    expect(repoFromAddress(shared)).toBe(repo);
  });
});

describe('startWith', () => {
  it('shows the saved project when there is no link, or the link is for it', async () => {
    const saved = fromGitHub(await project(), 'acme/shop');
    expect(startWith('https://x.app/', saved)).toEqual({ show: saved, connect: null });
    expect(startWith('https://x.app/?repo=acme/shop', saved)).toEqual({ show: saved, connect: null });
    expect(startWith('https://x.app/', null)).toEqual({ show: null, connect: null });
  });

  it('connects the repo in a link this browser has not saved', async () => {
    const saved = fromGitHub(await project(), 'acme/shop');
    expect(startWith('https://x.app/?repo=other/repo#skills', saved)).toEqual({ show: null, connect: 'other/repo' });
    expect(startWith('https://x.app/?repo=other/repo', null)).toEqual({ show: null, connect: 'other/repo' });
  });
});
