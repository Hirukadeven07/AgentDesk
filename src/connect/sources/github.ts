import { makeTree, normalizePath } from '../fileTree';
import type { SourcedTree } from './local';

/**
 * A public GitHub repository as a source (docs/adr/0001). Listing the repo takes one call to
 * GitHub's API (60 an hour without signing in); file contents come from raw.githubusercontent.com,
 * which has no such limit, and only for the files an adapter asks for. Nothing but the repo's
 * name and the files read is sent to GitHub.
 */

export interface GitHubRepo {
  owner: string;
  repo: string;
  /** A branch, tag or commit; `HEAD` is the default branch. */
  ref: string;
  /** A folder inside the repo, as 'a/b/', or '' for the whole repo. */
  dir: string;
}

/** A message meant for the person connecting the repo. */
export class GitHubError extends Error {}

const NAME = /^[A-Za-z0-9_.-]+$/;

/**
 * Reads `owner/repo`, `https://github.com/owner/repo`, `…/repo.git`, `git@github.com:owner/repo.git`
 * and links to a branch or folder (`…/tree/<branch>/<folder>`). The branch is the first part after
 * `tree/`, so a branch name with a slash in it is read as a folder.
 */
export function parseGitHubInput(input: string): GitHubRepo | null {
  const text = input.trim().replace(/^git@github\.com:/, 'github.com/');
  const m = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/([^/?#]+?)(?:\.git)?(?:\/tree\/([^/?#]+)(\/[^?#]*)?)?\/?(?:[?#].*)?$/.exec(text);
  const short = /^([^/\s]+)\/([^/\s]+)$/.exec(text);
  const [owner, repo, ref, dir] = m ? [m[1], m[2], m[3], m[4]] : short && !text.includes(':') ? [short[1], short[2].replace(/\.git$/, ''), undefined, undefined] : [];
  if (!owner || !repo || !NAME.test(owner) || !NAME.test(repo)) return null;
  const folder = normalizePath(dir ?? '');
  return { owner, repo, ref: ref ?? 'HEAD', dir: folder ? folder + '/' : '' };
}

/** The shortest text that connects the same repo, branch and folder again: `owner/repo`, or a full link. */
export function canonicalRepo(where: GitHubRepo): string {
  const { owner, repo, ref, dir } = where;
  if (ref === 'HEAD' && !dir) return `${owner}/${repo}`;
  return `https://github.com/${owner}/${repo}/tree/${ref}${dir ? '/' + dir.slice(0, -1) : ''}`;
}

interface TreeResponse {
  truncated?: boolean;
  tree?: { path: string; type: string; size?: number; mode?: string }[];
}

/** Git's mode for a symbolic link. GitHub serves a link's content as the path it points at. */
const SYMLINK = '120000';
/** Following a link costs a request, so a repo with very many links only has the first ones followed. */
const MAX_LINKS = 100;

/** Where a link at `linkPath` pointing at `target` leads, or null if it leaves the repository. */
function linkTarget(linkPath: string, target: string): string | null {
  if (target.startsWith('/')) return null;
  const out = linkPath.split('/').slice(0, -1);
  for (const part of target.replace(/\\/g, '/').split('/')) {
    if (part === '..') {
      if (!out.length) return null;
      out.pop();
    } else if (part && part !== '.') out.push(part);
  }
  return out.join('/');
}

export async function fromGitHub(input: string, fetchImpl: typeof fetch = fetch): Promise<SourcedTree & { warnings: string[] }> {
  const where = parseGitHubInput(input);
  if (!where) throw new GitHubError('That is not a GitHub repository. Paste a link like https://github.com/owner/repo, or owner/repo.');
  const { owner, repo, ref, dir } = where;
  const slug = `${owner}/${repo}`;

  const res = await request(fetchImpl, `https://api.github.com/repos/${slug}/git/trees/${encodeURIComponent(ref)}?recursive=1`);
  if (res.status === 404 || res.status === 409) throw new GitHubError(`${slug} was not found. AgentsDeck can only read public repositories.`);
  if ((res.status === 403 || res.status === 429) && res.headers.get('x-ratelimit-remaining') === '0') {
    const reset = Number(res.headers.get('x-ratelimit-reset'));
    const at = reset ? ` after ${new Date(reset * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}` : ' in an hour';
    throw new GitHubError(`GitHub's limit of 60 repository reads an hour has been reached. Try again${at}.`);
  }
  if (!res.ok) throw new GitHubError(`GitHub answered ${res.status} for ${slug}. Try again in a moment.`);
  const body = (await res.json()) as TreeResponse;

  const rawBase = `https://raw.githubusercontent.com/${slug}/${encodeURIComponent(ref)}/`;
  const rawUrl = (path: string) => rawBase + path.split('/').map(encodeURIComponent).join('/');

  // real files, and symlinks to follow: a linked file reads its target, and a linked folder shows
  // the target folder's files under the link, as tools reading the repo on disk see them
  const all = body.tree ?? [];
  const sizes = new Map(all.filter((e) => e.type === 'blob' && e.mode !== SYMLINK).map((e) => [e.path, e.size]));
  const links = all.filter((e) => e.mode === SYMLINK && e.path.startsWith(dir)).slice(0, MAX_LINKS);
  const targets = await Promise.all(
    links.map(async (l) => {
      try {
        const res = await fetchImpl(rawUrl(l.path));
        return res.ok ? linkTarget(l.path, (await res.text()).trim()) : null;
      } catch {
        return null;
      }
    }),
  );
  /** A path as listed → the real file to read for it. Real files map to themselves. */
  const realPath = new Map<string, string>([...sizes.keys()].map((p) => [p, p]));
  links.forEach((l, i) => {
    const target = targets[i];
    if (target === null) return;
    if (sizes.has(target)) realPath.set(l.path, target);
    else for (const p of sizes.keys()) if (p.startsWith(target + '/')) realPath.set(l.path + p.slice(target.length), p);
  });

  const entries = [...realPath]
    .filter(([shown]) => shown.startsWith(dir))
    .map(([shown, real]) => ({ path: shown.slice(dir.length), size: sizes.get(real) }));
  // every file is its own request, so files are fetched ahead as soon as an adapter finds them
  const tree = makeTree(
    entries,
    async (path) => {
      const file = await request(fetchImpl, rawUrl(realPath.get(dir + path) ?? dir + path));
      if (!file.ok) throw new Error(`${file.status}`);
      return file.text();
    },
    {
      prefetch: true,
      // a path reached through a link → its real file, inside the connected folder
      realPaths: new Map(
        [...realPath]
          .filter(([shown, real]) => shown !== real && shown.startsWith(dir) && real.startsWith(dir))
          .map(([shown, real]) => [shown.slice(dir.length), real.slice(dir.length)]),
      ),
    },
  );
  const warnings = body.truncated ? ['GitHub listed only part of this repository because it is very large, so some agents or skills may be missing.'] : [];
  return { name: dir ? `${slug}/${dir.slice(0, -1)}` : slug, tree, warnings };
}

/** fetch, with a network failure turned into a message for the user. */
async function request(fetchImpl: typeof fetch, url: string) {
  try {
    return await fetchImpl(url);
  } catch {
    throw new GitHubError('Could not reach GitHub. Check your connection and try again.');
  }
}
