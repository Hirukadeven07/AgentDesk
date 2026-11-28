import { ROOMS } from '../data/mock/org';
import type { AgentsDeckData, Level, LevelInfo, OffFloorAgent, PlatformId, RoomInfo, Skill, StationId, Tier } from '../data/types';
import { PLATFORM_LABELS } from './platforms';
import type { DiscoveredAgent, DiscoveredSkill, Discovery } from './types';

/**
 * The merger (docs/adr/0001): turns what every adapter found into one AgentsDeckData.
 * - primary agents go to L3, custom agents to L2, CrewAI agents (workers that run the tasks a
 *   crew gives them) to L1; all are idle roster agents, since nothing is live yet
 * - the same skill found twice (same name, same text, e.g. symlinked into two folders) is one rack
 * - different agents or skills with the same name are kept apart: later ones get `@platform`
 * - an agent's skill names point at the matching skill, preferring its own platform
 * - a primary agent uses every skill of its platform plus the shared ones, and its MCP servers
 * - anything inside a test fixture folder is skipped; example folders are real content and stay
 */

export interface MergeSummary {
  agents: number;
  skills: number;
  mcpServers: number;
  /** Platforms found, in the order they were found. */
  platforms: PlatformId[];
  /** Skills found more than once and shown as one. */
  duplicates: number;
  /** Agents and skills skipped because they sit in a test fixture folder. */
  skippedFixtures: number;
}

export interface MergeResult {
  data: AgentsDeckData;
  warnings: string[];
  summary: MergeSummary;
}

const FIXTURE_DIRS = new Set(['__fixtures__', 'fixtures', '__tests__', '__mocks__', 'testdata', 'test-fixtures']);
const inFixtures = (path: string) => path.split('/').slice(0, -1).some((d) => FIXTURE_DIRS.has(d));

/** CrewAI agents only run the tasks their crew assigns them, so they are workers. */
const WORKER_PLATFORMS = new Set<PlatformId>(['crewai']);
const levelOf = (a: DiscoveredAgent): Level => (a.kind === 'primary' ? 3 : WORKER_PLATFORMS.has(a.origin.platform) ? 1 : 2);

const TIER_NAMES: Record<Level, string> = { 3: 'MAIN AGENTS', 2: 'CUSTOM AGENTS', 1: 'WORKERS' };

const LEVELS: Record<Level, LevelInfo> = {
  3: {
    title: 'Main agents',
    summary: 'The agent each tool runs by default, guided by the project’s instructions file.',
    does: ['Follow the project’s instructions file', 'Use the skills and MCP servers set up for its tool', 'Hand work to the custom agents'],
    cant: [],
  },
  2: {
    title: 'Custom agents',
    summary: 'Agents defined in this project for one kind of work, or deployed as their own app.',
    does: ['Take on the work their description names', 'Use the tools and skills they list'],
    cant: [],
  },
  1: {
    title: 'Workers',
    summary: 'Agents that run the tasks a crew gives them.',
    does: ['Run their crew’s tasks', 'Hand results on to the next task'],
    cant: [],
  },
};

/** The office's rooms, without the demo team's tickets. */
const ROOMS_FOR_PROJECT = {} as Record<StationId, RoomInfo>;
for (const id of Object.keys(ROOMS) as StationId[]) ROOMS_FOR_PROJECT[id] = { ...ROOMS[id], backlog: [] };

const fmtSize = (size?: number) => (size === undefined ? '' : `${(size / 1024).toFixed(1)} KB`);

/** A name not taken yet: `id`, else `id@platform`, else `id@platform-2`… */
function uniqueId(id: string, platform: PlatformId, taken: Set<string>) {
  if (!taken.has(id)) return id;
  let candidate = `${id}@${platform}`;
  for (let n = 2; taken.has(candidate); n++) candidate = `${id}@${platform}-${n}`;
  return candidate;
}

export function merge(discoveries: Discovery[]): MergeResult {
  const warnings = discoveries.flatMap((d) => d.warnings);
  // platforms in the order each discovery reported them
  const platforms = [
    ...new Set(discoveries.flatMap((d) => [...d.agents, ...d.skills, ...d.mcpServers].filter((x) => !inFixtures(x.origin.path)).map((x) => x.origin.platform))),
  ];
  let skippedFixtures = 0;
  const keep = <T extends { origin: { path: string } }>(x: T) => (inFixtures(x.origin.path) ? (skippedFixtures++, false) : true);

  // skills: one rack per distinct skill
  const skills: Record<string, Skill> = {};
  const byContent = new Map<string, string>();
  /** A discovered skill name → the racks it became, with their platform. */
  const byName = new Map<string, { id: string; platform: PlatformId }[]>();
  let duplicates = 0;
  for (const s of discoveries.flatMap((d) => d.skills).filter(keep)) {
    const content = `${s.id}\n${s.instructions.trim()}`;
    const same = byContent.get(content);
    if (same) {
      duplicates++;
      continue;
    }
    const id = uniqueId(s.id, s.origin.platform, new Set(Object.keys(skills)));
    byContent.set(content, id);
    byName.set(s.id, [...(byName.get(s.id) ?? []), { id, platform: s.origin.platform }]);
    skills[id] = toSkill(id, s);
  }

  /** The rack a skill name means for an agent: its own platform's first, then a shared one, then any. */
  const resolve = (name: string, platform: PlatformId) => {
    const options = byName.get(name) ?? (skills[name] ? [{ id: name, platform: skills[name].origin!.platform }] : []);
    return (options.find((o) => o.platform === platform) ?? options.find((o) => o.platform === 'agent-skills') ?? options[0])?.id;
  };

  const mcpByPlatform = new Map<PlatformId, string[]>();
  for (const m of discoveries.flatMap((d) => d.mcpServers).filter(keep)) {
    mcpByPlatform.set(m.origin.platform, [...(mcpByPlatform.get(m.origin.platform) ?? []), m.name]);
  }
  const mcpCount = [...mcpByPlatform.values()].reduce((n, list) => n + list.length, 0);

  // agents
  const agents: OffFloorAgent[] = [];
  const tiers: Record<Level, string[]> = { 3: [], 2: [], 1: [] };
  const takenAgents = new Set<string>();
  for (const a of discoveries.flatMap((d) => d.agents).filter(keep)) {
    const platform = a.origin.platform;
    const id = uniqueId(a.id, platform, takenAgents);
    takenAgents.add(id);
    const own = a.skills.flatMap((name) => {
      const found = resolve(name, platform);
      if (!found) warnings.push(`${a.origin.path}: agent "${a.id}" uses skill "${name}", which was not found`);
      return found ? [found] : [];
    });
    const platformSkills = a.kind === 'primary' ? Object.values(skills).filter((s) => s.origin!.platform === platform || s.origin!.platform === 'agent-skills').map((s) => s.id) : [];
    const mcpTools = a.kind === 'primary' ? (mcpByPlatform.get(platform) ?? []).map((n) => `mcp__${n}`) : [];
    const label = PLATFORM_LABELS[platform];
    agents.push({
      id,
      name: a.name,
      role: a.kind === 'primary' ? `Main ${label} agent` : `${label} agent`,
      status: 'idle',
      skills: [...new Set([...own, ...platformSkills])],
      tools: [...new Set([...a.tools, ...mcpTools])],
      stats: a.model ? { model: a.model } : {},
      ...(a.description ? { description: a.description } : {}),
      ...(a.instructions !== undefined ? { instructions: a.instructions } : {}),
      origin: a.origin,
    });
    tiers[levelOf(a)].push(id);
  }

  const tierList: Tier[] = ([3, 2, 1] as Level[]).map((level) => ({ level, name: TIER_NAMES[level], agentIds: tiers[level] }));
  return {
    data: { floorAgents: [], offFloorAgents: agents, skills, rooms: ROOMS_FOR_PROJECT, tiers: tierList, levels: LEVELS },
    warnings,
    summary: { agents: agents.length, skills: Object.keys(skills).length, mcpServers: mcpCount, platforms, duplicates, skippedFixtures },
  };
}

function toSkill(id: string, s: DiscoveredSkill): Skill {
  return {
    id,
    // nothing says whether a connected skill keeps state, so every one is stateless
    kind: 'sl',
    desc: s.description,
    files: s.files.map((f) => [f.path, fmtSize(f.size)]),
    instructions: s.instructions,
    origin: s.origin,
  };
}
