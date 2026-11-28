import { parse } from 'yaml';
import type { Origin } from '../../data/types';
import type { FileTree } from '../fileTree';
import { asList, asString } from '../frontmatter';
import { emptyDiscovery, type Adapter, type DiscoveredAgent, type DiscoveredSkill, type Discovery } from '../types';
import { isTable, readText, type Table } from './shared';

/**
 * Reads CrewAI crews (https://docs.crewai.com): a `config/` folder with `agents.yaml` (agents by
 * name, with `role`, `goal`, `backstory`, and optionally `llm` and `tools`) and `tasks.yaml` (tasks
 * with `description`, `expected_output` and the `agent` that runs them).
 * - each agent is a custom agent; its tasks are its skills
 * - each task is a skill
 * A project with several crews (a CrewAI flow) names everything `<crew>:<name>`.
 * A `config/agents.yaml` only counts when `tasks.yaml` or `crew.py` sits beside it, since many
 * projects have a config file by that name.
 */

const PLATFORM = 'crewai';
const origin = (path: string): Origin => ({ platform: PLATFORM, path });

/** Folders holding a crew: the folder above each `config/` with `agents.yaml`, as '' or 'a/b/'. */
function crewRoots(tree: FileTree) {
  return tree
    .find('**/config/agents.y*ml')
    .filter((p) => /\.ya?ml$/.test(p))
    .map((p) => p.slice(0, p.lastIndexOf('config/')))
    .filter((root) => ['config/tasks.yaml', 'config/tasks.yml', 'crew.py'].some((f) => tree.has(root + f)));
}

/**
 * A short name for each crew: its folder name, or as much of its folder path as it takes to tell
 * it apart from another crew with the same folder name. A crew at the project root is `crew`.
 */
export function crewNames(roots: string[]): Map<string, string> {
  const parts = new Map(roots.map((r) => [r, r.split('/').filter(Boolean)]));
  const names = new Map<string, string>();
  for (const root of roots) {
    const mine = parts.get(root)!;
    if (!mine.length) {
      names.set(root, 'crew');
      continue;
    }
    let n = 1;
    const suffix = (p: string[], k: number) => p.slice(-k).join('/');
    while (n < mine.length && roots.some((other) => other !== root && suffix(parts.get(other)!, n) === suffix(mine, n))) n++;
    names.set(root, suffix(mine, n));
  }
  return names;
}

/** The first sentence of a description, at most 200 characters. */
const firstSentence = (text: string) => (text.split(/(?<=[.!?])\s/)[0] ?? '').trim().slice(0, 200);

/**
 * Which agent runs each task, from `crew.py`, for tasks whose YAML doesn't say. CrewAI's usual
 * pattern pairs `config=self.tasks_config['x']` with `agent=self.y()` inside one `@task` method.
 * This only matches that text; it never runs the code.
 */
export function crewPyAssignments(source: string): Map<string, string> {
  const found = new Map<string, string>();
  const tasks = [...source.matchAll(/tasks_config\[\s*['"](\w+)['"]\s*\]/g)];
  tasks.forEach((m, i) => {
    // look only until the next task method starts, so one task can't take another's agent
    const start = m.index! + m[0].length;
    const next = source.slice(start).search(/@task\b|\n\s*def\s/);
    const end = Math.min(next === -1 ? source.length : start + next, tasks[i + 1]?.index ?? source.length);
    const agent = /agent\s*=\s*self\.(\w+)\s*\(/.exec(source.slice(start, end));
    if (agent) found.set(m[1], agent[1]);
  });
  return found;
}

/**
 * Which `agents.yaml` key each agent method in `crew.py` loads, for methods named differently
 * from their key: `def senior_idea_analyst_agent(self)` with `agents_config['senior_idea_analyst']`.
 */
export function crewPyAgentMethods(source: string): Map<string, string> {
  const found = new Map<string, string>();
  const defs = [...source.matchAll(/def\s+(\w+)\s*\(\s*self\b/g)];
  defs.forEach((m, i) => {
    const body = source.slice(m.index!, defs[i + 1]?.index ?? source.length);
    const key = /agents_config\[\s*['"](\w+)['"]\s*\]/.exec(body);
    if (key) found.set(m[1], key[1]);
  });
  return found;
}

async function readYamlMap(tree: FileTree, root: string, name: string, out: Discovery): Promise<{ path: string; map: Table } | undefined> {
  const path = ['yaml', 'yml'].map((ext) => `${root}config/${name}.${ext}`).find((p) => tree.has(p));
  if (!path) return undefined;
  const text = await readText(tree, path, out);
  if (text === null) return undefined;
  try {
    const doc: unknown = parse(text, { schema: 'core' });
    return { path, map: isTable(doc) ? doc : {} };
  } catch (e) {
    out.warnings.push(`${path} is not valid YAML: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`);
    return undefined;
  }
}

export const crewai: Adapter = {
  id: PLATFORM,
  label: 'CrewAI',
  detect: (tree) => crewRoots(tree).length > 0,

  async parse(tree) {
    const out = emptyDiscovery();
    const roots = crewRoots(tree);
    const names = crewNames(roots);
    for (const root of roots) {
      // with several crews, names get the crew's name in front, as a CrewAI flow organises them
      const prefix = roots.length > 1 ? names.get(root)! + ':' : '';
      const agentsFile = await readYamlMap(tree, root, 'agents', out);
      const tasksFile = await readYamlMap(tree, root, 'tasks', out);

      const agents = new Map<string, DiscoveredAgent>();
      for (const [key, def] of Object.entries(agentsFile?.map ?? {})) {
        if (!isTable(def)) continue;
        const role = asString(def, 'role');
        const goal = asString(def, 'goal');
        const backstory = asString(def, 'backstory');
        if (!role) out.warnings.push(`${agentsFile!.path}: agent "${key}" has no role`);
        const llm = asString(def, 'llm');
        const parts = [role && `Role: ${role}`, goal && `Goal: ${goal}`, backstory && `Backstory: ${backstory}`].filter(Boolean);
        agents.set(key, {
          id: prefix + key,
          name: key,
          kind: 'custom',
          ...(role ? { description: role } : {}),
          ...(parts.length ? { instructions: parts.join('\n\n') + '\n' } : {}),
          ...(llm ? { model: llm } : {}),
          tools: asList(def, 'tools'),
          skills: [],
          origin: origin(agentsFile!.path),
        });
      }

      // crew.py says which agent runs a task when tasks.yaml doesn't
      const crewPy = tree.has(root + 'crew.py') ? await readText(tree, root + 'crew.py', out) : null;
      const assigned = crewPy ? crewPyAssignments(crewPy) : new Map<string, string>();
      const methods = crewPy ? crewPyAgentMethods(crewPy) : new Map<string, string>();
      /** crew.py names an agent by its method; that method may load a differently named key. */
      const fromCrewPy = (task: string) => {
        const method = assigned.get(task);
        return method === undefined ? undefined : (methods.get(method) ?? method);
      };

      const skills: DiscoveredSkill[] = [];
      for (const [key, def] of Object.entries(tasksFile?.map ?? {})) {
        if (!isTable(def)) continue;
        const description = asString(def, 'description') ?? '';
        const expected = asString(def, 'expected_output');
        const owner = asString(def, 'agent') ?? fromCrewPy(key);
        if (owner && agents.has(owner)) agents.get(owner)!.skills.push(prefix + key);
        else if (owner) out.warnings.push(`${tasksFile!.path}: task "${key}" is for agent "${owner}", which is not in agents.yaml`);
        skills.push({
          id: prefix + key,
          description: firstSentence(description),
          instructions: [description, expected && `Expected output: ${expected}`].filter(Boolean).join('\n\n') + '\n',
          files: [],
          origin: origin(tasksFile!.path),
        });
      }
      out.agents.push(...agents.values());
      out.skills.push(...skills);
    }
    return out;
  },
};
