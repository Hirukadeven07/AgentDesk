import { describe, expect, it } from 'vitest';
import { mockData } from '../data/mock';
import type { Skill, Tier } from '../data/types';
import { agentsOnPage, isDense, pageOfAgent, pageOfSkill, rackPages, racksOnPage, rosterPages } from './paging';

const skills = (sl: number, sf = 0) =>
  Object.fromEntries(
    [...Array.from({ length: sl }, (_, i) => `a${i}`), ...Array.from({ length: sf }, (_, i) => `b${i}`)].map((id) => [
      id,
      { id, kind: id.startsWith('a') ? 'sl' : 'sf', desc: '', files: [] } as Skill,
    ]),
  );

describe('skills layer paging', () => {
  it('keeps the demo team on one page with its usual layout', () => {
    expect(rackPages(mockData.skills)).toBe(1);
    expect(isDense(mockData.skills, 'sl')).toBe(false);
    expect(isDense(mockData.skills, 'sf')).toBe(false);
  });

  it('pages a room past 8 racks, 15 at a time', () => {
    const s = skills(115);
    expect(rackPages(s)).toBe(8);
    expect(isDense(s, 'sl')).toBe(true);
    expect(racksOnPage(s, 'sl', 0).map((x) => x.id)).toEqual(Array.from({ length: 15 }, (_, i) => `a${i}`));
    expect(racksOnPage(s, 'sl', 7).map((x) => x.id)).toEqual(Array.from({ length: 10 }, (_, i) => `a${105 + i}`));
  });

  it('shows a room that fits on every page, beside one that pages', () => {
    const s = skills(30, 3);
    expect(rackPages(s)).toBe(2);
    expect(racksOnPage(s, 'sf', 1).map((x) => x.id)).toEqual(['b0', 'b1', 'b2']);
  });

  it('finds the page a skill is on', () => {
    const s = skills(40, 2);
    expect(pageOfSkill(s, 'a0')).toBe(0);
    expect(pageOfSkill(s, 'a15')).toBe(1);
    expect(pageOfSkill(s, 'a39')).toBe(2);
    expect(pageOfSkill(s, 'b1')).toBe(0);
    expect(pageOfSkill(s, 'missing')).toBe(0);
  });
});

describe('roster paging', () => {
  const tiers = (counts: [number, number, number]): Tier[] =>
    ([3, 2, 1] as const).map((level, i) => ({ level, name: '', agentIds: Array.from({ length: counts[i] }, (_, j) => `L${level}-${j}`) }));

  it('keeps the demo team on one page', () => {
    expect(rosterPages(mockData.tiers)).toBe(1);
  });

  it('pages a step past 6 agents, and keeps a step that fits on every page', () => {
    const t = tiers([2, 3, 48]);
    expect(rosterPages(t)).toBe(8);
    expect(agentsOnPage(t[2], 7)).toEqual(['L1-42', 'L1-43', 'L1-44', 'L1-45', 'L1-46', 'L1-47']);
    expect(agentsOnPage(t[0], 7)).toEqual(['L3-0', 'L3-1']);
  });

  it('finds the page an agent is on', () => {
    const t = tiers([1, 1, 20]);
    expect(pageOfAgent(t, 'L1-0')).toBe(0);
    expect(pageOfAgent(t, 'L1-13')).toBe(2);
    expect(pageOfAgent(t, 'L3-0')).toBe(0);
  });
});
