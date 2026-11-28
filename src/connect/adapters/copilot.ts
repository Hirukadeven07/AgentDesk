import type { Origin } from '../../data/types';
import type { FileTree } from '../fileTree';
import { asString, parseFrontmatter } from '../frontmatter';
import { emptyDiscovery, type Adapter } from '../types';
import { firstLine, markdownAgent, readJson, readMarkdown, readText, serverNames } from './shared';

/**
 * Reads GitHub Copilot customizations (https://docs.github.com/copilot, https://code.visualstudio.com/docs):
 * - the primary agent, from `.github/copilot-instructions.md` plus instructions files with `applyTo: "**"`
 * - custom agents in `.github/agents/` (`.agent.md`) and the older chat modes in `.github/chatmodes/`
 * - other `.github/instructions/*.instructions.md` and `.github/prompts/*.prompt.md`, as skills
 * - MCP servers in the `servers` key of `.vscode/mcp.json`
 * `AGENTS.md` is read by the Codex adapter and `.github/skills/` by the agent-skills adapter.
 */

const PLATFORM = 'copilot';
const INSTRUCTIONS = '.github/copilot-instructions.md';
const origin = (path: string): Origin => ({ platform: PLATFORM, path });

/** A file's name without its folder or its Copilot suffix: `planner.agent.md` → `planner`. */
const stem = (path: string) =>
  path.slice(path.lastIndexOf('/') + 1).replace(/\.(agent|chatmode|prompt|instructions)\.md$/i, '').replace(/\.md$/i, '');

/** `applyTo` as a list of globs. It is one comma-separated string in Copilot's format. */
const applyTo = (data: Record<string, unknown>) =>
  (asString(data, 'applyTo') ?? '').split(',').map((g) => g.trim()).filter(Boolean);

/** Instructions for every file go with the primary agent, like Cursor's always-applied rules. */
const appliesEverywhere = (globs: string[]) => globs.some((g) => g === '**' || g === '**/*');

const copilotFiles = (tree: FileTree) => [
  ...tree.find(INSTRUCTIONS),
  ...tree.find('.github/agents/*.md'),
  ...tree.find('.github/chatmodes/*.chatmode.md'),
  ...tree.find('.github/instructions/**/*.instructions.md'),
  ...tree.find('.github/prompts/**/*.prompt.md'),
  ...tree.find('.github/skills/**'),
  ...tree.find('.vscode/mcp.json'),
];

export const copilot: Adapter = {
  id: PLATFORM,
  label: 'GitHub Copilot',
  detect: (tree) => copilotFiles(tree).length > 0,

  async parse(tree) {
    const out = emptyDiscovery();
    const primary: string[] = [];
    let primaryOrigin: string | undefined;

    if (tree.has(INSTRUCTIONS)) {
      const text = await readText(tree, INSTRUCTIONS, out);
      if (text !== null) {
        primary.push(parseFrontmatter(text).body);
        primaryOrigin = INSTRUCTIONS;
      }
    }

    // path-specific instructions: for every file → primary agent, otherwise a skill
    for (const path of tree.find('.github/instructions/**/*.instructions.md')) {
      const fm = await readMarkdown(tree, path, out);
      if (!fm) continue;
      const name = stem(path);
      const globs = applyTo(fm.data);
      if (appliesEverywhere(globs)) {
        primary.push(`# ${name} (${path})\n\n${fm.body}`);
        primaryOrigin ??= path;
        continue;
      }
      const description =
        asString(fm.data, 'description') ?? (globs.length ? `Applies to ${globs.join(', ')}` : undefined) ?? firstLine(fm.body);
      out.skills.push({ id: name, description, instructions: fm.body, files: [], origin: origin(path) });
    }

    // prompt files, as skills
    for (const path of tree.find('.github/prompts/**/*.prompt.md')) {
      const fm = await readMarkdown(tree, path, out);
      if (!fm) continue;
      out.skills.push({
        id: stem(path),
        description: asString(fm.data, 'description') ?? firstLine(fm.body),
        instructions: fm.body,
        files: [],
        origin: origin(path),
      });
    }

    // custom agents, then the older chat modes
    const agents = [];
    for (const path of [...tree.find('.github/agents/*.md'), ...tree.find('.github/chatmodes/*.chatmode.md')]) {
      const agent = await markdownAgent(tree, path, PLATFORM, '', out, stem(path));
      if (agent) agents.push(agent);
    }

    // VS Code keeps MCP servers under "servers", not "mcpServers"
    if (tree.has('.vscode/mcp.json')) {
      const json = await readJson(tree, '.vscode/mcp.json', out);
      for (const name of serverNames(json?.servers)) out.mcpServers.push({ name, origin: origin('.vscode/mcp.json') });
    }

    out.agents.push(
      {
        id: PLATFORM,
        name: 'GitHub Copilot',
        kind: 'primary',
        description: 'The main GitHub Copilot agent for this project.',
        ...(primary.length ? { instructions: primary.join('\n') } : {}),
        tools: [],
        skills: [],
        origin: origin(primaryOrigin ?? copilotFiles(tree)[0] ?? INSTRUCTIONS),
      },
      ...agents,
    );
    return out;
  },
};
