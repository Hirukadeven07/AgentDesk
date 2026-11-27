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

/**
 * Builds a file tree from a source's file list and a function that loads one file.
 * Paths are normalized, skipped folders are dropped, and a file that fails to load reads as null.
 */
export function makeTree(entries: TreeEntry[], load: (path: string) => Promise<string>): FileTree {
  const sizes = new Map<string, number | undefined>();
  for (const e of entries) {
    const path = normalizePath(e.path);
    if (path && keepPath(path)) sizes.set(path, e.size);
  }
  const paths = [...sizes.keys()].sort();
  return {
    paths,
    has: (path) => sizes.has(normalizePath(path)),
    sizeOf: (path) => sizes.get(normalizePath(path)),
    find: (glob) => {
      const re = globToRegExp(glob);
      return paths.filter((p) => re.test(p));
    },
    read: async (path) => {
      const p = normalizePath(path);
      if (!sizes.has(p)) return null;
      const size = sizes.get(p);
      if (size !== undefined && size > MAX_FILE_BYTES) return null;
      try {
        const text = await load(p);
        return byteLength(text) > MAX_FILE_BYTES ? null : text;
      } catch {
        return null;
      }
    },
  };
}

/** A file tree from `{ path: text }`, for tests and for a pasted manifest. */
export function memoryTree(files: Record<string, string>): FileTree {
  const byPath = new Map(Object.entries(files).map(([path, text]) => [normalizePath(path), text]));
  return makeTree([...byPath.keys()].map((path) => ({ path })), async (path) => byPath.get(path) ?? '');
}
