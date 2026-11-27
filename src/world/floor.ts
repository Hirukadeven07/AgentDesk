/**
 * Fixed layout of the agent floor (level L1): rooms, seats, furniture and walls.
 * Units are floor tiles (1 tile ≈ 0.5 m). This is the building, not data.
 */
import type { StationId } from '../data/types';

export type Pt = [number, number];

export const W = 26;
export const H = 16;
/** y of the main corridor agents walk along. */
export const AISLE = 8;
export const WALK_SPEED = 3.0;
export const WALL_H = 2.2;
export const PART_H = 2.0;
export const T = 0.28;

export interface Station {
  id: StationId;
  name: string;
  code: string;
  /** [x0, y0, x1, y1] */
  zone: [number, number, number, number];
  /** True for rooms on the north side of the corridor. */
  top: boolean;
  seats: Pt[];
}

const station = (id: StationId, name: string, code: string, zone: Station['zone'], top: boolean, seats: Pt[]): Station => ({ id, name, code, zone, top, seats });

export const STATIONS: Record<StationId, Station> = {
  dispatch: station('dispatch', 'Dispatch', 'A1', [0, 0, 5.5, 6.6], true, [[2.2, 6.4], [3.9, 6.4]]),
  terminal: station('terminal', 'Terminal desks', 'A2', [5.5, 0, 13.5, 6.6], true, [[7.45, 6.05], [9.55, 6.05], [11.65, 6.05]]),
  editor: station('editor', 'Code bench', 'A3', [13.5, 0, 19.5, 6.6], true, [[15.35, 6.05], [17.65, 6.05]]),
  web: station('web', 'Web research', 'A4', [19.5, 0, 26, 6.6], true, [[21.35, 6.05], [23.55, 6.05]]),
  archive: station('archive', 'File archive', 'B1', [0, 9.4, 7.5, 16], false, [[1.8, 10.4], [3.5, 10.4], [5.2, 10.4]]),
  planning: station('planning', 'Planning', 'B2', [7.5, 9.4, 12.5, 16], false, [[9.2, 10.95], [10.8, 10.95]]),
  stateless: station('stateless', 'Skills · stateless', 'B3', [12.5, 9.4, 19.5, 16], false, [[14.2, 10.4], [16.1, 10.4], [18.0, 10.4]]),
  stateful: station('stateful', 'Skills · stateful', 'B4', [19.5, 9.4, 26, 16], false, [[21.4, 10.4], [23.6, 10.4]]),
};

/** Rooms where a working agent sits in a chair. */
export const SEATED = new Set<StationId>(['terminal', 'editor', 'web', 'planning']);

export interface Item {
  kind: string;
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
  z0: number;
  mons?: number[];
  face?: 'n' | 's';
}

type ItemInput = Omit<Item, 'z0' | 'h'> & Partial<Pick<Item, 'z0' | 'h'>>;
export const item = (o: ItemInput): Item => ({ z0: 0, h: 0.8, ...o });

function buildProps(): Item[] {
  const out: Item[] = [];
  const P = (o: ItemInput) => out.push(item(o));
  P({ kind: 'counter', x: 1.3, y: 3.6, w: 3.4, d: 0.9, h: 1.0 });
  P({ kind: 'sofa', x: 1.0, y: 0.45, w: 2.6, d: 0.85, h: 0.8 });
  P({ kind: 'screen', x: 1.5, y: 0.02, w: 2.8, d: 0.08, h: 0.75, z0: 1.1 });
  const desk = (x: number, w: number, mons: number[]) => P({ kind: 'desk', x, y: 4.6, w, d: 1, h: 1.3, mons });
  for (let i = 0; i < 3; i++) desk(6.6 + i * 2.1, 1.7, [0.52]);
  for (let i = 0; i < 2; i++) desk(14.4 + i * 2.3, 1.9, [0.22, 1.02]);
  for (let i = 0; i < 2; i++) desk(20.5 + i * 2.2, 1.7, [0.52]);
  P({ kind: 'rack', x: 11.2, y: 0.4, w: 0.9, d: 1, h: 2.0 });
  P({ kind: 'rack', x: 12.2, y: 0.4, w: 0.9, d: 1, h: 2.0 });
  for (const k of ['terminal', 'editor', 'web'] as const)
    for (const s of STATIONS[k].seats) P({ kind: 'chair', x: s[0] - 0.24, y: s[1] - 0.24, w: 0.48, d: 0.48, h: 0.95, face: 'n' });
  P({ kind: 'plant', x: 24.7, y: 0.6, w: 0.6, d: 0.6, h: 1.6 });
  P({ kind: 'plant', x: 18.6, y: 0.6, w: 0.6, d: 0.6, h: 1.6 });
  P({ kind: 'plant', x: 25.0, y: 7.3, w: 0.6, d: 0.6, h: 1.6 });
  for (let i = 0; i < 3; i++) P({ kind: 'cabinet', x: 1.3 + i * 1.7, y: 11.3, w: 1, d: 0.8, h: 1.1 });
  P({ kind: 'shelf', x: 0.9, y: 14.6, w: 6.0, d: 0.7, h: 1.8 });
  P({ kind: 'table', x: 8.4, y: 11.55, w: 3.2, d: 1.5, h: 0.75 });
  for (const s of STATIONS.planning.seats) P({ kind: 'chair', x: s[0] - 0.24, y: s[1] - 0.24, w: 0.48, d: 0.48, h: 0.95, face: 's' });
  for (const cx of [9.2, 10.8]) P({ kind: 'chair', x: cx - 0.24, y: 13.4, w: 0.48, d: 0.48, h: 0.95, face: 'n' });
  P({ kind: 'board', x: 8.0, y: 15.3, w: 4.0, d: 0.1, h: 1.0, z0: 0.5 });
  for (let i = 0; i < 3; i++) P({ kind: 'kiosk', x: 13.7 + i * 1.9, y: 11.3, w: 1.0, d: 0.7, h: 1.05 });
  P({ kind: 'shelf', x: 13.1, y: 14.6, w: 6.0, d: 0.7, h: 1.8 });
  P({ kind: 'vault', x: 20.4, y: 11.3, w: 4.2, d: 1, h: 1.05 });
  P({ kind: 'shelf', x: 20.0, y: 14.6, w: 5.2, d: 0.7, h: 1.8 });
  P({ kind: 'plant', x: 25.2, y: 12.6, w: 0.6, d: 0.6, h: 1.6 });
  P({ kind: 'plant', x: 6.8, y: 12.4, w: 0.5, d: 0.5, h: 1.4 });
  return out;
}

export const PROPS = buildProps();

/** Glass partitions: vertical [x, y0, y1]. */
export const PARTS: [number, number, number][] = [[5.5, 0, 6.6], [13.5, 0, 6.6], [19.5, 0, 6.6], [7.5, 9.4, 16], [12.5, 9.4, 16], [19.5, 9.4, 16]];
/** Glass fronts: horizontal [y, x0, x1]. */
export const GFRONT: [number, number, number][] = [[9.4, 7.5, 8.75], [9.4, 11.25, 12.5]];
/** Windows in the north wall: [x0, x1]. */
export const WIN: [number, number][] = [[6.2, 8.0], [9.0, 10.8], [15, 16.8], [21.2, 23.0]];

/** The station whose zone contains floor point (x, y). */
export function stationAt(x: number, y: number): StationId | null {
  for (const st of Object.values(STATIONS)) {
    const z = st.zone;
    if (x >= z[0] && x < z[2] && y >= z[1] && y < z[3]) return st.id;
  }
  return null;
}
