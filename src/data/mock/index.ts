import type { AgentsDeckData, AgentStats } from '../types';
import { FLOOR_AGENTS, OFF_FLOOR_AGENTS } from './agents';
import { SKILLS } from './skills';
import { LEVELS, MODEL_BY_LEVEL, ROOMS, TIERS } from './org';

const hashN = (s: string) => {
  let h = 7;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 100003;
  return h;
};

/** Made-up but stable numbers for each agent. */
function mockStats(id: string): AgentStats {
  const level = TIERS.find((t) => t.agentIds.includes(id))?.level ?? 1;
  const h = hashN(id);
  return {
    model: MODEL_BY_LEVEL[level],
    tasksDone: 60 + (h % 380),
    callsToday: 30 + (h % 170),
    successRate: (93 + (h % 60) / 10).toFixed(1),
    joined: ['2026-09-02', '2026-09-15', '2026-10-01', '2026-10-20', '2026-11-03'][h % 5],
  };
}

/** All mock data in one object. Swap this for a real source later. */
export const mockData: AgentsDeckData = {
  floorAgents: FLOOR_AGENTS.map((a) => ({ ...a, stats: mockStats(a.id) })),
  offFloorAgents: OFF_FLOOR_AGENTS.map((a) => ({ ...a, stats: mockStats(a.id) })),
  skills: SKILLS,
  rooms: ROOMS,
  tiers: TIERS,
  levels: LEVELS,
};
