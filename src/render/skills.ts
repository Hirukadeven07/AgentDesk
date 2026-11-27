/** Level B1: the skills layer, two rooms of GPU racks (one skill per rack). */
import type { Skill, SkillKind } from '../data/types';
import { fmtTime, type LiveAgent } from '../sim/simulation';
import { H, PART_H, STATIONS, T, W, WALL_H, item, type Item, type Pt } from '../world/floor';
import { DARK, EDGE, INK, PAPER, WHITE, box, drawItem, drawShadows, floorText, line3, northArrow, poly, scale, segs, setScale, type Ctx, type Proj } from './primitives';
import type { Hit, RenderResult, RenderState } from './types';

export interface Rack {
  skill: string;
  kind: SkillKind;
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
}

/** Up to 8 racks per room, 4 per row. */
export function layoutRacks(skills: Record<string, Skill>): Rack[] {
  const racks: Rack[] = [];
  const place = (kind: SkillKind, x0: number) =>
    Object.values(skills)
      .filter((s) => s.kind === kind)
      .forEach((s, i) => {
        const row = Math.floor(i / 4);
        const col = i % 4;
        racks.push({ skill: s.id, kind, x: x0 + col * 2.75, y: row ? 9.2 : 3.4, w: 1.7, d: 1.1, h: 2.1 });
      });
  place('sl', 1.3);
  place('sf', 14.3);
  return racks;
}

/** "S1 · rack 3" style location for a skill. */
export function rackLabel(skills: Record<string, Skill>, id: string) {
  const s = skills[id];
  const list = Object.values(skills).filter((x) => x.kind === s.kind);
  return `${s.kind === 'sl' ? 'S1' : 'S2'} · rack ${list.indexOf(s) + 1}`;
}

const SKX: Item[] = [
  item({ kind: 'crac', x: 1.0, y: 0.15, w: 2.2, d: 0.9, h: 1.9 }),
  item({ kind: 'crac', x: 9.6, y: 0.15, w: 2.2, d: 0.9, h: 1.9 }),
  item({ kind: 'crac', x: 23.4, y: 0.15, w: 2.2, d: 0.9, h: 1.9 }),
  item({ kind: 'storage', x: 13.9, y: 0.15, w: 8.75, d: 1.0, h: 1.6 }),
  item({ kind: 'console', x: 21.8, y: 9.3, w: 1.4, d: 0.8, h: 0.9 }),
];

function drawRack(c: Ctx, pr: Proj, r: Rack, fill: number, lw: number, t: number, active: boolean) {
  const { x, y, w, d, h } = r;
  const S_ = scale();
  box(c, pr, x, y, w, d, h, 0, DARK, lw, '#2b2c2e');
  const sledTop = r.kind === 'sf' ? 0.75 : 0.12;
  if (r.kind === 'sf') {
    poly(c, [pr(x + 0.08, y + d, 0.1), pr(x + w - 0.08, y + d, 0.1), pr(x + w - 0.08, y + d, 0.68), pr(x + 0.08, y + d, 0.68)], '#6a6d71', 'rgba(255,255,255,.25)', lw * 0.6);
    for (let i = 1; i < 10; i++) line3(c, pr, [x + 0.08 + (i * (w - 0.16)) / 10, y + d, 0.14], [x + 0.08 + (i * (w - 0.16)) / 10, y + d, 0.64], 'rgba(31,31,30,.45)', lw * 0.8);
    for (let i = 0; i < 10; i++) {
      const on = Math.floor(t * (active ? 9 : 1.2) + i * 2.3 + x) % 4 === 0;
      if (!on) continue;
      const p = pr(x + 0.13 + (i * (w - 0.16)) / 10, y + d, 0.6);
      c.fillStyle = '#ffffff';
      c.fillRect(p[0] - 1, p[1] - 1, 2, 2);
    }
  }
  const n = 8;
  for (let i = 0; i < n; i++) {
    const z = sledTop + 0.05 + (i * (h - sledTop - 0.15)) / n;
    line3(c, pr, [x + 0.08, y + d, z], [x + w - 0.08, y + d, z], 'rgba(255,255,255,.14)', lw);
    const on = active ? Math.floor(t * 8 + i * 1.7 + x) % 2 === 0 : Math.floor(t * 0.7 + i * 3.1 + x * 2) % 7 === 0;
    const p = pr(x + 0.18, y + d, z + 0.08);
    c.fillStyle = on ? '#ffffff' : 'rgba(255,255,255,.22)';
    c.fillRect(p[0] - 1.2, p[1] - 1.2, 2.4, 2.4);
    const q = pr(x + w - 0.22, y + d, z + 0.08);
    c.fillStyle = active && on ? '#ffffff' : 'rgba(255,255,255,.15)';
    c.fillRect(q[0] - 1, q[1] - 1, 2, 2);
  }
  line3(c, pr, [x + w / 2, y + d, sledTop], [x + w / 2, y + d, h - 0.08], 'rgba(255,255,255,.1)', lw);
  for (let i = 0; i < 6; i++) {
    const yy = y + 0.15 + (i * (d - 0.3)) / 5;
    line3(c, pr, [x + w, yy, 0.3], [x + w, yy, h - 0.3], 'rgba(255,255,255,.08)', lw);
  }
  if (r.kind === 'sl') {
    // spinning fans on top
    for (const fx of [0.3, 0.7]) {
      const ctr = pr(x + w * fx, y + d / 2, h);
      const rx = S_ * 0.3;
      const ry = S_ * 0.17;
      c.beginPath();
      c.ellipse(ctr[0], ctr[1], rx, ry, 0, 0, 7);
      c.fillStyle = '#3a3c3f';
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,.3)';
      c.lineWidth = lw;
      c.stroke();
      const sp = active ? t * 9 : t * 1.2;
      c.strokeStyle = 'rgba(255,255,255,.45)';
      c.beginPath();
      for (let k = 0; k < 3; k++) {
        const an = sp + k * 2.094;
        c.moveTo(ctr[0], ctr[1]);
        c.lineTo(ctr[0] + Math.cos(an) * rx * 0.85, ctr[1] + Math.sin(an) * ry * 0.85);
      }
      c.stroke();
    }
  } else {
    // store fill gauge on top
    const a = [x + 0.2, y + d / 2 - 0.12];
    const L = w - 0.4;
    poly(c, [pr(a[0], a[1], h), pr(a[0] + L, a[1], h), pr(a[0] + L, a[1] + 0.24, h), pr(a[0], a[1] + 0.24, h)], '#2f3134', 'rgba(255,255,255,.35)', lw * 0.6);
    poly(c, [pr(a[0], a[1], h), pr(a[0] + L * fill, a[1], h), pr(a[0] + L * fill, a[1] + 0.24, h), pr(a[0], a[1] + 0.24, h)], '#e8e8e5');
  }
}

function drawSkx(c: Ctx, pr: Proj, v: Item, lw: number, t: number) {
  const { x, y, w, d, h } = v;
  if (v.kind === 'crac') {
    box(c, pr, x, y, w, d, h, 0, WHITE, lw);
    for (let i = 1; i < 12; i++) line3(c, pr, [x + 0.1, y + d, 0.25 + (i * (h - 0.5)) / 12], [x + w - 0.1, y + d, 0.25 + (i * (h - 0.5)) / 12], 'rgba(60,60,58,.35)', lw * 0.7);
    const p = pr(x + w - 0.35, y + d, h - 0.18);
    c.fillStyle = INK;
    c.fillRect(p[0] - 3, p[1] - 2, 6, 3);
    return;
  }
  if (v.kind === 'storage') {
    box(c, pr, x, y, w, d, h, 0, ['#5b5e61', '#4b4e51', '#6c6f72'], lw, '#2b2c2e');
    for (let r = 0; r < 4; r++) {
      const z = 0.15 + r * 0.36;
      line3(c, pr, [x + 0.06, y + d, z], [x + w - 0.06, y + d, z], 'rgba(255,255,255,.2)', lw);
      for (let i = 0; i < w / 0.25; i++) {
        const xx = x + 0.1 + i * 0.25;
        line3(c, pr, [xx, y + d, z + 0.03], [xx, y + d, z + 0.3], 'rgba(31,31,30,.5)', lw * 0.8);
        if (Math.floor(t * 1.5 + i * 0.7 + r * 1.3) % 9 === 0) {
          const p = pr(xx + 0.1, y + d, z + 0.26);
          c.fillStyle = '#fff';
          c.fillRect(p[0] - 1, p[1] - 1, 2, 2);
        }
      }
    }
    for (let i = 1; i < Math.ceil(w / 1.25); i++) line3(c, pr, [x + i * 1.25, y + d, 0], [x + i * 1.25, y + d, h], '#2b2c2e', lw);
    return;
  }
  if (v.kind === 'console') {
    box(c, pr, x + 0.15, y + 0.15, w - 0.3, d - 0.3, 0.72, 0, WHITE, lw);
    box(c, pr, x, y, w, d, 0.05, 0.72, WHITE, lw);
    box(c, pr, x + 0.3, y + 0.1, 0.8, 0.05, 0.45, 0.77, ['#2f3236', '#3d4044', '#55585c'], lw * 0.7);
  }
}

const SK_WALLS = {
  back: [
    item({ kind: 'wall', x: -T, y: -T, w: W + 2 * T, d: T, h: WALL_H }),
    item({ kind: 'wall', x: -T, y: 0, w: T, d: 7.1, h: WALL_H }),
    item({ kind: 'wall', x: -T, y: 8.9, w: T, d: H - 8.9, h: WALL_H }),
    item({ kind: 'wall', x: -T, y: 7.1, w: T, d: 1.8, h: 0.3, z0: 1.9 }),
  ],
  front: [item({ kind: 'wall', x: -T, y: H, w: W + 2 * T, d: T, h: 0.3 }), item({ kind: 'wall', x: W, y: -T, w: T, d: H + T, h: 0.3 })],
};
const SK_GLASS = segs(item({ kind: 'glass', x: 12.97, y: 0, w: 0.06, d: H, h: PART_H }));

export function drawSkills(ctx: Ctx, cw: number, ch: number, t: number, s: RenderState): RenderResult {
  const { sim, data } = s;
  const skills = data.skills;
  const racks = layoutRacks(skills);
  const openSk = s.open?.type === 'skill' ? s.open.id : null;
  const hits: Hit[] = [];
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, cw, ch);
  const C = Math.cos(Math.PI / 6);
  const Sn = 0.5;
  const ZK = 0.95;
  const sd = 0.4;
  const spanX = (W + H + 4 * T) * C;
  const spanY = (W + H + 4 * T) * Sn + (WALL_H + sd) * ZK;
  const S = Math.min((cw - 24) / spanX, (ch - 44) / spanY);
  setScale(S);
  const ox = cw / 2 - ((W - H) / 2) * C * S;
  const oy = (ch - 28 - spanY * S) / 2 + (2 * T * Sn + WALL_H * ZK) * S;
  const pr: Proj = (x, y, z = 0) => [ox + (x - y) * C * S, oy + (x + y) * Sn * S - z * ZK * S];
  const lw = Math.max(0.5, S * 0.028);
  const active: Record<string, LiveAgent[]> = {};
  for (const a of sim.agents) if (a.phase === 'work' && skills[a.tool]) (active[a.tool] = active[a.tool] || []).push(a);

  // slab and raised floor
  poly(ctx, [pr(-T, H + T), pr(W + T, H + T), pr(W + T, H + T, -sd), pr(-T, H + T, -sd)], '#e2e2de', EDGE, lw);
  poly(ctx, [pr(W + T, -T), pr(W + T, H + T), pr(W + T, H + T, -sd), pr(W + T, -T, -sd)], '#d2d2cd', EDGE, lw);
  const floorPoly: Pt[] = [pr(-T, -T), pr(W + T, -T), pr(W + T, H + T), pr(-T, H + T)];
  poly(ctx, floorPoly, '#f4f4f1');
  ctx.strokeStyle = 'rgba(31,31,30,.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 1; x < W; x++) {
    const a = pr(x, 0), b = pr(x, H);
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
  }
  for (let y = 1; y < H; y++) {
    const a = pr(0, y), b = pr(W, y);
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
  }
  ctx.stroke();
  ctx.save();
  poly(ctx, [pr(13, 0), pr(W, 0), pr(W, H), pr(13, H)]);
  ctx.clip();
  ctx.strokeStyle = 'rgba(31,31,30,.14)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let i = -10; i < 30; i += 0.35) {
    const a = pr(13 + i, 0), b = pr(13 + i - 16 * 0.7, H);
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
  }
  ctx.stroke();
  ctx.restore();

  // perforated cold-aisle tiles in front of racks
  for (const r of racks) {
    const y0 = r.y + r.d + 0.1;
    poly(ctx, [pr(r.x, y0), pr(r.x + r.w, y0), pr(r.x + r.w, y0 + 0.9), pr(r.x, y0 + 0.9)], 'rgba(31,31,30,.05)', 'rgba(31,31,30,.2)', 0.6);
    ctx.fillStyle = 'rgba(31,31,30,.28)';
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 3; j++) {
        const p = pr(r.x + 0.15 + (i * (r.w - 0.3)) / 5, y0 + 0.18 + j * 0.27);
        ctx.fillRect(p[0] - 0.6, p[1] - 0.6, 1.2, 1.2);
      }
    if (r.skill === openSk)
      poly(ctx, [pr(r.x - 0.3, r.y - 0.3), pr(r.x + r.w + 0.3, r.y - 0.3), pr(r.x + r.w + 0.3, r.y + r.d + 1.2), pr(r.x - 0.3, r.y + r.d + 1.2)], 'rgba(31,31,30,.08)', INK, 2);
    if (active[r.skill]) {
      ctx.setLineDash([3, 3]);
      poly(ctx, [pr(r.x - 0.15, r.y - 0.15), pr(r.x + r.w + 0.15, r.y - 0.15), pr(r.x + r.w + 0.15, r.y + r.d + 1.05), pr(r.x - 0.15, r.y + r.d + 1.05)], null, INK, 1);
      ctx.setLineDash([]);
    }
  }

  // floor text
  const ft = (x: number, y: number, parts: [string, string, string][]) => floorText(ctx, pr, C, Sn, x, y, parts);
  for (const r of racks) {
    const on = !!active[r.skill];
    ft(r.x, r.y + r.d + 1.55, [[r.skill, `${on ? 600 : 500} ${S * 0.36}px "IBM Plex Mono", monospace`, on ? INK : '#4a4a47']]);
    ft(r.x, r.y + r.d + 1.95, [[r.kind === 'sf' ? skills[r.skill].state ?? '' : `${sim.calls[r.skill]} calls today`, `400 ${S * 0.27}px "IBM Plex Mono", monospace`, '#86867e']]);
  }
  ft(0.6, 15.55, [['S1', `600 ${S * 0.7}px "IBM Plex Mono", monospace`, '#3a3a38'], ['STATELESS SKILLS', `600 ${S * 0.62}px "IBM Plex Sans", sans-serif`, '#3a3a38'], ['· compute only', `400 ${S * 0.3}px "IBM Plex Mono", monospace`, '#86867e']]);
  ft(1.3, 13.7, [['NO STORAGE ON THIS SIDE · RESULTS GO STRAIGHT BACK TO THE AGENT', `400 ${S * 0.27}px "IBM Plex Mono", monospace`, '#86867e']]);
  ft(13.9, 1.95, [['STATE STORE', `500 ${S * 0.34}px "IBM Plex Mono", monospace`, '#3a3a38'], ['· 2.4 TB · shared by every stateful rack', `400 ${S * 0.27}px "IBM Plex Mono", monospace`, '#86867e']]);
  ft(13.6, 15.55, [['S2', `600 ${S * 0.7}px "IBM Plex Mono", monospace`, '#3a3a38'], ['STATEFUL SKILLS', `600 ${S * 0.62}px "IBM Plex Sans", sans-serif`, '#3a3a38'], ['· compute + state store', `400 ${S * 0.3}px "IBM Plex Mono", monospace`, '#86867e']]);

  // geometry
  const vols: (Item & { rack?: Rack })[] = [...racks.map((r) => ({ ...item({ ...r, kind: 'rack' }), rack: r })), ...SKX.flatMap((v) => (v.kind === 'storage' ? segs(v) : [v]))];
  drawShadows(ctx, pr, floorPoly, [...vols, ...SK_WALLS.back, ...SK_GLASS.map((g) => ({ ...g, h: 0.25 }))], 0.12);
  SK_WALLS.back.forEach((v) => drawItem(ctx, pr, v, lw, sim.t));
  const list = [
    ...vols.map((v) => ({
      k: v.x + v.w / 2 + v.y + v.d / 2,
      f: () => (v.rack ? drawRack(ctx, pr, v.rack, skills[v.rack.skill].fill ?? 0.5, lw, t, !!active[v.rack.skill]) : drawSkx(ctx, pr, v, lw, t)),
    })),
    ...SK_GLASS.map((v) => ({ k: v.x + v.w / 2 + v.y + v.d / 2, f: () => drawItem(ctx, pr, v, lw, sim.t) })),
  ];
  list.sort((a, b) => a.k - b.k).forEach((o) => o.f());
  SK_WALLS.front.forEach((v) => drawItem(ctx, pr, v, lw, sim.t));

  // hanging room signs
  const sign = (x0: number, x1: number, title: string, sub: string) => {
    const y = 1.3, d = 0.1, z0 = 2.6, h = 1.05;
    for (const xx of [x0 + 0.5, x1 - 0.5]) line3(ctx, pr, [xx, y + d / 2, z0 + h], [xx, y + d / 2, z0 + h + 0.45], INK, 1);
    box(ctx, pr, x0, y, x1 - x0, d, h, z0, ['#1f1f1e', '#121212', '#3a3a38'], lw, '#121212');
    ctx.save();
    const o = pr(x0, y + d, z0 + h);
    ctx.translate(o[0], o[1]);
    ctx.transform(C, Sn, 0, ZK, 0, 0);
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 ${S * 0.6}px "Space Grotesk", sans-serif`;
    ctx.fillText(title, S * 0.35, S * 0.66);
    ctx.fillStyle = 'rgba(255,255,255,.72)';
    ctx.font = `400 ${S * 0.25}px "IBM Plex Mono", monospace`;
    ctx.fillText(sub, S * 0.37, S * 0.93);
    ctx.restore();
  };
  sign(1.6, 11.4, '○  STATELESS SKILLS', 'S1 · compute only · nothing is kept between calls');
  sign(14.6, 24.4, '●  STATEFUL SKILLS', 'S2 · compute + state store · remembers between calls');
  for (const r of racks) {
    const c0 = pr(r.x + r.w / 2, r.y + r.d / 2, r.h * 0.55);
    hits.push({ target: { type: 'skill', id: r.skill }, x: c0[0], y: c0[1], r: S * 1.15 });
    const c1 = pr(r.x + r.w / 2, r.y + r.d + 1.7);
    hits.push({ target: { type: 'skill', id: r.skill }, x: c1[0], y: c1[1], r: S * 0.8 });
  }

  // calls rising to the agent floor
  ctx.textBaseline = 'middle';
  for (const r of racks) {
    const us = active[r.skill];
    if (!us) continue;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.d / 2;
    const b0 = pr(cx, cy, r.h);
    const b1 = pr(cx, cy, r.h + 1.6);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(b0[0], b0[1]);
    ctx.lineTo(b1[0], b1[1]);
    ctx.stroke();
    ctx.setLineDash([]);
    if (!s.reduce)
      for (let k = 0; k < 3; k++) {
        const f = (t * 0.9 + k / 3) % 1;
        ctx.fillStyle = INK;
        ctx.fillRect(b0[0] - 2, b0[1] + (b1[1] - b0[1]) * f - 2, 4, 4);
      }
    let ty = b1[1];
    for (const a of us) {
      const isSel = a.id === s.sel;
      const txt = `↑ ${a.name.toUpperCase()} · ${STATIONS[a.seat.st].code}`;
      const fs = Math.max(9.5, Math.min(12.5, S * 0.4));
      ctx.font = `500 ${fs}px "IBM Plex Mono", monospace`;
      const tw = ctx.measureText(txt).width + 10;
      const bx = b1[0] - tw / 2;
      const by = ty - fs * 1.5;
      ctx.fillStyle = isSel ? INK : 'rgba(251,251,249,.95)';
      ctx.fillRect(bx, by, tw, fs * 1.5);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.8;
      ctx.strokeRect(bx + 0.5, by + 0.5, tw - 1, fs * 1.5 - 1);
      ctx.fillStyle = isSel ? PAPER : INK;
      ctx.textAlign = 'left';
      ctx.fillText(txt, bx + 5, by + fs * 0.78);
      hits.push({ target: { type: 'follow', id: a.id }, x: b1[0], y: by + fs * 0.75, r: Math.max(14, tw / 2) });
      ty = by - 3;
    }
  }

  northArrow(ctx, pr, cw, ch);
  ctx.fillStyle = '#66665f';
  ctx.font = '500 10px "IBM Plex Mono", monospace';
  ctx.textBaseline = 'middle';
  const busy = Object.keys(active).length;
  ctx.fillText(`AGENTSDECK · LEVEL B1 · SKILLS LAYER · ${busy} of ${racks.length} racks busy · ${fmtTime(sim.t)}`, 16, ch - 14);
  return { hits };
}
