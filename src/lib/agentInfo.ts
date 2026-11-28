import type { AgentsDeckData, AgentStats, Level, Origin } from '../data/types';
import type { LiveAgent, Simulation } from '../sim/simulation';
import { STATIONS } from '../world/floor';

export type AgentStatus = 'working' | 'walking' | 'idle' | 'offline';

/** One agent as the roster and the agent window see it, whether on the floor or not. */
export interface AgentInfo {
  id: string;
  name: string;
  role: string;
  tier: Level;
  tierName: string;
  status: AgentStatus;
  skills: string[];
  tools: string[];
  where: string;
  stats: AgentStats;
  live?: LiveAgent;
  last?: string;
  ago?: string;
  /** From a connected project's own files; the demo team has none. */
  description?: string;
  instructions?: string;
  origin?: Origin;
}

export function getAgentInfo(id: string, sim: Simulation, data: AgentsDeckData): AgentInfo {
  const tier = data.tiers.find((t) => t.agentIds.includes(id)) ?? data.tiers[data.tiers.length - 1];
  const base = { id, tier: tier.level, tierName: tier.name };
  const source = (a: { description?: string; instructions?: string; origin?: Origin }) => ({
    ...(a.description !== undefined ? { description: a.description } : {}),
    ...(a.instructions !== undefined ? { instructions: a.instructions } : {}),
    ...(a.origin ? { origin: a.origin } : {}),
  });
  const live = sim.agents.find((a) => a.id === id);
  if (live) {
    const used = live.steps.map((s) => s.tool);
    const st = STATIONS[live.seat.st];
    return {
      ...base,
      ...source(live),
      live,
      name: live.name,
      role: live.role,
      stats: live.stats,
      status: live.phase === 'work' ? 'working' : 'walking',
      skills: [...new Set(used.filter((x) => data.skills[x]))],
      tools: [...new Set(used.filter((x) => !data.skills[x]))],
      where: live.phase === 'work' ? `At ${st.code} ${st.name}` : `Walking to ${st.name}`,
    };
  }
  const e = data.offFloorAgents.find((a) => a.id === id);
  if (!e) throw new Error(`Unknown agent: ${id}`);
  return {
    ...base,
    ...source(e),
    name: e.name,
    role: e.role,
    status: e.status,
    skills: e.skills,
    tools: e.tools,
    stats: e.stats,
    last: e.last,
    ago: e.ago,
    where: e.status === 'offline' ? 'Offline' : 'Off the floor, waiting for a ticket',
  };
}

/** A tool name as a short label: `web_search` → `web search`, `mcp__github__create_pr` → `mcp github create pr`. */
export const shortTool = (t: string) => t.replace(/_+/g, ' ');
