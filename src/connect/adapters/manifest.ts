import type { Origin } from '../../data/types';
import { asList, asString } from '../frontmatter';
import { emptyDiscovery, type Adapter, type DiscoveredAgent } from '../types';
import { isTable, readJson } from './shared';

/**
 * Reads `agentsdeck.json` manifests (docs/manifest.md, schema in public/agentsdeck.schema.json):
 * agents, skills and MCP servers described by hand, for cloud agents and any platform without
 * an adapter. Every problem is a warning; everything that is fine is still shown.
 */

const PLATFORM = 'manifest';
const FILE = 'agentsdeck.json';

/** The description with where the agent runs added: "Answers tickets. Runs on Amazon Bedrock." */
function describe(description: string | undefined, provider: string | undefined) {
  const runsOn = provider ? `Runs on ${provider}.` : undefined;
  if (!description) return runsOn;
  if (!runsOn) return description;
  return `${/[.!?]$/.test(description) ? description : description + '.'} ${runsOn}`;
}

export const manifest: Adapter = {
  id: PLATFORM,
  label: 'AgentsDeck manifest',
  detect: (tree) => tree.find('**/' + FILE).length > 0,

  async parse(tree) {
    const out = emptyDiscovery();
    for (const path of tree.find('**/' + FILE)) {
      const doc = await readJson(tree, path, out);
      if (!doc) continue;
      const origin: Origin = { platform: PLATFORM, path };
      const warn = (msg: string) => out.warnings.push(`${path}: ${msg}`);
      if (doc.version !== 1) warn('version should be 1');

      const seen = new Set<string>();
      const list = (key: string) => (Array.isArray(doc[key]) ? (doc[key] as unknown[]) : []);

      list('agents').forEach((a, i) => {
        if (!isTable(a)) return warn(`agent ${i + 1} is not an object`);
        const id = asString(a, 'id');
        if (!id) return warn(`agent ${i + 1} has no id`);
        if (seen.has('agent:' + id)) return warn(`agent "${id}" appears more than once`);
        seen.add('agent:' + id);
        const description = describe(asString(a, 'description'), asString(a, 'provider'));
        const instructions = asString(a, 'instructions');
        const model = asString(a, 'model');
        const agent: DiscoveredAgent = {
          id,
          name: asString(a, 'name') ?? id,
          kind: a.kind === 'primary' ? 'primary' : 'custom',
          ...(description ? { description } : {}),
          ...(instructions ? { instructions } : {}),
          ...(model ? { model } : {}),
          tools: asList(a, 'tools'),
          skills: asList(a, 'skills'),
          origin,
        };
        out.agents.push(agent);
      });

      list('skills').forEach((s, i) => {
        if (!isTable(s)) return warn(`skill ${i + 1} is not an object`);
        const id = asString(s, 'id');
        if (!id) return warn(`skill ${i + 1} has no id`);
        if (seen.has('skill:' + id)) return warn(`skill "${id}" appears more than once`);
        seen.add('skill:' + id);
        const description = asString(s, 'description');
        if (!description) warn(`skill "${id}" has no description`);
        out.skills.push({ id, description: description ?? '', instructions: asString(s, 'instructions') ?? '', files: [], origin });
      });

      list('mcpServers').forEach((m, i) => {
        if (typeof m === 'string' && m.trim()) out.mcpServers.push({ name: m.trim(), origin });
        else warn(`mcpServers ${i + 1} is not a name`);
      });
    }
    return out;
  },
};
