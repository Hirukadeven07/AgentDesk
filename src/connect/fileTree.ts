/**
 * A file tree is the read-only view of a project that a source hands to the
 * adapters (see docs/adr/0001). Paths are relative to the project root and use
 * `/`. Reading is lazy, so a source only fetches the files an adapter asks for.
 */
export interface FileTree {
  /** Every kept file, sorted. */
  readonly paths: readonly string[];
  has(path: string): boolean;
  /** Size in bytes, when the source knew it without reading the file. */
  sizeOf(path: string): number | undefined;
  /** The file a path really is when it is reached through a symlink, else the path itself. */
  realPath(path: string): string;
  /** The kept files that match a glob (see globToRegExp), sorted. */
  find(glob: string): string[];
  /** The file's text, or null if the tree doesn't have it or it is larger than MAX_FILE_BYTES. */
  read(path: string): Promise<string | null>;
}

/** Agent and skill files are small. Anything bigger is skipped rather than read. */
export const MAX_FILE_BYTES = 256 * 1024;

/** Folders that never hold a project's own agents or skills, skipped at any depth. */
const SKIPPED_DIRS = new Set([
  '.git',
  'node_modules',
  'bower_components',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.svelte-kit',
  '.turbo',
  '.cache',
  'coverage',
  'target',
  'vendor',
  '.venv',
  'venv',
  '__pycache__',
  '.tox',
  '.gradle',
]);

/** `.\a\b.md`, `/a/b.md` and `a//b.md` all become `a/b.md`. */
export const normalizePath = (path: string) =>
  path
    .replace(/\\/g, '/')
    .split('/')
    .filter((part) => part !== '' && part !== '.')
    .join('/');

/** Resolves `agents/x.toml`, `./a.py` or `../x.toml` against a folder such as `.codex/` ('' for the root). */
export function resolvePath(dir: string, rel: string) {
  const out: string[] = [];
  for (const part of (dir + rel).replace(/\\/g, '/').split('/')) {
    if (part === '..') out.pop();
    else if (part && part !== '.') out.push(part);
  }
  return out.join('/');
}

/** False for a file inside a skipped folder such as `node_modules` or `.git`. */
export const keepPath = (path: string) => {
  const parts = normalizePath(path).split('/');
  return parts.length > 0 && !parts.slice(0, -1).some((dir) => SKIPPED_DIRS.has(dir));
};

/** `*` matches within one folder, `**` + `/` matches any number of folders (including none). */
export function globToRegExp(glob: string): RegExp {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*' && glob[i + 2] === '/') {
      re += '(?:.*/)?';
      i += 2;
    } else if (c === '*' && glob[i + 1] === '*') {
      re += '.*';
      i += 1;
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

export interface TreeEntry {
  path: string;
  /** Size in bytes when the source knows it before reading, so big files are never fetched. */
  size?: number;
}

const byteLength = (text: string) => new TextEncoder().encode(text).length;

/** Files worth reading ahead: the formats agent, skill and rule files are written in. Code is left alone. */
const AHEAD = /\.(md|mdc|txt|json|jsonc|toml|ya?ml|xml)$|(^|\/)\.(roomodes|[a-z]+rules(-[\w-]+)?)$/i;

/**
 * Loads each file once, at most 8 at a time. A file someone is waiting for (`urgent`) goes ahead of
 * files only being fetched ahead, and a file already queued ahead moves up when someone asks for it.
 */
function loader(load: (path: string) => Promise<string>, max = 8) {
  const results = new Map<string, Promise<string | null>>();
  const notStarted = new Map<string, () => void>();
  const waiting: string[] = [];
  const ahead: string[] = [];
  let running = 0;
  const pump = () => {
    while (running < max) {
      const p = waiting.shift() ?? ahead.shift();
      if (p === undefined) return;
      const start = notStarted.get(p);
      // already started from the other queue
      if (!start) continue;
      notStarted.delete(p);
      running++;
      start();
    }
  };
  return (p: string, urgent: boolean): Promise<string | null> => {
    let result = results.get(p);
    if (!result) {
      result = new Promise((resolve) => {
        notStarted.set(p, () =>
          load(p)
            .then((t) => resolve(byteLength(t) > MAX_FILE_BYTES ? null : t), () => resolve(null))
            .finally(() => {
              running--;
              pump();
            }),
        );
      });
      results.set(p, result);
      (urgent ? waiting : ahead).push(p);
    } else if (urgent && notStarted.has(p)) {
      waiting.push(p);
    }
    pump();
    return result;
  };
}

export interface TreeOptions {
  /**
   * For slow sources such as GitHub: when an adapter finds files, start loading the text ones
   * straight away, so the reads that usually follow are already done. Adapters still read one at
   * a time, so what they report and in what order does not change.
   */
  prefetch?: boolean;
  /** Paths reached through symlinks → the real files they are, for sources that know. */
  realPaths?: ReadonlyMap<string, string>;
}

/**
 * Builds a file tree from a source's file list and a function that loads one file.
 * Paths are normalized, skipped folders are dropped, and a file that fails to load reads as null.
 * Each file is loaded at most once, and at most 8 load at the same time (see loader).
 */
export function makeTree(entries: TreeEntry[], load: (path: string) => Promise<string>, options: TreeOptions = {}): FileTree {
  const sizes = new Map<string, number | undefined>();
  for (const e of entries) {
    const path = normalizePath(e.path);
    if (path && keepPath(path)) sizes.set(path, e.size);
  }
  const paths = [...sizes.keys()].sort();
  const loadOnce = loader(load);
  const tooBig = (p: string) => (sizes.get(p) ?? 0) > MAX_FILE_BYTES;

  return {
    paths,
    has: (path) => sizes.has(normalizePath(path)),
    sizeOf: (path) => sizes.get(normalizePath(path)),
    realPath: (path) => {
      const p = normalizePath(path);
      return options.realPaths?.get(p) ?? p;
    },
    find: (glob) => {
      const re = globToRegExp(glob);
      const found = paths.filter((p) => re.test(p));
      if (options.prefetch) for (const p of found) if (AHEAD.test(p) && !tooBig(p)) void loadOnce(p, false);
      return found;
    },
    read: async (path) => {
      const p = normalizePath(path);
      if (!sizes.has(p) || tooBig(p)) return null;
      return loadOnce(p, true);
    },
  };
}

/** A file tree from `{ path: text }`, for tests and for a pasted manifest. */
export function memoryTree(files: Record<string, string>): FileTree {
  const byPath = new Map(Object.entries(files).map(([path, text]) => [normalizePath(path), text]));
  return makeTree([...byPath.keys()].map((path) => ({ path })), async (path) => byPath.get(path) ?? '');
}
