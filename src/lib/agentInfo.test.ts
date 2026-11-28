import { describe, expect, it } from 'vitest';
import { mockData } from '../data/mock';
import { Simulation } from '../sim/simulation';
import { getAgentInfo, shortTool } from './agentInfo';

describe('getAgentInfo', () => {
  const sim = new Simulation(mockData);

  it('describes a floor agent from the simulation', () => {
    const atlas = getAgentInfo('atlas', sim, mockData);
    expect(atlas.live).toBe(sim.agents.find((a) => a.id === 'atlas'));
    expect(atlas).toMatchObject({ name: 'Atlas', tier: 1, tierName: 'WORKERS' });
    expect(['working', 'walking']).toContain(atlas.status);
  });

  it("splits a floor agent's steps into skills and plain tools, without repeats", () => {
    const atlas = getAgentInfo('atlas', sim, mockData);
    expect(atlas.skills).toEqual(['test-runner']);
    expect(atlas.tools).toEqual(['read_ticket', 'read_file', 'bash', 'edit_file']);
  });

  it('describes an idle agent from the off-floor list', () => {
    const orion = getAgentInfo('orion', sim, mockData);
    expect(orion.live).toBeUndefined();
    expect(orion).toMatchObject({ status: 'idle', tier: 3, where: 'Off the floor, waiting for a ticket', ago: '14 min ago' });
  });

  it('says a connected agent waits on the roster, not for a ticket', () => {
    const data = { ...mockData, offFloorAgents: mockData.offFloorAgents.map((a) => (a.id === 'orion' ? { ...a, origin: { platform: 'codex' as const, path: 'AGENTS.md' } } : a)) };
    expect(getAgentInfo('orion', new Simulation(data), data).where).toBe('On the roster, not live yet');
  });

  it('describes an offline agent as offline', () => {
    expect(getAgentInfo('lumen', sim, mockData)).toMatchObject({ status: 'offline', where: 'Offline', tier: 2 });
  });

  it('finds every agent listed in a tier', () => {
    for (const t of mockData.tiers) for (const id of t.agentIds) expect(getAgentInfo(id, sim, mockData).tier).toBe(t.level);
  });

  it('throws for an agent it has never heard of', () => {
    expect(() => getAgentInfo('nobody', sim, mockData)).toThrow('Unknown agent: nobody');
  });
});

describe('shortTool', () => {
  it('turns underscores into spaces', () => {
    expect(shortTool('read_file')).toBe('read file');
    expect(shortTool('web_search_news')).toBe('web search news');
  });

  it('collapses runs of underscores in MCP-style names', () => {
    expect(shortTool('mcp__github__create_pull_request')).toBe('mcp github create pull request');
  });

  it('leaves names without underscores alone', () => {
    expect(shortTool('bash')).toBe('bash');
    expect(shortTool('test-runner')).toBe('test-runner');
  });
});
