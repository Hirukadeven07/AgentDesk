import { describe, expect, it } from 'vitest';
import { mockData } from '../data/mock';
import type { Skill } from '../data/types';
import { layoutRacks } from './skills';

describe('layoutRacks', () => {
  it("keeps the demo team's racks exactly where they were: 4 a row, 2 rows, full size", () => {
    const racks = layoutRacks(mockData.skills);
    expect(racks).toHaveLength(Object.keys(mockData.skills).length);
    for (const kind of ['sl', 'sf'] as const) {
      const x0 = kind === 'sl' ? 1.3 : 14.3;
      racks
        .filter((r) => r.kind === kind)
        .forEach((r, i) => {
          expect(r).toMatchObject({ x: x0 + (i % 4) * 2.75, y: i < 4 ? 3.4 : 9.2, w: 1.7, d: 1.1, h: 2.1, f: 1 });
        });
    }
  });

  it('puts a big room on a denser grid that stays inside the room, a page at a time', () => {
    const skills = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`s${i}`, { id: `s${i}`, kind: 'sl', desc: '', files: [] } as Skill]));
    const page0 = layoutRacks(skills, 0);
    const page2 = layoutRacks(skills, 2);
    expect(page0.map((r) => r.skill)).toEqual(Array.from({ length: 15 }, (_, i) => `s${i}`));
    expect(page2.map((r) => r.skill)).toEqual(Array.from({ length: 10 }, (_, i) => `s${30 + i}`));
    for (const r of page0) {
      expect(r.f).toBe(0.75);
      // the left room runs to the glass wall at x = 13, and its floor sign starts at y = 15.55
      expect(r.x + r.w).toBeLessThan(13);
      expect(r.y + r.d + 1.95 * r.f).toBeLessThan(15.55);
    }
  });
});
