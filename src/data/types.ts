/**
 * The shape of everything AgentDesk shows. The UI and the renderers only
 * read data through these types, so a real backend can replace the mock
 * data in `./mock` by producing an `AgentDeskData` object.
 */

/** Rooms on the agent floor (level L1). The layout lives in `src/world/floor.ts`. */
export type StationId =
  | 'dispatch'
  | 'terminal'
  | 'editor'
  | 'web'
  | 'archive'
  | 'planning'
  | 'stateless'
  | 'stateful';

/** `sl` = stateless skill, `sf` = stateful skill. */
export type SkillKind = 'sl' | 'sf';

export interface Skill {
  id: string;
  kind: SkillKind;
  desc: string;
  version: string;
  runtime: string;
  latency: string;
  input: string;
  output: string;
  steps: string[];
  /** Extra files shipped with the skill: [path, size]. */
  files: [string, string][];
  /** Calls made before this session started. */
  callsToday: number;
  /** Stateful only: one-line summary of what the store holds. */
  state?: string;
  /** Stateful only: how full the store is, 0..1. */
  fill?: number;
  /** Stateful only: a peek into the store. */
  stateTable?: { head: [string, string, string]; rows: [string, string, string][] };
}

/** One step an agent performs at a station, using a tool or a skill. */
export interface AgentStep {
  station: StationId;
  text: string;
  /** A tool name (e.g. `bash`) or a skill id (e.g. `test-runner`). */
  tool: string;
  /** How long the step takes, in simulated seconds. */
  duration: number;
}

export interface AgentStats {
  model: string;
  tasksDone: number;
  callsToday: number;
  successRate: string;
  joined: string;
}

/** An agent that is on the floor, working through a task. */
export interface FloorAgent {
  id: string;
  name: string;
  role: string;
  task: string;
  steps: AgentStep[];
  stats: AgentStats;
}

/** An agent that is on the team but not on the floor right now. */
export interface OffFloorAgent {
  id: string;
  name: string;
  role: string;
  status: 'idle' | 'offline';
  skills: string[];
  tools: string[];
  last: string;
  ago: string;
  stats: AgentStats;
}

export type Level = 1 | 2 | 3;

export interface Tier {
  level: Level;
  name: string;
  agentIds: string[];
}

export interface LevelInfo {
  title: string;
  summary: string;
  does: string[];
  cant: string[];
  cfg: { model: string; turns: number; files: string; shell: string; handoff: string; budget: string };
}

export interface RoomInfo {
  purpose: string;
  kit: [string, string][];
  backlog: string[];
}

export interface AgentDeskData {
  floorAgents: FloorAgent[];
  offFloorAgents: OffFloorAgent[];
  /** Keyed by skill id. Insertion order sets the rack order on the skills layer. */
  skills: Record<string, Skill>;
  rooms: Record<StationId, RoomInfo>;
  /** Highest level first. */
  tiers: Tier[];
  levels: Record<Level, LevelInfo>;
}
