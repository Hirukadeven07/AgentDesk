import { parse } from 'yaml';
import type { PlatformId } from '../../data/types';
import type { FileTree } from '../fileTree';
import { asString } from '../frontmatter';
import { emptyDiscovery, type Adapter, type DiscoveredSkill } from '../types';
import { dirOf, readMarkdown } from './shared';

/**
 * Reads skills in the Agent Skills format (https://agentskills.io/specification):
 * a folder with a `SKILL.md` whose frontmatter has `name` and `description`.
 * Many platforms use this format, so one adapter reads every SKILL.md and gives
 * each skill the platform whose folder it sits in.
 */

/** Hidden project folders that hold a platform's skills, as `<folder>/skills/…`. */
const SKILL_FOLDERS: Record<string, PlatformId> = {
  '.claude': 'claude-code',
  '.agents': 'agent-skills',
  '.codex': 'codex',
  '.cursor': 'cursor',
  '.github': 'copilot',
  '.gemini': 'gemini-cli',
  '.windsurf': 'windsurf',
  '.cline': 'cline',
  '.roo': 'roo-code',
};

/** The platform a SKILL.md belongs to, from where it sits. `paths` is every file in the tree. */
export function skillPlatform(skillPath: string, paths: readonly string[]): PlatformId {
  const parts = skillPath.split('/');
  // the nearest `<platform folder>/skills/` above the skill wins
  for (let i = parts.length - 2; i > 0; i--) {
    if (parts[i] === 'skills' && SKILL_FOLDERS[parts[i - 1]]) return SKILL_FOLDERS[parts[i - 1]];
  }
  // a skill inside a Claude Code plugin: some folder above it has .claude-plugin/plugin.json
  const all = new Set(paths);
  for (let i = parts.length - 2; i >= 0; i--) {
    const base = parts.slice(0, i).join('/');
    if (all.has((base ? base + '/' : '') + '.claude-plugin/plugin.json')) return 'claude-code';
  }
  return 'agent-skills';
}

/** Codex keeps a skill's display text in `agents/openai.yaml` beside its SKILL.md. */
async function codexShortDescription(tree: FileTree, dir: string): Promise<string | undefined> {
  const text = await tree.read(dir + 'agents/openai.yaml');
  if (!text) return undefined;
  try {
    const doc: unknown = parse(text, { schema: 'core' });
    const ui = typeof doc === 'object' && doc !== null ? (doc as Record<string, unknown>).interface : undefined;
    return typeof ui === 'object' && ui !== null ? asString(ui as Record<string, unknown>, 'short_description') : undefined;
  } catch {
    return undefined;
  }
}

export const agentSkills: Adapter = {
  id: 'agent-skills',
  label: 'Agent Skills',
  detect: (tree) => tree.find('**/SKILL.md').length > 0,
  async parse(tree) {
    const out = emptyDiscovery();
    const skillFiles = tree.find('**/SKILL.md');
    const skillDirs = skillFiles.map(dirOf);
    for (const path of skillFiles) {
      const fm = await readMarkdown(tree, path, out);
      if (!fm) continue;
      const dir = dirOf(path);
      const description = asString(fm.data, 'description') ?? (await codexShortDescription(tree, dir)) ?? '';
      if (!description) out.warnings.push(`${path} has no description`);
      // the skill's own files: everything in its folder except SKILL.md and any skill nested inside it
      const nested = skillDirs.filter((d) => d !== dir && d.startsWith(dir));
      const files = tree.paths
        .filter((p) => p.startsWith(dir) && p !== path && !nested.some((d) => p.startsWith(d)))
        .map((p) => {
          const size = tree.sizeOf(p);
          return size === undefined ? { path: p.slice(dir.length) } : { path: p.slice(dir.length), size };
        });
      const skill: DiscoveredSkill = {
        // no name: use the folder's name, or `skill` for a SKILL.md at the root
        id: asString(fm.data, 'name') ?? (dir ? dir.split('/').at(-2)! : 'skill'),
        description,
        instructions: fm.body,
        files,
        // a skill reached through a symlink belongs to where its real file is
        origin: { platform: skillPlatform(tree.realPath(path), tree.paths), path: tree.realPath(path) },
      };
      out.skills.push(skill);
    }
    return out;
  },
};
