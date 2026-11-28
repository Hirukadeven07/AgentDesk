import type { Origin } from '../../data/types';
import type { FileTree } from '../fileTree';
import { asList, asString, parseFrontmatter } from '../frontmatter';
import { emptyDiscovery, type Adapter } from '../types';
import { addMcpJson, baseName, dirOf, firstLine, markdownAgent, markdownCommand, readLenientMarkdown, readText } from './shared';

/**
 * Reads a Cursor project (https://cursor.com/docs):
 * - rules in `.cursor/rules/` (`.mdc`, `.md`, or a folder with `RULE.md`), with `description`,
 *   `globs` and `alwaysApply`. Always-applied rules at the root, plus the older `.cursorrules`,
 *   are the primary agent's instructions. Every other rule is shown as a skill.
 * - custom agents in `.cursor/agents/*.md`
 * - commands in `.cursor/commands/`, as skills
 * - MCP servers in `.cursor/mcp.json`
 * `AGENTS.md` is read by the Codex adapter and `.cursor/skills/` by the agent-skills adapter.
 */

const PLATFORM = 'cursor';
const origin = (path: string): Origin => ({ platform: PLATFORM, path });
const isRuleFile = (path: string) => /\.(mdc|md)$/i.test(path);

/** A rule's name: its file name, or its folder's name for `<name>/RULE.md`. */
function ruleName(path: string) {
  if (/\/RULE\.md$/i.test(path)) return dirOf(path).split('/').at(-2)!;
  return baseName(baseName(path, '.mdc'), '.md');
}

/** `alwaysApply: true`, also when written as the string "true". */
const isAlways = (data: Record<string, unknown>) => data.alwaysApply === true || asString(data, 'alwaysApply')?.toLowerCase() === 'true';

/** The folder a rule applies under: where its `.cursor/` folder sits, '' at the project root. */
const ruleScope = (path: string) => path.slice(0, path.indexOf('.cursor/rules/'));

export const cursor: Adapter = {
  id: PLATFORM,
  label: 'Cursor',
  detect: (tree) => tree.find('**/.cursor/**').length > 0 || tree.find('**/.cursorrules').length > 0,

  async parse(tree) {
    const out = emptyDiscovery();
    const primary: string[] = [];
    let primaryOrigin: string | undefined;

    // the older single-file rules
    if (tree.has('.cursorrules')) {
      const text = await readText(tree, '.cursorrules', out);
      if (text !== null) {
        primary.push(parseFrontmatter(text).body);
        primaryOrigin = '.cursorrules';
      }
    }

    // rules: always-applied ones at the root go to the primary agent, the rest become skills
    for (const path of tree.find('**/.cursor/rules/**').filter(isRuleFile)) {
      const rule = await readLenientMarkdown(tree, path, out);
      if (!rule) continue;
      const { data, body } = rule;
      const name = ruleName(path);
      const scope = ruleScope(path);
      if (isAlways(data) && scope === '') {
        primary.push(`# ${name} (${path})\n\n${body}`);
        primaryOrigin ??= path;
        continue;
      }
      const globs = asList(data, 'globs');
      const description =
        asString(data, 'description') ??
        (isAlways(data) ? `Always applies in ${scope}` : undefined) ??
        (globs.length ? `Applies to ${globs.join(', ')}` : undefined) ??
        (firstLine(body) || `Applied when mentioned as @${name}`);
      out.skills.push({ id: name, description, instructions: body, files: [], origin: origin(path) });
    }

    // custom agents and commands
    const agents = [];
    for (const path of tree.find('**/.cursor/agents/*.md')) {
      const agent = await markdownAgent(tree, path, PLATFORM, '', out);
      if (agent) agents.push(agent);
    }
    for (const path of tree.find('**/.cursor/commands/**/*.md')) {
      const command = await markdownCommand(tree, path, PLATFORM, '', out);
      if (command) out.skills.push(command);
    }
    if (tree.has('.cursor/mcp.json')) await addMcpJson(tree, '.cursor/mcp.json', PLATFORM, '', out);

    out.agents.push(
      {
        id: PLATFORM,
        name: 'Cursor',
        kind: 'primary',
        description: 'The main Cursor agent for this project.',
        ...(primary.length ? { instructions: primary.join('\n') } : {}),
        tools: [],
        skills: [],
        origin: origin(primaryOrigin ?? firstCursorFile(tree)),
      },
      ...agents,
    );
    return out;
  },
};

/** Where the primary agent points when it has no instructions: the first Cursor file found. */
const firstCursorFile = (tree: FileTree) => tree.find('**/.cursor/**')[0] ?? tree.find('**/.cursorrules')[0] ?? '.cursor';
