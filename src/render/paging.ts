import type { Skill, SkillKind, Tier } from '../data/types';

/**
 * The skills layer and the roster are fixed rooms, so a big project is shown a page at a time
 * instead of shrinking everything until no label can be read.
 * - each skills room keeps its usual layout up to 8 racks; past that it uses a denser grid of
 *   15 racks and pages through them
 * - each roster step holds up to 6 agents and pages through the rest
 * A room or step that fits shows everything on every page.
 */

export const SPARSE_RACKS = 8;
export const RACKS_PER_PAGE = 15;
export const AGENTS_PER_STEP = 6;

const pagesFor = (n: number, fits: number, perPage: number) => (n <= fits ? 1 : Math.ceil(n / perPage));

/** The part of a list shown on a page, or all of it when it fits without paging. */
export function onPage<T>(items: T[], page: number, fits: number, perPage: number): T[] {
  return items.length <= fits ? items : items.slice(page * perPage, (page + 1) * perPage);
}

const byKind = (skills: Record<string, Skill>, kind: SkillKind) => Object.values(skills).filter((s) => s.kind === kind);

/** How many pages the skills layer needs: 1 while both rooms fit. */
export function rackPages(skills: Record<string, Skill>): number {
  return Math.max(pagesFor(byKind(skills, 'sl').length, SPARSE_RACKS, RACKS_PER_PAGE), pagesFor(byKind(skills, 'sf').length, SPARSE_RACKS, RACKS_PER_PAGE));
}

/** The skills on the racks of one room for a page. */
export function racksOnPage(skills: Record<string, Skill>, kind: SkillKind, page: number): Skill[] {
  return onPage(byKind(skills, kind), page, SPARSE_RACKS, RACKS_PER_PAGE);
}

/** True when a room has more skills than its usual layout holds, so it uses the denser grid. */
export const isDense = (skills: Record<string, Skill>, kind: SkillKind) => byKind(skills, kind).length > SPARSE_RACKS;

/** The page a skill's rack is on. */
export function pageOfSkill(skills: Record<string, Skill>, id: string): number {
  const s = skills[id];
  if (!s) return 0;
  const list = byKind(skills, s.kind);
  return list.length <= SPARSE_RACKS ? 0 : Math.floor(list.indexOf(s) / RACKS_PER_PAGE);
}

/** How many pages the roster needs: 1 while every step fits. */
export const rosterPages = (tiers: Tier[]) => Math.max(1, ...tiers.map((t) => pagesFor(t.agentIds.length, AGENTS_PER_STEP, AGENTS_PER_STEP)));

/** The agents standing on one step for a page. */
export const agentsOnPage = (tier: Tier, page: number) => onPage(tier.agentIds, page, AGENTS_PER_STEP, AGENTS_PER_STEP);

/** The page an agent stands on. */
export function pageOfAgent(tiers: Tier[], id: string): number {
  const tier = tiers.find((t) => t.agentIds.includes(id));
  if (!tier || tier.agentIds.length <= AGENTS_PER_STEP) return 0;
  return Math.floor(tier.agentIds.indexOf(id) / AGENTS_PER_STEP);
}
