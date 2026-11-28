import { parse } from 'yaml';
import type { Origin } from '../../data/types';
import type { FileTree } from '../fileTree';
import { emptyDiscovery, type Adapter, type Discovery } from '../types';
import { addMcpJson, isTable, markdownCommand, readText } from './shared';

/**
 * Reads a Roo Code project (https://docs.roocode.com):
 * - the primary agent, from the older `.roorules` plus every file in `.roo/rules/`, in name order
 * - custom modes in `.roomodes` (YAML or JSON `customModes`), as custom agents: `roleDefinition`,
 *   `customInstructions` and that mode's rules (`.roo/rules-<slug>/`, `.roorules-<slug>`), with
 *   `whenToUse` as the description and the tool `groups` as tools
 * - rules for a built-in mode that `.roomodes` does not define (`.roo/rules-code/`), as a skill
 * - commands in `.roo/commands/*.md`, as skills
 * - MCP servers in `.roo/mcp.json`
 * Rule folders hold any text file (Roo Code's own repo uses `.xml`), so every file is read.
 */

const PLATFORM = 'roo-code';
const ROOMODES = '.roomodes';
const origin = (path: string): Origin => ({ platform: PLATFORM, path });
const clean = (text: string) => text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
const fileStem = (path: string) => path.slice(path.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '');

/** Parts joined with one blank line between them, ending in a newline. */
const joinSections = (parts: string[]) => parts.map((p) => p.trim()).filter(Boolean).join('\n\n') + '\n';

/**
 * An older single rules file, then every file in a rules folder, each as a `# name (path)` section.
 * `legacyHeading: false` leaves the single file's text bare, for when it is the main instructions.
 */
async function ruleSections(tree: FileTree, folder: string, legacyFile: string, out: Discovery, legacyHeading = true) {
  const sections: { path: string; text: string }[] = [];
  if (tree.has(legacyFile)) {
    const text = await readText(tree, legacyFile, out);
    if (text !== null) sections.push({ path: legacyFile, text: legacyHeading ? `# ${legacyFile}\n\n${clean(text)}` : clean(text) });
  }
  for (const path of tree.find(folder + '**')) {
    const text = await readText(tree, path, out);
    if (text !== null) sections.push({ path, text: `# ${fileStem(path)} (${path})\n\n${clean(text)}` });
  }
  return sections;
}

/** The tool groups of a mode: `read`, or `[edit, { fileRegex }]` for a limited group. */
const groupNames = (groups: unknown) =>
  Array.isArray(groups)
    ? groups.flatMap((g) => (typeof g === 'string' ? [g] : Array.isArray(g) && typeof g[0] === 'string' ? [g[0]] : []))
    : [];

const str = (t: Record<string, unknown>, key: string) => (typeof t[key] === 'string' && (t[key] as string).trim() ? (t[key] as string).trim() : undefined);

export const rooCode: Adapter = {
  id: PLATFORM,
  label: 'Roo Code',
  detect: (tree) => tree.has(ROOMODES) || tree.find('**/.roo/**').length > 0 || tree.paths.some((p) => /^\.roorules(-[\w-]+)?$/.test(p)),

  async parse(tree) {
    const out = emptyDiscovery();

    // the primary agent: .roorules (the older single file) is applied first, then .roo/rules/
    const primary = await ruleSections(tree, '.roo/rules/', '.roorules', out, false);

    // custom modes
    let modes: Record<string, unknown>[] = [];
    if (tree.has(ROOMODES)) {
      const text = await readText(tree, ROOMODES, out);
      if (text !== null) {
        try {
          const doc: unknown = parse(text, { schema: 'core' });
          const list = isTable(doc) ? doc.customModes : undefined;
          modes = Array.isArray(list) ? list.filter(isTable) : [];
        } catch (e) {
          out.warnings.push(`${ROOMODES} is not valid YAML or JSON: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`);
        }
      }
    }
    const agents = [];
    const defined = new Set<string>();
    for (const mode of modes) {
      const slug = str(mode, 'slug');
      if (!slug) {
        out.warnings.push(`${ROOMODES} has a mode with no slug`);
        continue;
      }
      defined.add(slug);
      const rules = await ruleSections(tree, `.roo/rules-${slug}/`, `.roorules-${slug}`, out);
      const description = str(mode, 'whenToUse') ?? str(mode, 'description');
      agents.push({
        id: slug,
        name: str(mode, 'name') ?? slug,
        kind: 'custom' as const,
        ...(description ? { description } : {}),
        instructions: joinSections([str(mode, 'roleDefinition') ?? '', str(mode, 'customInstructions') ?? '', ...rules.map((r) => r.text)]),
        tools: groupNames(mode.groups),
        skills: [],
        origin: origin(ROOMODES),
      });
    }

    // rules for built-in modes (code, architect, …) that .roomodes does not define
    const builtIn = new Set(
      tree.paths.flatMap((p) => /^\.roo\/rules-([\w-]+)\//.exec(p)?.[1] ?? /^\.roorules-([\w-]+)$/.exec(p)?.[1] ?? []).filter((s) => !defined.has(s)),
    );
    for (const slug of [...builtIn].sort()) {
      const rules = await ruleSections(tree, `.roo/rules-${slug}/`, `.roorules-${slug}`, out);
      if (!rules.length) continue;
      out.skills.push({
        id: `rules-${slug}`,
        description: `Extra rules for the ${slug} mode`,
        instructions: joinSections(rules.map((r) => r.text)),
        files: [],
        origin: origin(rules[0].path),
      });
    }

    for (const path of tree.find('.roo/commands/*.md')) {
      const command = await markdownCommand(tree, path, PLATFORM, '', out);
      if (command) out.skills.push(command);
    }
    if (tree.has('.roo/mcp.json')) await addMcpJson(tree, '.roo/mcp.json', PLATFORM, '', out);

    out.agents.push(
      {
        id: PLATFORM,
        name: 'Roo Code',
        kind: 'primary',
        description: 'The main Roo Code agent for this project.',
        ...(primary.length ? { instructions: joinSections(primary.map((r) => r.text)) } : {}),
        tools: [],
        skills: [],
        origin: origin(primary[0]?.path ?? (tree.has(ROOMODES) ? ROOMODES : tree.find('**/.roo/**')[0] ?? ROOMODES)),
      },
      ...agents,
    );
    return out;
  },
};
