import { describe, expect, it } from 'vitest';
import { memoryTree } from '../fileTree';
import { copilot } from './copilot';

const md = (frontmatter: string, body: string) => `---\n${frontmatter}\n---\n${body}\n`;

const project = memoryTree({
  '.github/copilot-instructions.md': 'Use TypeScript strict mode.\n',
  '.github/instructions/everywhere.instructions.md': md('applyTo: "**"', 'Write tests for every change.'),
  '.github/instructions/react.instructions.md': md('applyTo: "src/**/*.tsx"', 'Use hooks.'),
  '.github/instructions/api.instructions.md': md('description: API conventions\napplyTo: "api/**"', 'Validate input.'),
  '.github/agents/planner.agent.md': md('name: Planner\ndescription: Writes an implementation plan.\ntools: [\'search\', \'fetch\']\nmodel: GPT-5.5', 'Plan before coding.'),
  '.github/agents/security.agent.md': md('description: Reviews for security issues.', 'Look for secrets.'),
  '.github/chatmodes/explain.chatmode.md': md('description: Explains code.\ntools: [codebase]', 'Explain simply.'),
  '.github/prompts/release-notes.prompt.md': md('description: Draft release notes\nagent: agent', 'Summarize merged PRs.'),
  '.github/prompts/triage.prompt.md': 'Triage the open issues.\n',
  '.github/workflows/ci.yml': 'on: push',
  '.vscode/mcp.json': JSON.stringify({ servers: { github: { type: 'http', url: 'https://example.test/mcp' }, playwright: { command: 'npx' } }, inputs: [] }),
});

describe('copilot adapter', () => {
  it('detects Copilot files, but not a .github folder with only workflows', () => {
    expect(copilot.detect(memoryTree({ '.github/copilot-instructions.md': '' }))).toBe(true);
    expect(copilot.detect(memoryTree({ '.github/agents/a.agent.md': '' }))).toBe(true);
    expect(copilot.detect(memoryTree({ '.github/prompts/a.prompt.md': '' }))).toBe(true);
    expect(copilot.detect(memoryTree({ '.github/skills/a/SKILL.md': '' }))).toBe(true);
    expect(copilot.detect(memoryTree({ '.vscode/mcp.json': '{}' }))).toBe(true);
    expect(copilot.detect(memoryTree({ '.github/workflows/ci.yml': '', '.github/ISSUE_TEMPLATE/bug.yml': '' }))).toBe(false);
  });

  it('gives the primary agent copilot-instructions.md and the instructions that apply to every file', async () => {
    const { agents } = await copilot.parse(project);
    expect(agents[0]).toEqual({
      id: 'copilot',
      name: 'GitHub Copilot',
      kind: 'primary',
      description: 'The main GitHub Copilot agent for this project.',
      instructions: 'Use TypeScript strict mode.\n\n# everywhere (.github/instructions/everywhere.instructions.md)\n\nWrite tests for every change.\n',
      tools: [],
      skills: [],
      origin: { platform: 'copilot', path: '.github/copilot-instructions.md' },
    });
  });

  it('reads custom agents and older chat modes, named after the file when they have no name', async () => {
    const { agents } = await copilot.parse(project);
    expect(agents.slice(1).map((a) => [a.id, a.name, a.description, a.tools, a.model ?? null, a.origin.path])).toEqual([
      ['Planner', 'Planner', 'Writes an implementation plan.', ['search', 'fetch'], 'GPT-5.5', '.github/agents/planner.agent.md'],
      ['security', 'security', 'Reviews for security issues.', [], null, '.github/agents/security.agent.md'],
      ['explain', 'explain', 'Explains code.', ['codebase'], null, '.github/chatmodes/explain.chatmode.md'],
    ]);
  });

  it('shows other instructions and prompts as skills', async () => {
    const { skills } = await copilot.parse(project);
    expect(skills.map((s) => [s.id, s.description, s.origin.path])).toEqual([
      ['api', 'API conventions', '.github/instructions/api.instructions.md'],
      ['react', 'Applies to src/**/*.tsx', '.github/instructions/react.instructions.md'],
      ['release-notes', 'Draft release notes', '.github/prompts/release-notes.prompt.md'],
      ['triage', 'Triage the open issues.', '.github/prompts/triage.prompt.md'],
    ]);
    expect(skills[2].instructions).toBe('Summarize merged PRs.\n');
  });

  it('reads MCP servers from the "servers" key of .vscode/mcp.json', async () => {
    const { mcpServers } = await copilot.parse(project);
    expect(mcpServers).toEqual([
      { name: 'github', origin: { platform: 'copilot', path: '.vscode/mcp.json' } },
      { name: 'playwright', origin: { platform: 'copilot', path: '.vscode/mcp.json' } },
    ]);
  });

  it('warns about a custom agent without a description', async () => {
    const { warnings } = await copilot.parse(memoryTree({ '.github/agents/x.agent.md': 'Body' }));
    expect(warnings).toEqual(['.github/agents/x.agent.md has no description']);
  });

  it('has a primary agent with no instructions when there is no instructions file', async () => {
    const { agents } = await copilot.parse(memoryTree({ '.vscode/mcp.json': '{}' }));
    expect(agents[0].instructions).toBeUndefined();
    expect(agents[0].origin.path).toBe('.vscode/mcp.json');
  });
});
