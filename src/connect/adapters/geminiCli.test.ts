import { describe, expect, it } from 'vitest';
import { memoryTree } from '../fileTree';
import { geminiCli } from './geminiCli';

const project = memoryTree({
  'GEMINI.md': '# Project context\n\nUse Go 1.24.\n',
  'services/api/GEMINI.md': 'API-only notes.',
  '.gemini/settings.json': JSON.stringify({
    model: { name: 'gemini-3-pro' },
    mcpServers: { github: { httpUrl: 'https://example.test/mcp' }, sqlite: { command: 'mcp-sqlite' } },
  }),
  '.gemini/commands/test.toml': 'description = "Run the tests and fix failures"\nprompt = "Run go test ./... and fix what fails."\n',
  '.gemini/commands/git/commit.toml': 'prompt = """\nWrite a commit message for:\n!{git diff --staged}\n"""\n',
  '.gemini/agents/reviewer.md': '---\nname: reviewer\ndescription: Reviews Go code.\ntools:\n  - read_file\n  - grep\nmodel: gemini-3-flash\n---\nReview carefully.\n',
  '.gemini/extensions/gcp/gemini-extension.json': JSON.stringify({ name: 'gcp', version: '1.0.0', mcpServers: { gcloud: { command: 'gcloud-mcp' } } }),
  '.gemini/extensions/gcp/commands/deploy.toml': 'description = "Deploy to Cloud Run"\nprompt = "Deploy."\n',
  '.gemini/extensions/gcp/commands/gcs/sync.toml': 'prompt = "Sync the bucket."\n',
  '.gemini/extensions/gcp/agents/sre.md': '---\nname: sre\ndescription: Keeps services up.\n---\nWatch the dashboards.\n',
});

describe('geminiCli adapter', () => {
  it('detects GEMINI.md, a .gemini folder or an extension', () => {
    expect(geminiCli.detect(memoryTree({ 'GEMINI.md': '' }))).toBe(true);
    expect(geminiCli.detect(memoryTree({ '.gemini/settings.json': '{}' }))).toBe(true);
    expect(geminiCli.detect(memoryTree({ 'gemini-extension.json': '{}' }))).toBe(true);
    expect(geminiCli.detect(memoryTree({ 'AGENTS.md': '' }))).toBe(false);
  });

  it('gives the primary agent the root GEMINI.md and the model from settings', async () => {
    const { agents } = await geminiCli.parse(project);
    expect(agents[0]).toEqual({
      id: 'gemini-cli',
      name: 'Gemini CLI',
      kind: 'primary',
      description: 'The main Gemini CLI agent for this project.',
      instructions: '# Project context\n\nUse Go 1.24.\n',
      model: 'gemini-3-pro',
      tools: [],
      skills: [],
      origin: { platform: 'gemini-cli', path: 'GEMINI.md' },
    });
  });

  it('reads the older settings format, where model is a string', async () => {
    const { agents } = await geminiCli.parse(memoryTree({ '.gemini/settings.json': '{"model": "gemini-2.5-pro"}' }));
    expect(agents[0].model).toBe('gemini-2.5-pro');
  });

  it('uses the context file name from settings', async () => {
    const tree = memoryTree({ 'CONTEXT.md': 'Custom context.', '.gemini/settings.json': JSON.stringify({ context: { fileName: ['CONTEXT.md', 'GEMINI.md'] } }) });
    const { agents } = await geminiCli.parse(tree);
    expect(agents[0]).toMatchObject({ instructions: 'Custom context.', origin: { path: 'CONTEXT.md' } });
  });

  it('reads commands as skills, namespaced by folder like /git:commit', async () => {
    const { skills } = await geminiCli.parse(project);
    expect(skills.map((s) => [s.id, s.description, s.origin.path])).toEqual([
      ['git:commit', 'Write a commit message for:', '.gemini/commands/git/commit.toml'],
      ['test', 'Run the tests and fix failures', '.gemini/commands/test.toml'],
      ['deploy', 'Deploy to Cloud Run', '.gemini/extensions/gcp/commands/deploy.toml'],
      ['gcs:sync', 'Sync the bucket.', '.gemini/extensions/gcp/commands/gcs/sync.toml'],
    ]);
    expect(skills[1].instructions).toBe('Run go test ./... and fix what fails.');
  });

  it('reads subagents, including those an extension ships', async () => {
    const { agents } = await geminiCli.parse(project);
    expect(agents.slice(1).map((a) => [a.id, a.description, a.tools, a.model ?? null, a.origin.path])).toEqual([
      ['reviewer', 'Reviews Go code.', ['read_file', 'grep'], 'gemini-3-flash', '.gemini/agents/reviewer.md'],
      ['sre', 'Keeps services up.', [], null, '.gemini/extensions/gcp/agents/sre.md'],
    ]);
  });

  it('reads MCP servers from settings and from extensions', async () => {
    const { mcpServers } = await geminiCli.parse(project);
    expect(mcpServers.map((m) => [m.name, m.origin.path])).toEqual([
      ['github', '.gemini/settings.json'],
      ['sqlite', '.gemini/settings.json'],
      ['gcloud', '.gemini/extensions/gcp/gemini-extension.json'],
    ]);
  });

  it('has no primary agent when the repo is itself an extension', async () => {
    const { agents, skills } = await geminiCli.parse(memoryTree({
      'gemini-extension.json': JSON.stringify({ name: 'solo', contextFileName: 'GEMINI.md' }),
      'GEMINI.md': 'Context the extension adds.',
      'commands/hello.toml': 'prompt = "Say hello."\n',
    }));
    expect(agents).toEqual([]);
    expect(skills.map((s) => s.id)).toEqual(['hello']);
  });

  it('warns about a command without a prompt and about broken TOML', async () => {
    const { skills, warnings } = await geminiCli.parse(memoryTree({
      '.gemini/commands/empty.toml': 'description = "Nothing"\n',
      '.gemini/commands/bad.toml': 'prompt = ',
    }));
    expect(skills).toEqual([]);
    expect(warnings).toEqual([expect.stringMatching(/^\.gemini\/commands\/bad\.toml is not valid TOML/), '.gemini/commands/empty.toml has no prompt']);
  });
});
