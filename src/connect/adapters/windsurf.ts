import type { Origin } from '../../data/types';
import { asList, asString, parseFrontmatter } from '../frontmatter';
import { emptyDiscovery, type Adapter } from '../types';
import { baseName, firstLine, readLenientMarkdown, readMarkdown, readText } from './shared';

/**
 * Reads a Windsurf project (https://docs.windsurf.com):
 * - rules in `.windsurf/rules/*.md` with a `trigger` (`always_on`, `glob`, `model_decision`, `manual`).
 *   Always-on rules at the root, plus the older `.windsurfrules`, are the primary agent's instructions.
 *   Every other rule is shown as a skill.
 * - workflows in `.windsurf/workflows/*.md` (run as `/name`), as skills
 * `AGENTS.md` is read by the Codex adapter and `.windsurf/skills/` by the agent-skills adapter.
 * Windsurf keeps MCP servers in the user's own settings, not in the project.
 */

const PLATFORM = 'windsurf';
const origin = (path: string): Origin => ({ platform: PLATFORM, path });

/** The folder a rule applies under: where its `.windsurf/` folder sits, '' at the project root. */
const ruleScope = (path: string) => path.slice(0, path.indexOf('.windsurf/rules/'));

export const windsurf: Adapter = {
  id: PLATFORM,
  label: 'Windsurf',
  detect: (tree) => tree.find('**/.windsurf/**').length > 0 || tree.has('.windsurfrules'),

  async parse(tree) {
    const out = emptyDiscovery();
    const primary: string[] = [];
    let primaryOrigin: string | undefined;

    if (tree.has('.windsurfrules')) {
      const text = await readText(tree, '.windsurfrules', out);
      if (text !== null) {
        primary.push(parseFrontmatter(text).body);
        primaryOrigin = '.windsurfrules';
      }
    }

    for (const path of tree.find('**/.windsurf/rules/**/*.md')) {
      const rule = await readLenientMarkdown(tree, path, out);
      if (!rule) continue;
      const { data, body } = rule;
      const name = baseName(path);
      const scope = ruleScope(path);
      const trigger = asString(data, 'trigger')?.toLowerCase();
      if (trigger === 'always_on' && scope === '') {
        primary.push(`# ${name} (${path})\n\n${body}`);
        primaryOrigin ??= path;
        continue;
      }
      const globs = asList(data, 'globs');
      const description =
        asString(data, 'description') ??
        (trigger === 'always_on' ? `Always applies in ${scope}` : undefined) ??
        (trigger === 'glob' && globs.length ? `Applies to ${globs.join(', ')}` : undefined) ??
        (trigger === 'manual' ? `Applied when mentioned as @${name}` : undefined) ??
        firstLine(body);
      out.skills.push({ id: name, description, instructions: body, files: [], origin: origin(path) });
    }

    for (const path of tree.find('**/.windsurf/workflows/*.md')) {
      const fm = await readMarkdown(tree, path, out);
      if (!fm) continue;
      out.skills.push({
        id: baseName(path),
        description: asString(fm.data, 'description') ?? firstLine(fm.body),
        instructions: fm.body,
        files: [],
        origin: origin(path),
      });
    }

    out.agents.push({
      id: PLATFORM,
      name: 'Windsurf',
      kind: 'primary',
      description: 'The main Windsurf (Cascade) agent for this project.',
      ...(primary.length ? { instructions: primary.join('\n') } : {}),
      tools: [],
      skills: [],
      origin: origin(primaryOrigin ?? tree.find('**/.windsurf/**')[0] ?? '.windsurfrules'),
    });
    return out;
  },
};
