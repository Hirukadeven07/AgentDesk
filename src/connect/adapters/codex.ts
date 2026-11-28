import { parse } from 'smol-toml';
import type { Origin } from '../../data/types';
import type { FileTree } from '../fileTree';
import { parseFrontmatter } from '../frontmatter';
import { emptyDiscovery, type Adapter, type DiscoveredAgent, type Discovery } from '../types';
import { baseName, readText } from './shared';

/**
 * Reads a Codex project (https://developers.openai.com/codex):
 * - the primary agent, from `AGENTS.override.md` or `AGENTS.md` and the `model` in `.codex/config.toml`
 * - custom agents: one TOML file each in `.codex/agents/` (`name`, `description`, `developer_instructions`)
 * - agent roles in `[agents.<name>]` of `.codex/config.toml`, which may point at an agent file with `config_file`
 * - MCP servers in `[mcp_servers.<name>]` of `.codex/config.toml`
 * Skills (`.agents/skills`, `.codex/skills`) are left to the agent-skills adapter.
 */

type Table = Record<string, unknown>;

const CONFIG = '.codex/config.toml';
const origin = (path: string): Origin => ({ platform: 'codex', path });
const isTable = (v: unknown): v is Table => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (t: Table, key: string) => (typeof t[key] === 'string' && (t[key] as string).trim() ? (t[key] as string).trim() : undefined);
const depth = (path: string) => path.split('/').length;

/** Resolves `agents/x.toml` or `../x.toml` against a folder such as `.codex/`. */
function resolve(dir: string, rel: string) {
  const out: string[] = [];
  for (const part of (dir + rel).replace(/\\/g, '/').split('/')) {
    if (part === '..') out.pop();
    else if (part && part !== '.') out.push(part);
  }
  return out.join('/');
}

async function readToml(tree: FileTree, path: string, out: Discovery): Promise<Table | undefined> {
  const src = await readText(tree, path, out);
  if (src === null) return undefined;
  try {
    return parse(src) as Table;
  } catch (e) {
    out.warnings.push(`${path} is not valid TOML: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`);
    return undefined;
  }
}

/** A standalone agent file. `fallbackName` is used when the file has no `name`. */
async function readAgentFile(tree: FileTree, path: string, fallbackName: string, out: Discovery): Promise<DiscoveredAgent | null> {
  const t = await readToml(tree, path, out);
  if (!t) return null;
  const name = text(t, 'name') ?? fallbackName;
  const description = text(t, 'description');
  const instructions = typeof t.developer_instructions === 'string' ? t.developer_instructions : undefined;
  const model = text(t, 'model');
  if (!description) out.warnings.push(`${path} has no description`);
  if (instructions === undefined) out.warnings.push(`${path} has no developer_instructions`);
  return {
    id: name,
    name,
    kind: 'custom',
    ...(description ? { description } : {}),
    ...(instructions !== undefined ? { instructions } : {}),
    ...(model ? { model } : {}),
    tools: [],
    skills: [],
    origin: origin(path),
  };
}

/** The project's own instructions: the override first, as Codex reads them. Only files at the root count. */
const rootInstructionsPath = (tree: FileTree) => ['AGENTS.override.md', 'AGENTS.md'].find((p) => tree.has(p));

/**
 * With no root file, the shallowest AGENTS.md still shows Codex is used here, so the primary
 * agent points at it. Its text only covers that folder, so it is not used as the instructions.
 */
function shallowestAgentsMd(tree: FileTree) {
  const files = [...tree.find('**/AGENTS.override.md'), ...tree.find('**/AGENTS.md')];
  const shallowest = Math.min(...files.map(depth));
  return files.find((p) => depth(p) === shallowest);
}

export const codex: Adapter = {
  id: 'codex',
  label: 'Codex',
  detect: (tree) => tree.find('**/AGENTS.md').length > 0 || tree.find('**/AGENTS.override.md').length > 0 || tree.find('**/.codex/**').length > 0,

  async parse(tree) {
    const out = emptyDiscovery();
    const config = tree.has(CONFIG) ? await readToml(tree, CONFIG, out) : undefined;

    // the primary agent
    const mdPath = rootInstructionsPath(tree);
    const md = mdPath ? await tree.read(mdPath) : null;
    const model = config && text(config, 'model');
    out.agents.push({
      id: 'codex',
      name: 'Codex',
      kind: 'primary',
      description: 'The main Codex agent for this project.',
      // through the frontmatter parser for the same BOM and line-ending clean-up as every other file
      ...(md !== null ? { instructions: parseFrontmatter(md).body } : {}),
      ...(model ? { model } : {}),
      tools: [],
      skills: [],
      origin: origin(mdPath ?? shallowestAgentsMd(tree) ?? tree.find('**/.codex/**')[0] ?? CONFIG),
    });

    // standalone agent files
    const read = new Set<string>();
    for (const path of tree.find('**/.codex/agents/*.toml')) {
      read.add(path);
      const agent = await readAgentFile(tree, path, baseName(path, '.toml'), out);
      if (agent) out.agents.push(agent);
    }

    // roles in config.toml: [agents.<name>]; max_threads and other plain settings are skipped
    const roles = config && isTable(config.agents) ? config.agents : {};
    for (const [role, def] of Object.entries(roles)) {
      if (!isTable(def)) continue;
      const file = text(def, 'config_file');
      if (file) {
        const path = resolve('.codex/', file);
        if (read.has(path)) continue;
        read.add(path);
        if (tree.has(path)) {
          const agent = await readAgentFile(tree, path, role, out);
          if (agent) out.agents.push(agent);
          continue;
        }
        out.warnings.push(`${CONFIG} role "${role}" points at ${path}, which is not in the project`);
      }
      const description = text(def, 'description');
      out.agents.push({
        id: role,
        name: role,
        kind: 'custom',
        ...(description ? { description } : {}),
        tools: [],
        skills: [],
        origin: origin(CONFIG),
      });
    }

    // MCP servers
    if (config && isTable(config.mcp_servers)) {
      for (const name of Object.keys(config.mcp_servers)) out.mcpServers.push({ name, origin: origin(CONFIG) });
    }
    return out;
  },
};
