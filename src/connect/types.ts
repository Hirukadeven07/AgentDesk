import type { Origin, PlatformId } from '../data/types';
import type { FileTree } from './fileTree';

/** An agent as one adapter found it, before the merger places it in a tier. */
export interface DiscoveredAgent {
  id: string;
  name: string;
  /** `primary` is the agent a platform runs by default (CLAUDE.md, AGENTS.md…); `custom` is one the user defined. */
  kind: 'primary' | 'custom';
  description?: string;
  instructions?: string;
  model?: string;
  tools: string[];
  skills: string[];
  origin: Origin;
}

/** A skill as one adapter found it, before the merger places it on a rack. */
export interface DiscoveredSkill {
  id: string;
  description: string;
  instructions: string;
  /** The skill's other files, relative to its folder. */
  files: { path: string; size?: number }[];
  origin: Origin;
}

/** An MCP server a platform is configured to use. */
export interface DiscoveredMcpServer {
  name: string;
  origin: Origin;
}

/** What one adapter reports for one file tree. */
export interface Discovery {
  agents: DiscoveredAgent[];
  skills: DiscoveredSkill[];
  mcpServers: DiscoveredMcpServer[];
  /** Files that were found but could not be used, and why. Shown to the user, never thrown. */
  warnings: string[];
}

/** The code for one platform or format (see GLOSSARY.md). */
export interface Adapter {
  id: PlatformId;
  label: string;
  /** True when the tree has any file this adapter reads. */
  detect(tree: FileTree): boolean;
  parse(tree: FileTree): Promise<Discovery>;
}

export const emptyDiscovery = (): Discovery => ({ agents: [], skills: [], mcpServers: [], warnings: [] });
