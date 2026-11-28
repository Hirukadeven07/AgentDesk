import { describe, expect, it } from 'vitest';
import type { PlatformId } from '../data/types';
import { merge } from './merge';
import { emptyDiscovery, type DiscoveredAgent, type DiscoveredSkill, type Discovery } from './types';

const agent = (platform: PlatformId, id: string, more: Partial<DiscoveredAgent> = {}): DiscoveredAgent => ({
  id,
  name: id,
  kind: 'custom',
  tools: [],
  skills: [],
  origin: { platform, path: `${platform}/${id}` },
  ...more,
});
const skill = (platform: PlatformId, id: string, instructions = `do ${id}`, path = `${platform}/${id}/SKILL.md`): DiscoveredSkill => ({
  id,
  description: `${id} skill`,
  instructions,
  files: [],
  origin: { platform, path },
});
const disc = (d: Partial<Discovery>): Discovery => ({ ...emptyDiscovery(), ...d });

describe('merge', () => {
  it('puts primary agents at L3, custom agents at L2 and CrewAI agents at L1', () => {
    const { data } = merge([
      disc({ agents: [agent('claude-code', 'claude-code', { kind: 'primary' }), agent('claude-code', 'reviewer')] }),
      disc({ agents: [agent('crewai', 'researcher')] }),
      disc({ agents: [agent('langgraph', 'graph')] }),
    ]);
    expect(data.tiers).toEqual([
      { level: 3, name: 'MAIN AGENTS', agentIds: ['claude-code'] },
      { level: 2, name: 'CUSTOM AGENTS', agentIds: ['reviewer', 'graph'] },
      { level: 1, name: 'WORKERS', agentIds: ['researcher'] },
    ]);
    expect(data.floorAgents).toEqual([]);
  });

  it('turns agents into idle roster agents with their real details', () => {
    const { data } = merge([
      disc({
        agents: [agent('claude-code', 'reviewer', { description: 'Reviews code.', instructions: 'Be careful.', model: 'sonnet', tools: ['Read'], skills: ['pr'] })],
        skills: [skill('claude-code', 'pr')],
      }),
    ]);
    expect(data.offFloorAgents).toEqual([
      {
        id: 'reviewer',
        name: 'reviewer',
        role: 'Claude Code agent',
        status: 'idle',
        skills: ['pr'],
        tools: ['Read'],
        stats: { model: 'sonnet' },
        description: 'Reviews code.',
        instructions: 'Be careful.',
        origin: { platform: 'claude-code', path: 'claude-code/reviewer' },
      },
    ]);
  });

  it('gives a primary agent every skill of its platform and the shared ones, plus its MCP servers as tools', () => {
    const { data } = merge([
      disc({
        agents: [agent('claude-code', 'claude-code', { kind: 'primary' })],
        skills: [skill('claude-code', 'ship')],
        mcpServers: [{ name: 'github', origin: { platform: 'claude-code', path: '.mcp.json' } }],
      }),
      disc({ skills: [skill('agent-skills', 'pdf'), skill('cursor', 'lint')] }),
    ]);
    const main = data.offFloorAgents[0];
    expect(main.role).toBe('Main Claude Code agent');
    expect(main.skills).toEqual(['ship', 'pdf']);
    expect(main.tools).toEqual(['mcp__github']);
  });

  it('merges the same skill found in two folders into one rack', () => {
    const { data, summary } = merge([
      disc({
        skills: [
          skill('claude-code', 'pr', 'Write the PR body.', '.claude/skills/pr/SKILL.md'),
          skill('agent-skills', 'pr', 'Write the PR body.', '.agents/skills/pr/SKILL.md'),
        ],
      }),
    ]);
    expect(Object.keys(data.skills)).toEqual(['pr']);
    expect(data.skills.pr).toMatchObject({ kind: 'sl', desc: 'pr skill', instructions: 'Write the PR body.', origin: { path: '.claude/skills/pr/SKILL.md' } });
    expect(summary.duplicates).toBe(1);
  });

  it('keeps different skills and agents that share a name apart, naming the later ones after their platform', () => {
    const { data } = merge([
      disc({ agents: [agent('claude-code', 'reviewer')], skills: [skill('claude-code', 'release', 'Claude steps')] }),
      disc({ agents: [agent('cursor', 'reviewer')], skills: [skill('cursor', 'release', 'Cursor steps')] }),
    ]);
    expect(data.offFloorAgents.map((a) => a.id)).toEqual(['reviewer', 'reviewer@cursor']);
    expect(Object.keys(data.skills)).toEqual(['release', 'release@cursor']);
  });

  it("points an agent's skill names at the right skill, preferring its own platform", () => {
    const { data } = merge([
      disc({ skills: [skill('claude-code', 'release', 'Claude steps')] }),
      disc({ agents: [agent('cursor', 'shipper', { skills: ['release'] })], skills: [skill('cursor', 'release', 'Cursor steps')] }),
    ]);
    expect(data.offFloorAgents[0].skills).toEqual(['release@cursor']);
  });

  it('drops a skill name it cannot find, with a warning', () => {
    const { data, warnings } = merge([disc({ agents: [agent('claude-code', 'reviewer', { skills: ['ghost'] })] })]);
    expect(data.offFloorAgents[0].skills).toEqual([]);
    expect(warnings).toEqual(['claude-code/reviewer: agent "reviewer" uses skill "ghost", which was not found']);
  });

  it('skips anything in a test fixture folder, and counts it', () => {
    const { data, summary } = merge([
      disc({
        agents: [agent('claude-code', 'real'), { ...agent('claude-code', 'fake'), origin: { platform: 'claude-code', path: 'test/fixtures/.claude/agents/fake.md' } }],
        skills: [skill('agent-skills', 'demo', 'x', 'src/__fixtures__/skills/demo/SKILL.md'), skill('agent-skills', 'kept', 'y', 'examples/skills/kept/SKILL.md')],
      }),
    ]);
    expect(data.offFloorAgents.map((a) => a.id)).toEqual(['real']);
    expect(Object.keys(data.skills)).toEqual(['kept']);
    expect(summary.skippedFixtures).toBe(2);
  });

  it('collects warnings from every discovery and sums up what it found', () => {
    const { warnings, summary } = merge([
      disc({ agents: [agent('codex', 'codex', { kind: 'primary' })], warnings: ['a.toml is not valid TOML'] }),
      disc({ skills: [skill('agent-skills', 's')], mcpServers: [{ name: 'm', origin: { platform: 'codex', path: 'c' } }], warnings: ['b'] }),
    ]);
    expect(warnings).toEqual(['a.toml is not valid TOML', 'b']);
    expect(summary).toEqual({ agents: 1, skills: 1, mcpServers: 1, platforms: ['codex', 'agent-skills'], duplicates: 0, skippedFixtures: 0 });
  });

  it('builds data every window can show: levels without demo settings, rooms without demo tickets', () => {
    const { data } = merge([disc({ agents: [agent('codex', 'codex', { kind: 'primary' })] })]);
    for (const level of [1, 2, 3] as const) {
      expect(data.levels[level].cfg).toBeUndefined();
      expect(data.levels[level].title).toBeTruthy();
    }
    for (const room of Object.values(data.rooms)) expect(room.backlog).toEqual([]);
  });
});
