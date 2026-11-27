import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { mockData } from '../../data/mock';
import type { AgentsDeckData } from '../../data/types';
import { Simulation } from '../../sim/simulation';
import { AppContext, type AppCtx } from '../actions';
import { agentWindow } from './AgentWindow';
import { levelWindow } from './LevelWindow';
import { skillWindow } from './SkillWindow';
import type { WindowContent } from './types';

/**
 * A connected project: only what a platform's own files say about an agent
 * or a skill. No made-up stats, latency or history like the demo team has.
 */
const connected: AgentsDeckData = {
  floorAgents: [],
  offFloorAgents: [
    {
      id: 'reviewer',
      name: 'Reviewer',
      role: 'Custom agent',
      status: 'idle',
      skills: ['pr'],
      tools: ['Read', 'Grep'],
      stats: { model: 'sonnet' },
      description: 'Reviews pull requests for correctness.',
      instructions: 'You review pull requests.',
      origin: { platform: 'claude-code', path: '.claude/agents/reviewer.md' },
    },
  ],
  skills: {
    pr: {
      id: 'pr',
      kind: 'sl',
      desc: 'Use when writing a PR body',
      files: [],
      instructions: 'Use this template for writing the PR body.',
      origin: { platform: 'claude-code', path: '.claude/skills/pr/SKILL.md' },
    },
  },
  rooms: mockData.rooms,
  tiers: [
    { level: 3, name: 'ORCHESTRATORS', agentIds: [] },
    { level: 2, name: 'SPECIALISTS', agentIds: ['reviewer'] },
    { level: 1, name: 'WORKERS', agentIds: [] },
  ],
  levels: mockData.levels,
};

const ctxFor = (data: AgentsDeckData): AppCtx => ({
  data,
  sim: new Simulation(data),
  actions: { follow: () => {}, open: () => {}, close: () => {}, setView: () => {} },
});

/** Every tab of a window as plain HTML, plus its header. */
function renderAll(w: WindowContent | null, ctx: AppCtx) {
  if (!w) throw new Error('window did not open');
  const tabs = w.tabs.map(([id]) => renderToStaticMarkup(<AppContext.Provider value={ctx}>{w.body(id)}</AppContext.Provider>));
  return [w.title, w.sub, ...tabs].join('\n');
}

/** What a missing value looks like once it reaches the page. */
const BROKEN = /\bundefined\b|\bNaN\b/;

describe('detail windows for a connected project', () => {
  const ctx = ctxFor(connected);

  it('shows an agent without stats or history and never prints undefined', () => {
    const html = renderAll(agentWindow('reviewer', ctx), ctx);
    expect(html).not.toMatch(BROKEN);
    expect(html).toContain('sonnet');
    expect(html).toContain('Idle');
  });

  it('shows a skill without version, runtime or latency and never prints undefined', () => {
    const html = renderAll(skillWindow('pr', ctx), ctx);
    expect(html).not.toMatch(BROKEN);
    expect(html).toContain('Use when writing a PR body');
  });

  it('shows a level whose agents have no stats and never prints NaN', () => {
    const html = renderAll(levelWindow(2, ctx), ctx);
    expect(html).not.toMatch(BROKEN);
    expect(html).toContain('Reviewer');
  });
});

describe('detail windows for the demo team', () => {
  const ctx = ctxFor(mockData);

  it('still shows the made-up stats', () => {
    const html = renderAll(agentWindow('orion', ctx), ctx);
    expect(html).toContain('success rate');
    expect(html).toContain('tasks done');
  });

  it('still shows skill runtime and latency', () => {
    const id = Object.keys(mockData.skills)[0];
    const html = renderAll(skillWindow(id, ctx), ctx);
    expect(html).toContain('avg latency');
    expect(html).toContain(mockData.skills[id].runtime!);
  });

  it('renders every window for every demo agent and skill without undefined', () => {
    for (const t of mockData.tiers) {
      for (const id of t.agentIds) expect(renderAll(agentWindow(id, ctx), ctx)).not.toMatch(BROKEN);
      expect(renderAll(levelWindow(t.level, ctx), ctx)).not.toMatch(BROKEN);
    }
    for (const id of Object.keys(mockData.skills)) expect(renderAll(skillWindow(id, ctx), ctx)).not.toMatch(BROKEN);
  });
});
