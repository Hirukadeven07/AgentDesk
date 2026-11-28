import type { Connected } from './connect';

/**
 * Remembering a connected project in this browser, and sharing a GitHub one as a link.
 * - the whole project is kept in localStorage, so a reload shows it at once without asking
 *   GitHub again (and a folder, which can't be read again after a reload, still comes back)
 * - a GitHub project is also put in the address as `?repo=owner/repo`, so the link can be shared;
 *   opening it connects the repo again, unless this browser already has that exact project
 * Nothing leaves the browser except the requests to GitHub that connecting makes anyway.
 */

const KEY = 'agentsdeck:project';
const VERSION = 1;
const PARAM = 'repo';

/** The parts of the Web Storage API this needs, so tests can pass a stand-in. */
export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Saves the project. False when the browser refuses, such as when storage is full or turned off. */
export function saveProject(project: Connected, store: KeyValueStore): boolean {
  try {
    store.setItem(KEY, JSON.stringify({ v: VERSION, project }));
    return true;
  } catch {
    return false;
  }
}

/** The saved project, or null when there is none or it was saved by a different version of the app. */
export function loadProject(store: KeyValueStore): Connected | null {
  try {
    const raw = store.getItem(KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { v?: number; project?: Connected };
    const p = saved.project;
    if (saved.v !== VERSION || !p || typeof p.name !== 'string' || !p.data || !Array.isArray(p.data.tiers) || !p.from) return null;
    return p;
  } catch {
    return null;
  }
}

export function forgetProject(store: KeyValueStore) {
  try {
    store.removeItem(KEY);
  } catch {
    /* storage turned off: nothing was saved */
  }
}

/** The repo a page address asks for, from `?repo=…`, or null. */
export function repoFromAddress(href: string): string | null {
  return new URL(href).searchParams.get(PARAM)?.trim() || null;
}

/** The page address for a project: `?repo=…` for a GitHub one, none for anything else. The layer in `#…` is kept. */
export function addressFor(href: string, project: Connected | null): string {
  const url = new URL(href);
  if (project?.from.kind === 'github') url.searchParams.set(PARAM, project.from.repo);
  else url.searchParams.delete(PARAM);
  // keep the slashes in owner/repo readable
  return url.toString().replace(/%2F/gi, '/').replace(/%3A/gi, ':');
}

/**
 * What to show when the page opens:
 * - a `?repo=` link for the project this browser saved → that project, at once
 * - any other `?repo=` link → connect that repo
 * - no link → the saved project, or the demo team
 */
export function startWith(href: string, saved: Connected | null): { show: Connected | null; connect: string | null } {
  const repo = repoFromAddress(href);
  if (!repo) return { show: saved, connect: null };
  if (saved?.from.kind === 'github' && saved.from.repo === repo) return { show: saved, connect: null };
  return { show: null, connect: repo };
}
