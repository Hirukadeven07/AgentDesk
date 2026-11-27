import { describe, expect, it } from 'vitest';
import { asList, asString, parseFrontmatter } from './frontmatter';

describe('parseFrontmatter', () => {
  it('splits YAML frontmatter from the markdown body', () => {
    const r = parseFrontmatter('---\nname: reviewer\ndescription: Reviews PRs\ntools: Read, Grep\n---\n\nYou review pull requests.\n');
    expect(r.data).toEqual({ name: 'reviewer', description: 'Reviews PRs', tools: 'Read, Grep' });
    expect(r.body).toBe('You review pull requests.\n');
    expect(r.error).toBeUndefined();
  });

  it('handles Windows line endings and a byte order mark', () => {
    const r = parseFrontmatter('﻿---\r\nname: pr\r\n---\r\nBody\r\n');
    expect(r.data).toEqual({ name: 'pr' });
    expect(r.body).toBe('Body\n');
  });

  it('gives the whole text as the body when there is no frontmatter', () => {
    const r = parseFrontmatter('# AGENTS.md\n\nRun npm test.\n');
    expect(r.data).toEqual({});
    expect(r.body).toBe('# AGENTS.md\n\nRun npm test.\n');
  });

  it('does not treat a --- rule later in the file as frontmatter', () => {
    const r = parseFrontmatter('Intro\n\n---\n\nMore');
    expect(r.data).toEqual({});
    expect(r.body).toBe('Intro\n\n---\n\nMore');
  });

  it('accepts empty frontmatter', () => {
    const r = parseFrontmatter('---\n---\nBody');
    expect(r.data).toEqual({});
    expect(r.body).toBe('Body');
  });

  it('reports broken YAML instead of throwing, and still returns the body', () => {
    const r = parseFrontmatter('---\nname: [unclosed\n---\nBody');
    expect(r.data).toEqual({});
    expect(r.body).toBe('Body');
    expect(r.error).toMatch(/.+/);
  });

  it('ignores frontmatter that is a list or a plain value, not a mapping', () => {
    expect(parseFrontmatter('---\n- a\n- b\n---\nBody').data).toEqual({});
    expect(parseFrontmatter('---\njust text\n---\nBody').data).toEqual({});
  });

  it('keeps an unterminated opening --- as part of the body', () => {
    const r = parseFrontmatter('---\nname: x\nno closing line');
    expect(r.data).toEqual({});
    expect(r.body).toBe('---\nname: x\nno closing line');
  });
});

describe('asString', () => {
  it('returns trimmed text, and turns numbers and booleans into text', () => {
    expect(asString({ a: '  hi  ' }, 'a')).toBe('hi');
    expect(asString({ v: 1.2 }, 'v')).toBe('1.2');
    expect(asString({ b: true }, 'b')).toBe('true');
  });

  it('returns undefined for missing, empty or non-text values', () => {
    expect(asString({}, 'a')).toBeUndefined();
    expect(asString({ a: '   ' }, 'a')).toBeUndefined();
    expect(asString({ a: ['x'] }, 'a')).toBeUndefined();
    expect(asString({ a: null }, 'a')).toBeUndefined();
  });
});

describe('asList', () => {
  it('reads a YAML list', () => {
    expect(asList({ tools: ['Read', ' Grep ', ''] }, 'tools')).toEqual(['Read', 'Grep']);
  });

  it('reads a comma-separated string', () => {
    expect(asList({ tools: 'Read, Grep,Bash' }, 'tools')).toEqual(['Read', 'Grep', 'Bash']);
  });

  it('returns an empty list when the key is missing', () => {
    expect(asList({}, 'tools')).toEqual([]);
  });
});
