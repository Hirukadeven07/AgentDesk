/** Level L1: the agent floor as an axonometric architectural model. */
import { fmtTime, type LiveAgent } from '../sim/simulation';
import { shortTool } from '../lib/agentInfo';
import { AISLE, GFRONT, H, PART_H, PARTS, PROPS, SEATED, STATIONS, T, W, WALL_H, WIN, item, stationAt, type Item, type Pt } from '../world/floor';
import { EDGE, INK, PAPER, drawItem, drawShadows, northArrow, poly, segs, setScale, type Ctx, type Proj } from './primitives';
import type { Hit, RenderResult, RenderState } from './types';

function wallBoxes() {
  const back: Item[] = [];
  const front: Item[] = [];
  const W_ = (x: number, y: number, w: number, d: number, h: number, z0 = 0) => back.push(item({ kind: 'wall', x, y, w, d, h, z0 }));
  let cx = -T;
  for (const [a, e] of WIN) {
    W_(cx, -T, a - cx, T, WALL_H);
    W_(a, -T, e - a, T, 0.6);
    back.push(item({ kind: 'glass', x: a, y: -T * 0.6, w: e - a, d: 0.05, h: 1.3, z0: 0.6 }));
    W_(a, -T, e - a, T, 0.3, 1.9);
    cx = e;
  }
  W_(cx, -T, W + T - cx, T, WALL_H);
  W_(-T, 0, T, 7.1, WALL_H);
  W_(-T, 8.9, T, 2.1, WALL_H);
  W_(-T, 11, T, 2, 0.6);
  back.push(item({ kind: 'glass', x: -T * 0.6, y: 11, w: 0.05, d: 2, h: 1.3, z0: 0.6 }));
  W_(-T, 11, T, 2, 0.3, 1.9);
  W_(-T, 13, T, H - 13, WALL_H);
  W_(-T, 7.1, T, 1.8, 0.3, 1.9);
  front.push(item({ kind: 'wall', x: -T, y: H, w: W + 2 * T, d: T, h: 0.3 }), item({ kind: 'wall', x: W, y: -T, w: T, d: H + T, h: 0.3 }));
  return { back, front };
}
const WALLS = wallBoxes();
const GLASS: Item[] = [
  ...PARTS.flatMap(([px, y0, y1]) => segs(item({ kind: 'glass', x: px - 0.03, y: y0, w: 0.06, d: y1 - y0, h: PART_H }))),
  ...GFRONT.flatMap(([gy, x0, x1]) => segs(item({ kind: 'glass', x: x0, y: gy - 0.03, w: x1 - x0, d: 0.06, h: PART_H }))),
];
const ITEMS: Item[] = PROPS.flatMap((p) => (p.kind === 'shelf' ? segs(p) : [p]));

const headZ = (a: LiveAgent) => (a.phase === 'work' && SEATED.has(a.seat.st) ? 1.22 : 1.06);

function drawFigure(c: Ctx, pr: Proj, a: LiveAgent, S: number, t: number, lw: number, s: RenderState) {
  const isSel = a.id === s.sel;
  const walk = a.phase === 'walk';
  const seated = !walk && SEATED.has(a.seat.st);
  const bob = s.reduce ? 0 : walk ? Math.abs(Math.sin(t * 9 + a.seed)) * 0.06 : 0;
  const z0 = (seated ? 0.46 : 0) + bob;
  const base = pr(a.x, a.y, z0);
  const r = S * 0.2;
  const bodyTop = pr(a.x, a.y, (seated ? 1.0 : 0.82) + bob);
  const bw = r * 1.05;
  c.beginPath();
  c.moveTo(base[0] - bw, base[1]);
  c.lineTo(bodyTop[0] - bw * 0.9, bodyTop[1] + r * 0.4);
  c.quadraticCurveTo(bodyTop[0], bodyTop[1] - r * 0.5, bodyTop[0] + bw * 0.9, bodyTop[1] + r * 0.4);
  c.lineTo(base[0] + bw, base[1]);
  c.quadraticCurveTo(base[0], base[1] + r * 0.55, base[0] - bw, base[1]);
  c.closePath();
  c.fillStyle = isSel ? INK : '#ffffff';
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = lw * 1.2;
  c.stroke();
  if (!isSel) {
    c.fillStyle = 'rgba(31,31,30,.1)';
    c.beginPath();
    c.moveTo(base[0] + bw * 0.2, base[1] + r * 0.3);
    c.lineTo(base[0] + bw, base[1]);
    c.lineTo(bodyTop[0] + bw * 0.9, bodyTop[1] + r * 0.4);
    c.lineTo(bodyTop[0] + bw * 0.2, bodyTop[1] + r * 0.2);
    c.closePath();
    c.fill();
  }
  const hd = pr(a.x, a.y, headZ(a) + bob);
  c.beginPath();
  c.arc(hd[0], hd[1], r * 0.82, 0, 7);
  c.fillStyle = isSel ? INK : '#ffffff';
  c.fill();
  c.stroke();
  if (isSel && !s.reduce) {
    const ring = pr(a.x, a.y, 0);
    c.strokeStyle = INK;
    c.lineWidth = 1;
    c.beginPath();
    c.ellipse(ring[0], ring[1], S * (0.5 + 0.06 * Math.sin(t * 4)), S * (0.25 + 0.03 * Math.sin(t * 4)), 0, 0, 7);
    c.stroke();
  }
}

export function drawFloor(ctx: Ctx, cw: number, ch: number, t: number, s: RenderState): RenderResult {
  const { sim } = s;
  const agents = sim.agents;
  const hits: Hit[] = [];
  const openRoom = s.open?.type === 'room' ? s.open.id : null;
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

  // slab and floor
  poly(ctx, [pr(-T, H + T), pr(W + T, H + T), pr(W + T, H + T, -sd), pr(-T, H + T, -sd)], '#e2e2de', EDGE, lw);
  poly(ctx, [pr(W + T, -T), pr(W + T, H + T), pr(W + T, H + T, -sd), pr(W + T, -T, -sd)], '#d2d2cd', EDGE, lw);
  const floorPoly: Pt[] = [pr(-T, -T), pr(W + T, -T), pr(W + T, H + T), pr(-T, H + T)];
  poly(ctx, floorPoly, '#f7f7f4');
  ctx.strokeStyle = 'rgba(31,31,30,.055)';
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
  poly(ctx, [pr(0, 7.15), pr(W, 7.15), pr(W, 8.85), pr(0, 8.85)], 'rgba(31,31,30,.035)');
  ctx.setLineDash([S * 0.5, S * 0.2, S * 0.08, S * 0.2]);
  ctx.strokeStyle = 'rgba(31,31,30,.28)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  {
    const a = pr(0.4, AISLE), b = pr(W - 0.4, AISLE);
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  // hatching marks the stateful wing
  ctx.save();
  {
    const z = STATIONS.stateful.zone;
    poly(ctx, [pr(z[0], z[1]), pr(z[2], z[1]), pr(z[2], z[3]), pr(z[0], z[3])]);
    ctx.clip();
    ctx.strokeStyle = 'rgba(31,31,30,.13)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let i = -10; i < 24; i += 0.35) {
      const a = pr(z[0] + i, z[1]), b = pr(z[0] + i - 7, z[3]);
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
    }
    ctx.stroke();
  }
  ctx.restore();
  {
    const z2 = STATIONS.stateless.zone;
    poly(ctx, [pr(z2[0] + 0.15, z2[1] + 0.15), pr(z2[2] - 0.15, z2[1] + 0.15), pr(z2[2] - 0.15, z2[3] - 0.15), pr(z2[0] + 0.15, z2[3] - 0.15)], null, 'rgba(31,31,30,.3)', 0.8);
  }
  // room labels on the floor
  for (const st of Object.values(STATIONS)) {
    const z = st.zone;
    const lx = z[0] + 0.35;
    const ly = st.top ? 7.02 : 9.98;
    ctx.save();
    const o = pr(lx, ly);
    ctx.translate(o[0], o[1]);
    ctx.transform(C, Sn, -C, Sn, 0, 0);
    ctx.fillStyle = '#3a3a38';
    ctx.font = `500 ${S * 0.44}px "IBM Plex Mono", monospace`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(st.code, 0, 0);
    const cwid = ctx.measureText(st.code + ' ').width;
    ctx.font = `400 ${S * 0.38}px "IBM Plex Sans", sans-serif`;
    ctx.fillText(st.name.toUpperCase(), cwid, 0);
    ctx.restore();
  }
  if (openRoom) {
    const z = STATIONS[openRoom].zone;
    poly(ctx, [pr(z[0] + 0.08, z[1] + 0.08), pr(z[2] - 0.08, z[1] + 0.08), pr(z[2] - 0.08, z[3] - 0.08), pr(z[0] + 0.08, z[3] - 0.08)], 'rgba(31,31,30,.06)', INK, 2.2);
  }

  // soft shadows
  drawShadows(ctx, pr, floorPoly, [...ITEMS, ...WALLS.back.filter((b) => b.kind === 'wall'), ...GLASS.map((p) => ({ ...p, h: 0.25 }))], 0.11, (sx) => {
    for (const a of agents) {
      const c0 = pr(a.x + 0.22, a.y + 0.34);
      sx.beginPath();
      sx.ellipse(c0[0], c0[1], S * 0.34, S * 0.16, 0, 0, 7);
      sx.fillStyle = '#000';
      sx.fill();
    }
  });

  // routes
  for (const a of agents) {
    if (a.phase !== 'walk' || !a.path.length) continue;
    ctx.strokeStyle = a.id === s.sel ? INK : 'rgba(31,31,30,.4)';
    ctx.lineWidth = a.id === s.sel ? 1.4 : 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    let p = pr(a.x, a.y);
    ctx.moveTo(p[0], p[1]);
    for (const q of a.path) {
      p = pr(q.x, q.y);
      ctx.lineTo(p[0], p[1]);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    const e = a.path[a.path.length - 1];
    const ep = pr(e.x, e.y);
    ctx.beginPath();
    ctx.ellipse(ep[0], ep[1], S * 0.22, S * 0.11, 0, 0, 7);
    ctx.stroke();
  }

  // painter's order: back walls, then everything sorted by depth, then front walls
  WALLS.back.forEach((v) => drawItem(ctx, pr, v, lw, sim.t));
  const list = [
    ...ITEMS.map((v) => ({ k: v.x + v.w / 2 + v.y + v.d / 2, f: () => drawItem(ctx, pr, v, lw, sim.t) })),
    ...GLASS.map((v) => ({ k: v.x + v.w / 2 + v.y + v.d / 2, f: () => drawItem(ctx, pr, v, lw, sim.t) })),
    ...agents.map((a) => ({ k: a.x + a.y + 0.05, f: () => drawFigure(ctx, pr, a, S, t, lw, s) })),
  ];
  list.sort((a, b) => a.k - b.k).forEach((o) => o.f());
  WALLS.front.forEach((v) => drawItem(ctx, pr, v, lw, sim.t));

  // annotation tags
  ctx.textBaseline = 'middle';
  for (const a of agents) {
    const isSel = a.id === s.sel;
    const head = pr(a.x, a.y, headZ(a) + 0.2);
    const rise = S * (isSel ? 1.6 : 1.1);
    const lx = head[0];
    const ly = head[1] - rise;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(head[0], head[1]);
    ctx.lineTo(lx, ly);
    ctx.lineTo(lx + S * 0.35, ly);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(head[0], head[1], 1.6, 0, 7);
    ctx.fillStyle = INK;
    ctx.fill();
    const k = a.phase === 'work' ? sim.kindOf(a.tool) : 'walk';
    const mark = k === 'sl' ? '○ ' : k === 'sf' ? '● ' : '';
    const txt = a.name.toUpperCase() + '  ' + (a.phase === 'work' ? mark + shortTool(a.tool) : '→ ' + STATIONS[a.seat.st].code);
    const fs = Math.max(9.5, Math.min(12.5, S * 0.4));
    ctx.font = `500 ${fs}px "IBM Plex Mono", monospace`;
    const tw = ctx.measureText(txt).width + 10;
    const bx = lx + S * 0.35;
    const by = ly - fs * 0.75;
    ctx.fillStyle = isSel ? INK : 'rgba(251,251,249,.94)';
    ctx.fillRect(bx, by, tw, fs * 1.5);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.8;
    ctx.strokeRect(bx + 0.5, by + 0.5, tw - 1, fs * 1.5 - 1);
    ctx.fillStyle = isSel ? PAPER : INK;
    ctx.textAlign = 'left';
    ctx.fillText(txt, bx + 5, ly + 0.5);
    const base = pr(a.x, a.y, 0.5);
    hits.push({ target: { type: 'follow', id: a.id }, x: base[0], y: base[1], r: Math.max(16, S * 0.8) });
    hits.push({ target: { type: 'follow', id: a.id }, x: bx + tw / 2, y: ly, r: Math.max(12, tw / 2) });
  }

  northArrow(ctx, pr, cw, ch);
  ctx.fillStyle = '#66665f';
  ctx.font = '500 10px "IBM Plex Mono", monospace';
  ctx.fillText(`AGENTSDECK · FLOOR 1 · AXONOMETRIC · ${fmtTime(sim.t)}`, 16, ch - 14);

  // invert the projection (z = 0) to find which room a tap landed in
  const pickArea = (px: number, py: number) => {
    const u = (px - ox) / (C * S);
    const v = (py - oy) / (Sn * S);
    const id = stationAt((u + v) / 2, (v - u) / 2);
    return id ? { type: 'room' as const, id } : null;
  };
  return { hits, pickArea };
}
