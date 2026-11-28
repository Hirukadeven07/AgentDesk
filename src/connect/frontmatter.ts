import { parse } from 'yaml';

export interface Frontmatter {
  /** The YAML mapping between the opening and closing `---`, or `{}` when there is none. */
  data: Record<string, unknown>;
  /** Everything after the frontmatter, with `\n` line endings. */
  body: string;
  /** The text between the `---` lines, when there are any. For formats that are not quite YAML. */
  raw?: string;
  /** Set when the frontmatter is not valid YAML. `data` is then `{}`. */
  error?: string;
}

/**
 * Splits a markdown file such as `SKILL.md` or `.claude/agents/x.md` into its
 * YAML frontmatter and its body. Never throws: broken YAML is reported in `error`.
 */
export function parseFrontmatter(text: string): Frontmatter {
  const src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const m = /^---[ \t]*\n([\s\S]*?\n)?---[ \t]*(?:\n|$)/.exec(src);
  if (!m) return { data: {}, body: src };
  const body = src.slice(m[0].length).replace(/^\n+/, '');
  const raw = m[1] ?? '';
  try {
    // the core schema only builds plain data (no custom tags), and yaml caps alias expansion
    const data: unknown = parse(m[1] ?? '', { schema: 'core' });
    return { data: isMapping(data) ? data : {}, body, raw };
  } catch (e) {
    return { data: {}, body, raw, error: e instanceof Error ? e.message : String(e) };
  }
}

const isMapping = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A frontmatter value as trimmed text. Numbers and booleans become text; anything else is undefined. */
export function asString(data: Record<string, unknown>, key: string): string | undefined {
  const v = data[key];
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v !== 'string') return undefined;
  return v.trim() || undefined;
}

/** A frontmatter value as a list of names. Takes a YAML list or a comma-separated string such as `Read, Grep`. */
export function asList(data: Record<string, unknown>, key: string): string[] {
  const v = data[key];
  const items = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : [];
  return items.flatMap((x) => (typeof x === 'string' || typeof x === 'number' ? [String(x).trim()] : [])).filter(Boolean);
}
