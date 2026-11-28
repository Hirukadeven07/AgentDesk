import type { Origin } from '../../data/types';
import { asList, asString, parseFrontmatter } from '../frontmatter';
import { emptyDiscovery, type Adapter } from '../types';
import { baseName, firstLine, readMarkdown, readText } from './shared';

/**
 * Reads a Cline project (https://docs.cline.bot/customization/cline-rules):
 * - `.clinerules` as one file, or every `.md` in the `.clinerules/` (or `.cline/rules/`) folder.
 *   A rule without `paths` is always on and goes into the primary agent's instructions, in file
 *   order (numeric prefixes like `01-` set it). A rule with `paths` is shown as a skill.
 * - workflows in `.clinerules/workflows/*.md` (run as `/name`), as skills
 * `.cline/skills/` is left to the agent-skills adapter. Cline keeps MCP servers in the user's own settings, not in the project.
 */

const PLATFORM = 'cline';
const origin = (path: string): Origin => ({ platform: PLATFORM, path });
/** `.clinerules/workflows/` holds workflows and `.clinerules/hooks/` hook scripts; neither holds rules. */
const isSpecial = (path: string) => path.startsWith('.clinerules/workflows/') || path.startsWith('.clinerules/hooks/');

export const cline: Adapter = {
  id: PLATFORM,
  label: 'Cline',
  detect: (tree) => tree.has('.clinerules') || tree.find('.clinerules/**').length > 0 || tree.find('.cline/rules/**').length > 0,

  async parse(tree) {
    const out = emptyDiscovery();
    const primary: string[] = [];
    let primaryOrigin: string | undefined;

    if (tree.has('.clinerules')) {
      const text = await readText(tree, '.clinerules', out);
      if (text !== null) {
        primary.push(parseFrontmatter(text).body);
        primaryOrigin = '.clinerules';
      }
    }

    const rules = [...tree.find('.cline/rules/**/*.md'), ...tree.find('.clinerules/**/*.md')].filter((p) => !isSpecial(p)).sort();
    for (const path of rules) {
      const fm = await readMarkdown(tree, path, out);
      if (!fm) continue;
      const name = baseName(path);
      // broken frontmatter: Cline still applies the rule, so it counts as always on
      const paths = asList(fm.data, 'paths');
      if (!paths.length) {
        primary.push(`# ${name} (${path})\n\n${fm.body}`);
        primaryOrigin ??= path;
        continue;
      }
      out.skills.push({
        id: name,
        description: asString(fm.data, 'description') ?? `Applies to ${paths.join(', ')}`,
        instructions: fm.body,
        files: [],
        origin: origin(path),
      });
    }

    for (const path of tree.find('.clinerules/workflows/*.md')) {
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
      name: 'Cline',
      kind: 'primary',
      description: 'The main Cline agent for this project.',
      ...(primary.length ? { instructions: primary.join('\n') } : {}),
      tools: [],
      skills: [],
      origin: origin(primaryOrigin ?? rules[0] ?? tree.find('.clinerules/**')[0] ?? '.clinerules'),
    });
    return out;
  },
};
