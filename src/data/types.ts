/**
 * The shape of everything AgentsDeck shows. The UI and the renderers only
 * read data through these types, so a real backend can replace the mock
 * data in `./mock` by producing an `AgentsDeckData` object.
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

/**
 * The tool or framework a connected agent or skill was made for.
 * `agent-skills` is the shared `SKILL.md` format when no one tool owns the folder,
 * and `manifest` is anything described in an `agentsdeck.json` file.
 */
export type PlatformId =
  | 'agent-skills'
  | 'claude-code'
  | 'codex'
  | 'cursor'
  | 'copilot'
  | 'gemini-cli'
  | 'windsurf'
  | 'cline'
  | 'roo-code'
  | 'crewai'
  | 'langgraph'
  | 'manifest';

/** Where a connected agent or skill was found. The demo team has none. */
export interface Origin {
  platform: PlatformId;
  /** Path of the file it came from, relative to the project root. */
  path: string;
}

/**
 * A skill. A connected project only knows what the skill's own files say, so
 * `version`, `runtime`, `latency`, `input`, `output`, `steps` and `callsToday`
 * are only there for the demo team.
 */
export interface Skill {
  id: string;
  kind: SkillKind;
  desc: string;
  version?: string;
  runtime?: string;
  latency?: string;
  input?: string;
  output?: string;
  steps?: string[];
  /** Extra files shipped with the skill: [path, size]. */
  files: [string, string][];
  /** Calls made before this session started. */
  callsToday?: number;
  /** The body of the skill's file, such as a `SKILL.md` without its frontmatter. */
  instructions?: string;
  origin?: Origin;
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

/** What is known about how an agent runs. A connected project usually only knows the model. */
export interface AgentStats {
  model?: string;
  tasksDone?: number;
  callsToday?: number;
  successRate?: string;
  joined?: string;
}

/** What a connected agent's own files say about it. The demo team leaves these out. */
interface AgentSource {
  /** The agent's description, often a line about when to use it. */
  description?: string;
  /** The body of the agent's file, such as `.claude/agents/x.md` without its frontmatter. */
  instructions?: string;
  origin?: Origin;
}

/** An agent that is on the floor, working through a task. */
export interface FloorAgent extends AgentSource {
  id: string;
  name: string;
  role: string;
  task: string;
  steps: AgentStep[];
  stats: AgentStats;
}

/** An agent that is on the team but not on the floor right now. */
export interface OffFloorAgent extends AgentSource {
  id: string;
  name: string;
  role: string;
  status: 'idle' | 'offline';
  skills: string[];
  tools: string[];
  /** The last task it finished, when known. */
  last?: string;
  /** How long ago that was, such as `14 min ago`. */
  ago?: string;
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

export interface AgentsDeckData {
  floorAgents: FloorAgent[];
  offFloorAgents: OffFloorAgent[];
  /** Keyed by skill id. Insertion order sets the rack order on the skills layer. */
  skills: Record<string, Skill>;
  rooms: Record<StationId, RoomInfo>;
  /** Highest level first. */
  tiers: Tier[];
  levels: Record<Level, LevelInfo>;
}
