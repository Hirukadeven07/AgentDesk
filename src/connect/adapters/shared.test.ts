import { describe, expect, it } from 'vitest';
import { memoryTree } from '../fileTree';
import { emptyDiscovery } from '../types';
import { addMcpJson, baseName, dirOf, firstLine, markdownAgent, markdownCommand, readJson, readMarkdown, readText } from './shared';

describe('path helpers', () => {
  it('baseName drops the folder and the extension, ignoring case', () => {
    expect(baseName('.claude/agents/code-reviewer.md')).toBe('code-reviewer');
    expect(baseName('a/B.MD')).toBe('B');
    expect(baseName('.codex/agents/x.toml', '.toml')).toBe('x');
    expect(baseName('rules/x.mdc', '.md')).toBe('x.mdc');
  });

  it('dirOf keeps a trailing slash, and is empty at the root', () => {
    expect(dirOf('a/b/c.md')).toBe('a/b/');
    expect(dirOf('c.md')).toBe('');
  });

  it('firstLine skips blank lines and heading marks, and stops at 200 characters', () => {
    expect(firstLine('\n\n## Ship it\nmore')).toBe('Ship it');
    expect(firstLine('')).toBe('');
    expect(firstLine('x'.repeat(300))).toHaveLength(200);
  });
});

describe('readers', () => {
  const tree = memoryTree({
    'ok.md': '---\nname: a\n---\nBody',
    'bad.md': '---\nname: [x\n---\nBody',
    'big.md': 'x'.repeat(300 * 1024),
    'list.json': '[1, 2]',
    'broken.json': '{',
  });

  it('readText warns when a file cannot be read', async () => {
    const out = emptyDiscovery();
    expect(await readText(tree, 'big.md', out)).toBeNull();
    expect(out.warnings).toEqual(['big.md could not be read (missing or over 256 KB)']);
  });

  it('readMarkdown warns about broken frontmatter and still returns the body', async () => {
    const out = emptyDiscovery();
    expect((await readMarkdown(tree, 'ok.md', out))?.data).toEqual({ name: 'a' });
    expect((await readMarkdown(tree, 'bad.md', out))?.body).toBe('Body');
    expect(out.warnings).toEqual([expect.stringMatching(/^bad\.md has invalid frontmatter: /)]);
  });

  it('readJson only accepts an object, and warns about anything else', async () => {
    const out = emptyDiscovery();
    expect(await readJson(tree, 'list.json', out)).toBeUndefined();
    expect(await readJson(tree, 'broken.json', out)).toBeUndefined();
    expect(await readJson(tree, 'missing.json', out)).toBeUndefined();
    expect(out.warnings).toEqual(['list.json is not valid JSON', 'broken.json is not valid JSON']);
  });
});

describe('shared formats', () => {
  it('markdownAgent and markdownCommand tag results with the platform they are given', async () => {
    const tree = memoryTree({ '.cursor/agents/v.md': '---\nname: verifier\ndescription: Checks work.\n---\nVerify.', '.cursor/commands/go.md': 'Go now.' });
    const out = emptyDiscovery();
    const agent = await markdownAgent(tree, '.cursor/agents/v.md', 'cursor', '', out);
    const command = await markdownCommand(tree, '.cursor/commands/go.md', 'cursor', 'x:', out);
    expect(agent).toMatchObject({ id: 'verifier', origin: { platform: 'cursor', path: '.cursor/agents/v.md' } });
    expect(command).toMatchObject({ id: 'x:go', description: 'Go now.', origin: { platform: 'cursor' } });
  });

  it('addMcpJson adds each server with its platform and prefix', async () => {
    const tree = memoryTree({ '.cursor/mcp.json': JSON.stringify({ mcpServers: { a: {}, b: {} } }) });
    const out = emptyDiscovery();
    await addMcpJson(tree, '.cursor/mcp.json', 'cursor', 'p:', out);
    expect(out.mcpServers).toEqual([
      { name: 'p:a', origin: { platform: 'cursor', path: '.cursor/mcp.json' } },
      { name: 'p:b', origin: { platform: 'cursor', path: '.cursor/mcp.json' } },
    ]);
  });
});
