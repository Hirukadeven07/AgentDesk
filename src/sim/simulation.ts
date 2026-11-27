/**
 * Mock simulation: moves floor agents between stations as they work through
 * their scripted steps. A real event stream could later drive the same
 * `LiveAgent` state instead (for example, one event per tool call).
 */
import type { AgentDeskData, FloorAgent, StationId } from '../data/types';
import { AISLE, STATIONS, WALK_SPEED } from '../world/floor';

export type LogKind = 'sl' | 'sf' | 'tool' | 'walk' | 'done';

export interface LogEntry {
  t: number;
  text: string;
  k: LogKind;
  tool?: string;
  st: StationId;
}

export interface Seat {
  st: StationId;
  /** Seat index, or -1 when the agent is standing beside a full room. */
  i: number;
  x: number;
  y: number;
}

export interface LiveAgent extends FloorAgent {
  idx: number;
  x: number;
  y: number;
  phase: 'work' | 'walk';
  left: number;
  path: { x: number; y: number }[];
  seat: Seat;
  log: LogEntry[];
  fx: number;
  fy: number;
  seed: number;
  tool: string;
}

/** Wall-clock time shown at simulation time 0. */
const BASE = 9 * 3600 + 12 * 60;
export const fmtTime = (t: number) => {
  const s = Math.floor(BASE + t);
  return [Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60].map((v) => String(v).padStart(2, '0')).join(':');
};

export class Simulation {
  t = 0;
  agents: LiveAgent[];
  /** Calls per skill today, counting up as agents use them. */
  calls: Record<string, number>;
  private occ: Record<StationId, (string | null)[]>;
  private counting = false;
  private data: AgentDeskData;

  constructor(data: AgentDeskData) {
    this.data = data;
    this.calls = Object.fromEntries(Object.values(data.skills).map((s) => [s.id, s.callsToday]));
    this.occ = Object.fromEntries(Object.values(STATIONS).map((s) => [s.id, s.seats.map(() => null)])) as Record<StationId, (string | null)[]>;
    this.agents = data.floorAgents.map((d, i) => {
      const idx = (i * 2 + 1) % d.steps.length;
      const a: LiveAgent = { ...d, idx, x: 0, y: 0, phase: 'work', left: 0, path: [], seat: { st: d.steps[idx].station, i: -1, x: 0, y: 0 }, log: [], fx: 0, fy: -1, seed: i * 1.7, tool: '' };
      return a;
    });
    for (const a of this.agents) {
      a.seat = this.takeSeat(a.steps[a.idx].station, a);
      a.x = a.seat.x;
      a.y = a.seat.y;
      this.startWork(a);
      a.left *= Math.random();
    }
    // Warm up so the floor is mid-activity when the page opens.
    for (let i = 0; i < 900; i++) this.advance(0.1);
    this.counting = true;
  }

  kindOf(tool: string): 'sl' | 'sf' | 'tool' {
    return this.data.skills[tool]?.kind ?? 'tool';
  }

  /** Advance by dt simulated seconds, in small sub-steps. */
  step(dt: number) {
    let d = dt;
    while (d > 0) {
      const s = Math.min(d, 0.05);
      this.advance(s);
      d -= s;
    }
  }

  private advance(dt: number) {
    this.t += dt;
    for (const a of this.agents) this.update(a, dt);
  }

  private takeSeat(sid: StationId, a: LiveAgent): Seat {
    const s = STATIONS[sid];
    const occ = this.occ[sid];
    for (let i = 0; i < s.seats.length; i++)
      if (!occ[i]) {
        occ[i] = a.id;
        return { st: sid, i, x: s.seats[i][0], y: s.seats[i][1] };
      }
    const j = Math.floor(Math.random() * s.seats.length);
    return { st: sid, i: -1, x: s.seats[j][0] + 0.55, y: s.seats[j][1] + (s.top ? 0.25 : -0.25) };
  }

  private release(a: LiveAgent) {
    if (a.seat.i >= 0 && this.occ[a.seat.st][a.seat.i] === a.id) this.occ[a.seat.st][a.seat.i] = null;
  }

  private addLog(a: LiveAgent, text: string, k: LogKind, tool?: string) {
    a.log.unshift({ t: this.t, text, k, tool, st: a.steps[a.idx].station });
    if (a.log.length > 40) a.log.pop();
  }

  private planPath(a: LiveAgent, to: Seat) {
    if (a.seat.st === to.st) return [{ x: to.x, y: to.y }];
    const p: { x: number; y: number }[] = [];
    if (Math.abs(a.y - AISLE) > 0.01) p.push({ x: a.x, y: AISLE });
    p.push({ x: to.x, y: AISLE });
    p.push({ x: to.x, y: to.y });
    return p;
  }

  private startWork(a: LiveAgent) {
    const { station, text, tool, duration } = a.steps[a.idx];
    a.phase = 'work';
    a.left = duration * (0.8 + Math.random() * 0.45);
    a.tool = tool;
    a.fx = 0;
    a.fy = STATIONS[station].top ? -1 : 1;
    if (this.counting && this.calls[tool] !== undefined) this.calls[tool]++;
    this.addLog(a, text, this.kindOf(tool), tool);
  }

  private nextStep(a: LiveAgent) {
    a.idx = (a.idx + 1) % a.steps.length;
    if (a.idx === 0) this.addLog(a, 'Task complete. Back to Dispatch for the next ticket.', 'done');
    const sid = a.steps[a.idx].station;
    const old = a.seat;
    this.release(a);
    const seat = this.takeSeat(sid, a);
    a.path = this.planPath(a, seat);
    a.seat = seat;
    if (old.st === sid && Math.hypot(seat.x - a.x, seat.y - a.y) < 0.05) {
      a.path = [];
      this.startWork(a);
      return;
    }
    a.phase = 'walk';
    this.addLog(a, 'Walking to ' + STATIONS[sid].name, 'walk');
  }

  private update(a: LiveAgent, dt: number) {
    if (a.phase === 'walk') {
      let m = WALK_SPEED * dt;
      while (m > 0 && a.path.length) {
        const p = a.path[0];
        const dx = p.x - a.x;
        const dy = p.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d > 1e-6) {
          a.fx = dx / d;
          a.fy = dy / d;
        }
        if (d <= m) {
          a.x = p.x;
          a.y = p.y;
          m -= d;
          a.path.shift();
        } else {
          a.x += (dx / d) * m;
          a.y += (dy / d) * m;
          m = 0;
        }
      }
      if (!a.path.length) this.startWork(a);
    } else {
      a.left -= dt;
      if (a.left <= 0) this.nextStep(a);
    }
  }
}
