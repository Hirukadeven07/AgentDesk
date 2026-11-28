import type { Origin } from '../../data/types';
import type { FileTree } from '../fileTree';
import { parseFrontmatter } from '../frontmatter';
import { emptyDiscovery, type Adapter, type DiscoveredAgent, type Discovery } from '../types';
import { firstLine, isTable, markdownAgent, readJson, readText, readToml, serverNames, type Table } from './shared';

/**
 * Reads a Gemini CLI project (https://geminicli.com/docs):
 * - the primary agent, from the root context file (`GEMINI.md`, or `context.fileName` in settings)
 *   and the model in `.gemini/settings.json` (`model.name`, or a plain string in the older format)
 * - custom commands in `.gemini/commands/**.toml`, as skills, namespaced by folder (`git/commit.toml` → `git:commit`)
 * - subagents in `.gemini/agents/*.md`
 * - MCP servers in `.gemini/settings.json`
 * - extensions (a folder with `gemini-extension.json`): their commands, agents and MCP servers
 * `.gemini/skills/` is left to the agent-skills adapter.
 */

const PLATFORM = 'gemini-cli';
const SETTINGS = '.gemini/settings.json';
const MANIFEST = 'gemini-extension.json';
const origin = (path: string): Origin => ({ platform: PLATFORM, path });
const depth = (path: string) => path.split('/').length;

/** A string or a list of strings, as `context.fileName` allows. */
const names = (v: unknown) => (typeof v === 'string' ? [v] : Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** The context file names Gemini CLI reads: from settings (new or older format), else GEMINI.md. */
function contextFileNames(settings: Table | undefined) {
  const fromSettings = [...names(isTable(settings?.context) ? settings.context.fileName : undefined), ...names(settings?.contextFileName)];
  return fromSettings.length ? fromSettings : ['GEMINI.md'];
}

/** The model from settings: `model.name`, or `model` as a string in the older format. */
function modelOf(settings: Table | undefined) {
  const m = settings?.model;
  const name = typeof m === 'string' ? m : isTable(m) && typeof m.name === 'string' ? m.name : undefined;
  return name?.trim() || undefined;
}

/** Every command in a `commands/` folder, as a skill named after its path: `git/commit.toml` → `git:commit`. */
async function addCommands(tree: FileTree, commandsDir: string, out: Discovery) {
  for (const path of tree.find(commandsDir + '**/*.toml')) {
    const t = await readToml(tree, path, out);
    if (!t) continue;
    if (typeof t.prompt !== 'string' || !t.prompt.trim()) {
      out.warnings.push(`${path} has no prompt`);
      continue;
    }
    const description = typeof t.description === 'string' && t.description.trim() ? t.description.trim() : firstLine(t.prompt);
    out.skills.push({
      id: path.slice(commandsDir.length, -'.toml'.length).split('/').join(':'),
      description,
      instructions: t.prompt,
      files: [],
      origin: origin(path),
    });
  }
}

async function addAgents(tree: FileTree, agentsDir: string, agents: DiscoveredAgent[], out: Discovery) {
  for (const path of tree.find(agentsDir + '*.md')) {
    const agent = await markdownAgent(tree, path, PLATFORM, '', out);
    if (agent) agents.push(agent);
  }
}

export const geminiCli: Adapter = {
  id: PLATFORM,
  label: 'Gemini CLI',
  detect: (tree) => tree.find('**/GEMINI.md').length > 0 || tree.find('**/.gemini/**').length > 0 || tree.find('**/' + MANIFEST).length > 0,

  async parse(tree) {
    const out = emptyDiscovery();
    const extensions = tree.find('**/' + MANIFEST).map((p) => p.slice(0, p.length - MANIFEST.length));
    const rootIsExtension = extensions.includes('');
    const settings = tree.has(SETTINGS) ? await readJson(tree, SETTINGS, out) : undefined;
    const agents: DiscoveredAgent[] = [];

    // the project's own setup, unless the repo is itself an extension
    if (!rootIsExtension) {
      await addCommands(tree, '.gemini/commands/', out);
      await addAgents(tree, '.gemini/agents/', agents, out);
      for (const name of serverNames(settings?.mcpServers)) out.mcpServers.push({ name, origin: origin(SETTINGS) });
    }

    // extensions: their commands keep plain names (/deploy), as Gemini CLI shows them
    for (const root of extensions) {
      const manifestPath = root + MANIFEST;
      const manifest = await readJson(tree, manifestPath, out);
      await addCommands(tree, root + 'commands/', out);
      await addAgents(tree, root + 'agents/', agents, out);
      for (const name of serverNames(manifest?.mcpServers)) out.mcpServers.push({ name, origin: origin(manifestPath) });
    }

    // the primary agent: only the root context file is the project's; a nested one only covers its folder
    const contextPath = rootIsExtension ? undefined : contextFileNames(settings).find((n) => tree.has(n));
    const nested = tree.find('**/GEMINI.md').filter((p) => !extensions.some((root) => root && p.startsWith(root)));
    const usesGemini = !rootIsExtension && (contextPath !== undefined || tree.paths.some((p) => p.startsWith('.gemini/')) || nested.length > 0);
    if (usesGemini) {
      const text = contextPath ? await readText(tree, contextPath, out) : null;
      const model = modelOf(settings);
      const shallowest = nested.sort((a, b) => depth(a) - depth(b))[0];
      out.agents.push({
        id: PLATFORM,
        name: 'Gemini CLI',
        kind: 'primary',
        description: 'The main Gemini CLI agent for this project.',
        ...(text !== null ? { instructions: parseFrontmatter(text).body } : {}),
        ...(model ? { model } : {}),
        tools: [],
        skills: [],
        origin: origin(contextPath ?? shallowest ?? tree.paths.find((p) => p.startsWith('.gemini/')) ?? SETTINGS),
      });
    }
    out.agents.push(...agents);
    return out;
  },
};
