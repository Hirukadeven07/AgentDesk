import type { Origin } from '../../data/types';
import { emptyDiscovery, type Adapter } from '../types';
import { folderNames, isTable, readJson, readText, resolvePath } from './shared';

/**
 * Reads LangGraph apps (https://docs.langchain.com/oss/python/langgraph/application-structure):
 * `langgraph.json` lists `graphs`, each a name pointing at code as `./path/file.py:variable`
 * (or `{ path, description }`). Each graph is a custom agent. From the graph's file it takes:
 * - the description: the file's opening docstring or comment, when langgraph.json has none
 * - the nodes (`add_node("x", …)` / `.addNode("x", …)`), listed in the instructions
 * - the tools: functions marked `@tool` in that file
 * This only matches text in the file; it never runs the code. A monorepo with several
 * `langgraph.json` files names each graph `<folder>:<graph>`.
 */

const PLATFORM = 'langgraph';
const CONFIG = 'langgraph.json';
const origin = (path: string): Origin => ({ platform: PLATFORM, path });
const unique = (xs: string[]) => [...new Set(xs)];

/** The opening docstring (Python) or block comment (JS/TS), its nodes, and its `@tool` functions. */
export function graphSource(source: string): { doc?: string; nodes: string[]; tools: string[] } {
  const py = /^\s*(?:#[^\n]*\n\s*)*(?:"""|''')([\s\S]*?)(?:"""|''')/.exec(source)?.[1];
  const js = /^\s*\/\*\*?([\s\S]*?)\*\//.exec(source)?.[1]?.replace(/^\s*\*\s?/gm, '');
  const doc = (py ?? js)?.split('\n').map((l) => l.trim()).find(Boolean);
  // add_node("name", fn), or add_node(fn), which LangGraph names after the function
  const nodes = unique([...source.matchAll(/\.(?:add_node|addNode)\(\s*(?:["']([^"']+)["']|([A-Za-z_]\w*)\s*[,)])/g)].map((m) => m[1] ?? m[2]));
  // @tool, or @tool("name", …), right above a def; a name given to the decorator wins
  const tools = unique([...source.matchAll(/@tool(?:\(\s*["']([^"']+)["'][^)]*\)|\([^)]*\))?\s*\n\s*(?:async\s+)?def\s+(\w+)/g)].map((m) => m[1] ?? m[2]));
  return { ...(doc ? { doc } : {}), nodes, tools };
}

export const langgraph: Adapter = {
  id: PLATFORM,
  label: 'LangGraph',
  detect: (tree) => tree.find('**/' + CONFIG).length > 0,

  async parse(tree) {
    const out = emptyDiscovery();
    const configs = tree.find('**/' + CONFIG);
    const roots = configs.map((p) => p.slice(0, p.length - CONFIG.length));
    const names = folderNames(roots, 'app');

    for (const root of roots) {
      const configPath = root + CONFIG;
      const config = await readJson(tree, configPath, out);
      if (!config) continue;
      if (!isTable(config.graphs) || !Object.keys(config.graphs).length) {
        out.warnings.push(`${configPath} has no graphs`);
        continue;
      }
      const prefix = roots.length > 1 ? names.get(root)! + ':' : '';
      for (const [name, def] of Object.entries(config.graphs)) {
        const ref = typeof def === 'string' ? def : isTable(def) && typeof def.path === 'string' ? def.path : undefined;
        const given = isTable(def) && typeof def.description === 'string' ? def.description.trim() : undefined;
        // "./src/agent/graph.py:graph" → the file before the last colon, relative to langgraph.json
        const file = ref ? resolvePath(root, ref.includes(':') ? ref.slice(0, ref.lastIndexOf(':')) : ref) : undefined;
        let source: ReturnType<typeof graphSource> = { nodes: [], tools: [] };
        if (file && tree.has(file)) {
          const text = await readText(tree, file, out);
          if (text !== null) source = graphSource(text);
        } else if (file) {
          out.warnings.push(`${configPath}: graph "${name}" points at ${file}, which is not in the project`);
        }
        const description = given || source.doc;
        out.agents.push({
          id: prefix + name,
          name,
          kind: 'custom',
          ...(description ? { description } : {}),
          ...(source.nodes.length ? { instructions: `Graph nodes: ${source.nodes.join(' → ')}\n` } : {}),
          tools: source.tools,
          skills: [],
          origin: origin(file && tree.has(file) ? file : configPath),
        });
      }
    }
    return out;
  },
};
