import type { Origin } from '../../data/types';
import type { FileTree } from '../fileTree';
import { normalizePath } from '../fileTree';
import { parseFrontmatter } from '../frontmatter';
import { emptyDiscovery, type Adapter } from '../types';
import { addMcpJson, markdownAgent, markdownCommand, readJson, serverNames } from './shared';

/**
 * Reads a Claude Code project (https://code.claude.com/docs):
 * - the primary agent, from `CLAUDE.md` (or `.claude/CLAUDE.md`) and the model in `.claude/settings.json`
 * - custom agents (subagents) in `.claude/agents/`, at any depth and in subprojects
 * - slash commands in `.claude/commands/`, as skills
 * - MCP servers in `.mcp.json`
 * - plugins: a folder with `.claude-plugin/plugin.json`, whose `agents/`, `commands/` and
 *   MCP servers are namespaced as `plugin:name`
 * `SKILL.md` files are left to the agent-skills adapter.
 */

const origin = (path: string): Origin => ({ platform: 'claude-code', path });

const MANIFEST = '.claude-plugin/plugin.json';

/** Folders that hold a plugin: the folder above each `.claude-plugin/plugin.json`, as '' or 'a/b/'. */
const pluginRoots = (tree: FileTree) => tree.find('**/' + MANIFEST).map((p) => p.slice(0, p.length - MANIFEST.length));

/** True when the project itself (not only plugins it ships) uses Claude Code. */
function usesClaudeCode(tree: FileTree, rootIsPlugin: boolean) {
  return tree.has('CLAUDE.md') || tree.paths.some((p) => p.startsWith('.claude/')) || (!rootIsPlugin && tree.has('.mcp.json'));
}

export const claudeCode: Adapter = {
  id: 'claude-code',
  label: 'Claude Code',
  detect: (tree) =>
    tree.has('CLAUDE.md') ||
    tree.has('.mcp.json') ||
    tree.find('**/.claude/**').length > 0 ||
    tree.find('**/' + MANIFEST).length > 0,

  async parse(tree) {
    const out = emptyDiscovery();
    const plugins = pluginRoots(tree);
    const rootIsPlugin = plugins.includes('');

    // the primary agent
    if (usesClaudeCode(tree, rootIsPlugin)) {
      const settings = tree.has('.claude/settings.json') ? await readJson(tree, '.claude/settings.json', out) : undefined;
      const model = settings && typeof settings.model === 'string' && settings.model.trim() ? settings.model.trim() : undefined;
      const memoryPath = ['CLAUDE.md', '.claude/CLAUDE.md'].find((p) => tree.has(p));
      const memory = memoryPath ? await tree.read(memoryPath) : null;
      // through the frontmatter parser for the same BOM and line-ending clean-up as every other file
      const instructions = memory === null ? null : parseFrontmatter(memory).body;
      out.agents.push({
        id: 'claude-code',
        name: 'Claude Code',
        kind: 'primary',
        description: 'The main Claude Code agent for this project.',
        ...(instructions !== null ? { instructions } : {}),
        ...(model ? { model } : {}),
        tools: [],
        skills: [],
        origin: origin(memoryPath ?? tree.paths.find((p) => p.startsWith('.claude/')) ?? '.mcp.json'),
      });
    }

    // custom agents and slash commands in .claude/
    for (const path of tree.find('**/.claude/agents/**/*.md')) {
      const agent = await markdownAgent(tree, path, 'claude-code', '', out);
      if (agent) out.agents.push(agent);
    }
    for (const path of tree.find('**/.claude/commands/**/*.md')) {
      const skill = await markdownCommand(tree, path, 'claude-code', '', out);
      if (skill) out.skills.push(skill);
    }
    if (!rootIsPlugin && tree.has('.mcp.json')) await addMcpJson(tree, '.mcp.json', 'claude-code', '', out);

    // plugins
    for (const root of plugins) {
      const manifestPath = root + MANIFEST;
      const manifest = await readJson(tree, manifestPath, out);
      const name = (typeof manifest?.name === 'string' && manifest.name.trim()) || root.split('/').at(-2) || 'plugin';
      const prefix = name + ':';
      for (const path of tree.find(root + 'agents/*.md')) {
        const agent = await markdownAgent(tree, path, 'claude-code', prefix, out);
        if (agent) out.agents.push(agent);
      }
      for (const path of tree.find(root + 'commands/**/*.md')) {
        const skill = await markdownCommand(tree, path, 'claude-code', prefix, out);
        if (skill) out.skills.push(skill);
      }
      // MCP servers inline in plugin.json, or in a file it points to, plus the plugin's .mcp.json
      const inline = manifest?.mcpServers;
      if (typeof inline === 'string') {
        const path = normalizePath(root + inline);
        if (tree.has(path)) await addMcpJson(tree, path, 'claude-code', prefix, out);
      } else {
        for (const server of serverNames(inline)) out.mcpServers.push({ name: prefix + server, origin: origin(manifestPath) });
      }
      if (tree.has(root + '.mcp.json')) await addMcpJson(tree, root + '.mcp.json', 'claude-code', prefix, out);
    }
    return out;
  },
};
