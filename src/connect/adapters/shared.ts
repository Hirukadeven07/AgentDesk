import { parse as parseToml } from 'smol-toml';
import type { Origin, PlatformId } from '../../data/types';
import type { FileTree } from '../fileTree';
export { resolvePath } from '../fileTree';
import { asList, asString, parseFrontmatter, type Frontmatter } from '../frontmatter';
import type { DiscoveredAgent, DiscoveredSkill, Discovery } from '../types';

/**
 * Helpers several adapters share. Platforms copy each other's formats: markdown agents
 * with frontmatter (Claude Code, Cursor, Copilot), markdown commands, and `mcpServers`
 * JSON. Every helper records problems as warnings on the discovery and never throws.
 */

/** A file's name without its folder and without the given extension. */
export const baseName = (path: string, ext = '.md') => {
  const name = path.slice(path.lastIndexOf('/') + 1);
  return name.toLowerCase().endsWith(ext.toLowerCase()) ? name.slice(0, -ext.length) : name;
};

/** The folder a file is in, with a trailing `/`, or '' at the root. */
export const dirOf = (path: string) => path.slice(0, path.lastIndexOf('/') + 1);

/**
 * A short name for each folder ('' or 'a/b/'): its own name, or as much of its path as it takes to
 * tell it apart from another folder with the same name. The project root gets `rootName`.
 * Used to name crews and graphs when a project has several.
 */
export function folderNames(roots: string[], rootName: string): Map<string, string> {
  const parts = new Map(roots.map((r) => [r, r.split('/').filter(Boolean)]));
  const suffix = (p: string[], k: number) => p.slice(-k).join('/');
  const names = new Map<string, string>();
  for (const root of roots) {
    const mine = parts.get(root)!;
    if (!mine.length) {
      names.set(root, rootName);
      continue;
    }
    let n = 1;
    while (n < mine.length && roots.some((other) => other !== root && suffix(parts.get(other)!, n) === suffix(mine, n))) n++;
    names.set(root, suffix(mine, n));
  }
  return names;
}

/** The first non-empty line of a markdown body, without heading marks, at most 200 characters. */
export const firstLine = (body: string) => (body.split('\n').map((l) => l.replace(/^#+\s*/, '').trim()).find(Boolean) ?? '').slice(0, 200);

/** A file's text, or null with a warning when it is missing or too large. */
export async function readText(tree: FileTree, path: string, out: Discovery): Promise<string | null> {
  const text = await tree.read(path);
  if (text === null) out.warnings.push(`${path} could not be read (missing or over 256 KB)`);
  return text;
}

/** A markdown file split into frontmatter and body, with a warning for broken frontmatter. */
export async function readMarkdown(tree: FileTree, path: string, out: Discovery): Promise<Frontmatter | null> {
  const text = await readText(tree, path, out);
  if (text === null) return null;
  const fm = parseFrontmatter(text);
  if (fm.error) out.warnings.push(`${path} has invalid frontmatter: ${fm.error.split('\n')[0]}`);
  return fm;
}

/**
 * A rules file whose frontmatter may not be strict YAML. Cursor and Windsurf read frontmatter as
 * plain `key: value` lines, so they accept `globs: *.ts,*.tsx`, which YAML rejects (`*` starts an
 * alias). Try YAML first, then read the lines the way those tools do. Only warns when neither works.
 */
export async function readLenientMarkdown(tree: FileTree, path: string, out: Discovery): Promise<{ data: Table; body: string } | null> {
  const text = await readText(tree, path, out);
  if (text === null) return null;
  const fm = parseFrontmatter(text);
  if (!fm.error) return { data: fm.data, body: fm.body };
  const data: Table = {};
  for (const line of (fm.raw ?? '').split('\n')) {
    const m = /^([A-Za-z_][\w-]*):[ \t]*(.*)$/.exec(line);
    if (m) data[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  if (!Object.keys(data).length) out.warnings.push(`${path} has invalid frontmatter: ${fm.error.split('\n')[0]}`);
  return { data, body: fm.body };
}

/** A JSON object from a file, or undefined. Only invalid JSON is warned about; a file that can't be read is skipped quietly. */
export async function readJson(tree: FileTree, path: string, out: Discovery): Promise<Record<string, unknown> | undefined> {
  const text = await tree.read(path);
  if (text === null) return undefined;
  try {
    const v: unknown = JSON.parse(text);
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    /* reported below */
  }
  out.warnings.push(`${path} is not valid JSON`);
  return undefined;
}

/** A parsed TOML or JSON table. */
export type Table = Record<string, unknown>;
export const isTable = (v: unknown): v is Table => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A TOML file as a table, or undefined with a warning when it can't be read or isn't valid TOML. */
export async function readToml(tree: FileTree, path: string, out: Discovery): Promise<Table | undefined> {
  const src = await readText(tree, path, out);
  if (src === null) return undefined;
  try {
    return parseToml(src) as Table;
  } catch (e) {
    out.warnings.push(`${path} is not valid TOML: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`);
    return undefined;
  }
}

/** The server names in an `mcpServers` object. */
export const serverNames = (servers: unknown) =>
  typeof servers === 'object' && servers !== null && !Array.isArray(servers) ? Object.keys(servers) : [];

/** Adds the servers in a JSON file's `mcpServers`, with names prefixed (for plugins). */
export async function addMcpJson(tree: FileTree, path: string, platform: PlatformId, prefix: string, out: Discovery) {
  const json = await readJson(tree, path, out);
  for (const name of serverNames(json?.mcpServers)) out.mcpServers.push({ name: prefix + name, origin: { platform, path } });
}

/**
 * A markdown agent: frontmatter `name` (else the file name), `description`, `tools`, `model`
 * and `skills`, with the body as its instructions. Claude Code, Cursor and others use this shape.
 */
export async function markdownAgent(
  tree: FileTree,
  path: string,
  platform: PlatformId,
  prefix: string,
  out: Discovery,
  /** The name when the frontmatter has none, for files like `x.agent.md`. */
  fallbackName = baseName(path),
): Promise<DiscoveredAgent | null> {
  const fm = await readMarkdown(tree, path, out);
  if (!fm) return null;
  const name = asString(fm.data, 'name') ?? fallbackName;
  const description = asString(fm.data, 'description');
  if (!description) out.warnings.push(`${path} has no description`);
  const model = asString(fm.data, 'model');
  const origin: Origin = { platform, path };
  return {
    id: prefix + name,
    name,
    kind: 'custom',
    ...(description ? { description } : {}),
    instructions: fm.body,
    ...(model ? { model } : {}),
    tools: asList(fm.data, 'tools'),
    skills: asList(fm.data, 'skills'),
    origin,
  };
}

/** A markdown command such as `/ship`, as a skill. With no `description`, the body's first line is used. */
export async function markdownCommand(tree: FileTree, path: string, platform: PlatformId, prefix: string, out: Discovery): Promise<DiscoveredSkill | null> {
  const fm = await readMarkdown(tree, path, out);
  if (!fm) return null;
  return {
    id: prefix + baseName(path),
    description: asString(fm.data, 'description') ?? firstLine(fm.body),
    instructions: fm.body,
    files: [],
    origin: { platform, path },
  };
}
