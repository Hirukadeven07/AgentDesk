/** Agent roster: every agent lined up on photo risers by level (L3 at the back). */
import type { Level } from '../data/types';
import { getAgentInfo, shortTool, type AgentInfo } from '../lib/agentInfo';
import { fmtTime } from '../sim/simulation';
import type { Pt } from '../world/floor';
import { agentsOnPage } from './paging';
import { DARK, EDGE, INK, PAPER, box, fitText, hull, line3, poly, setScale, type Ctx, type Palette, type Proj } from './primitives';
import type { Hit, RenderResult, RenderState } from './types';

/** Riser geometry per level: depth position, depth, height. */
const RISER: Record<Level, { y: number; d: number; h: number; tone: Palette }> = {
  3: { y: 2.6, d: 1.6, h: 2.4, tone: ['#dcdcd7', '#cdcdc8', '#e9e9e5'] },
  2: { y: 4.2, d: 1.6, h: 1.6, tone: ['#e7e7e3', '#d7d7d2', '#f3f3f0'] },
  1: { y: 5.8, d: 1.6, h: 0.8, tone: ['#f2f2ef', '#e1e1dc', '#ffffff'] },
};
/** Where along the riser each agent stands, by how many share it. */
const SPOTS: Record<number, number[]> = { 2: [0.3, 0.7], 4: [0.2, 0.4, 0.6, 0.8], 5: [0.1, 0.3, 0.5, 0.7, 0.9] };
const spot = (i: number, n: number) => SPOTS[n]?.[i] ?? (i + 0.5) / n;

function drawStandee(c: Ctx, pr: Proj, x: number, y: number, z: number, info: AgentInfo, S: number, isSel: boolean, lw: number) {
  const r = S * 0.26;
  const bw = r * 1.05;
  const off = info.status === 'offline';
  const base = pr(x, y, z);
  const top = pr(x, y, z + 1.05);
  const hd = pr(x, y, z + 1.33);
  c.fillStyle = 'rgba(31,31,30,.12)';
  c.beginPath();
  c.ellipse(base[0] + r * 0.5, base[1] + r * 0.15, r * 1.2, r * 0.45, 0, 0, 7);
  c.fill();
  c.beginPath();
  c.moveTo(base[0] - bw, base[1]);
  c.lineTo(top[0] - bw * 0.9, top[1] + r * 0.4);
  c.quadraticCurveTo(top[0], top[1] - r * 0.5, top[0] + bw * 0.9, top[1] + r * 0.4);
  c.lineTo(base[0] + bw, base[1]);
  c.quadraticCurveTo(base[0], base[1] + r * 0.55, base[0] - bw, base[1]);
  c.closePath();
  c.fillStyle = isSel ? INK : off ? 'rgba(255,255,255,.55)' : '#ffffff';
  c.fill();
  c.strokeStyle = off ? 'rgba(31,31,30,.55)' : INK;
  c.lineWidth = lw * 1.4;
  if (off) c.setLineDash([3, 3]);
  c.stroke();
  if (!isSel && !off) {
    c.fillStyle = 'rgba(31,31,30,.1)';
    c.beginPath();
    c.moveTo(base[0] + bw * 0.2, base[1] + r * 0.3);
    c.lineTo(base[0] + bw, base[1]);
    c.lineTo(top[0] + bw * 0.9, top[1] + r * 0.4);
    c.lineTo(top[0] + bw * 0.2, top[1] + r * 0.2);
    c.closePath();
    c.fill();
  }
  c.beginPath();
  c.arc(hd[0], hd[1], r * 0.85, 0, 7);
  c.fillStyle = isSel ? INK : off ? 'rgba(255,255,255,.55)' : '#ffffff';
  c.fill();
  c.stroke();
  c.setLineDash([]);
  if (info.status === 'working' || info.status === 'walking') {
    c.fillStyle = isSel ? PAPER : INK;
    const b = pr(x, y, z + 0.7);
    c.font = `600 ${r * 0.75}px "IBM Plex Mono", monospace`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(info.name[0], b[0], b[1]);
  }
  return hd;
}

function inPoly(px: number, py: number, P: Pt[]) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i];
    const [xj, yj] = P[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

export function drawRoster(ctx: Ctx, cw: number, ch: number, t: number, s: RenderState): RenderResult {
  const { sim, data } = s;
  const hits: Hit[] = [];
  const openAgent = s.open?.type === 'agent' ? s.open.id : null;
  const openLevel = s.open?.type === 'level' ? s.open.id : null;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, cw, ch);
  const RW = 16, RH = 11, BH = 5.4, sd = 0.35, ZK = 0.95, A = (16 * Math.PI) / 180, cA = Math.cos(A), sA = Math.sin(A), K = 0.5;
  const P1 = (x: number, y: number, z: number): Pt => [x * cA - y * sA, (x * sA + y * cA) * K - z * ZK];
  let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
  for (const [x, y, z] of [[0, 0, BH + 0.3], [RW, 0, BH + 0.3], [0, RH, -sd], [RW, RH, -sd], [0, 0, 0], [RW, RH, 0], [0, RH, 0], [RW, 0, 0]]) {
    const p = P1(x, y, z);
    mnx = Math.min(mnx, p[0]);
    mxx = Math.max(mxx, p[0]);
    mny = Math.min(mny, p[1]);
    mxy = Math.max(mxy, p[1]);
  }
  const S = Math.min((cw - 30) / (mxx - mnx), (ch - 40) / (mxy - mny));
  setScale(S);
  const ox = (cw - (mxx - mnx) * S) / 2 - mnx * S;
  const oy = (ch - 24 - (mxy - mny) * S) / 2 - mny * S;
  const pr: Proj = (x, y, z = 0) => {
    const p = P1(x, y, z);
    return [ox + p[0] * S, oy + p[1] * S];
  };
  const lw = Math.max(0.6, S * 0.02);

  // studio floor
  poly(ctx, [pr(0, RH), pr(RW, RH), pr(RW, RH, -sd), pr(0, RH, -sd)], '#e2e2de', EDGE, lw);
  poly(ctx, [pr(RW, 0), pr(RW, RH), pr(RW, RH, -sd), pr(RW, 0, -sd)], '#d2d2cd', EDGE, lw);
  poly(ctx, [pr(0, 0), pr(RW, 0), pr(RW, RH), pr(0, RH)], '#f5f5f2', EDGE, lw);

  // cyclorama backdrop
  const x0 = 1.0, x1 = 15.0, yb = 0.6, R = 1.4;
  const col: [number, number][] = [[yb, BH]];
  for (let i = 8; i >= 0; i--) {
    const a = ((i / 8) * Math.PI) / 2;
    col.push([yb + R - R * Math.sin(a), R - R * Math.cos(a)]);
  }
  for (let i = 0; i < col.length - 1; i++) {
    const [ya, za] = col[i];
    const [yb2, zb] = col[i + 1];
    const v = Math.round(255 * (0.92 + 0.06 * (i / (col.length - 1))));
    poly(ctx, [pr(x0, ya, za), pr(x1, ya, za), pr(x1, yb2, zb), pr(x0, yb2, zb)], `rgb(${v},${v},${v - 3})`);
  }
  ctx.strokeStyle = EDGE;
  ctx.lineWidth = lw;
  ctx.beginPath();
  for (const xx of [x0, x1])
    col.forEach(([yy, zz], i) => {
      const p = pr(xx, yy, zz);
      if (i) ctx.lineTo(p[0], p[1]);
      else ctx.moveTo(p[0], p[1]);
    });
  {
    const a = pr(x0, yb, BH), b = pr(x1, yb, BH);
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
  }
  ctx.stroke();
  for (const xx of [x0, x1]) line3(ctx, pr, [xx, yb - 0.06, 0], [xx, yb - 0.06, BH + 0.3], INK, lw * 1.5);
  line3(ctx, pr, [x0, yb - 0.06, BH + 0.25], [x1, yb - 0.06, BH + 0.25], INK, lw * 1.5);

  const tiers = [...data.tiers].sort((a, b) => b.level - a.level);
  const all = tiers.flatMap((tr) => tr.agentIds).map((id) => getAgentInfo(id, sim, data));
  ctx.save();
  {
    const o = pr(1.6, yb, BH - 0.55);
    ctx.translate(o[0], o[1]);
    ctx.transform(cA, sA * K, 0, ZK, 0, 0);
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#3a3a38';
    ctx.font = `600 ${S * 0.55}px "Space Grotesk", sans-serif`;
    ctx.fillText('AGENTSDECK · TEAM ROSTER', 0, 0);
    ctx.fillStyle = '#86867e';
    ctx.font = `400 ${S * 0.26}px "IBM Plex Mono", monospace`;
    ctx.fillText(
      `${all.length} agents · ${all.filter((a) => a.live).length} on the floor · ${all.filter((a) => a.status === 'idle').length} idle · ${all.filter((a) => a.status === 'offline').length} offline · ${fmtTime(sim.t)}`,
      S * 0.04,
      S * 0.45,
    );
  }
  ctx.restore();

  // risers, back to front, each followed by its row
  const RX0 = 2.2, RX1 = 13.8;
  const levelPolys: { lvl: Level; polys: Pt[][] }[] = [];
  tiers.forEach((tr, ti) => {
    const g = RISER[tr.level];
    const next = tiers[ti + 1];
    const band = g.h - (next ? RISER[next.level].h : 0);
    const fp: Pt[] = [[RX0, g.y], [RX1, g.y], [RX1, g.y + g.d], [RX0, g.y + g.d]];
    poly(ctx, hull(fp.concat(fp.map(([a, b]) => [a + 0.35 * g.h, b + 0.7 * g.h] as Pt))).map(([a, b]) => pr(a, b)), 'rgba(31,31,30,.07)');
    const isL = openLevel === tr.level;
    const fc = box(ctx, pr, RX0, g.y, RX1 - RX0, g.d, g.h, 0, isL ? ['#cfcfca', '#c2c2bd', '#e0e0dc'] : g.tone, isL ? lw * 2.6 : lw, isL ? INK : undefined);
    levelPolys.push({ lvl: tr.level, polys: [fc.L, fc.R, fc.Tp] });
    ctx.save();
    {
      const o = pr(RX0 + 0.15, g.y + g.d, g.h);
      ctx.translate(o[0], o[1]);
      ctx.transform(cA, sA * K, 0, ZK, 0, 0);
      ctx.textBaseline = 'middle';
      ctx.fillStyle = INK;
      ctx.font = `700 ${S * band * 0.5}px "Space Grotesk", sans-serif`;
      ctx.fillText(`L${tr.level}`, 0, band * S * 0.36);
      ctx.font = `500 ${S * band * 0.19}px "IBM Plex Mono", monospace`;
      ctx.fillStyle = '#3a3a38';
      ctx.fillText(tr.name, 0, band * S * 0.74);
    }
    ctx.restore();
    line3(ctx, pr, [RX0, g.y + g.d, g.h], [RX1, g.y + g.d, g.h], INK, Math.max(1.5, lw * 2.4));
    // a step with more agents than fit shows them a page at a time (see ./paging)
    const shown = agentsOnPage(tr, s.page);
    const n = shown.length;
    // the space one agent has along the step, so long names are shortened to fit it
    const slot = (S * (RX1 - RX0 - 2.0)) / Math.max(n, 2);
    shown.forEach((id, i) => {
      const info = getAgentInfo(id, sim, data);
      const x = RX0 + 1.6 + (RX1 - RX0 - 2.0) * spot(i, n);
      const y = g.y + g.d * 0.5;
      const isSel = openAgent === id;
      // name plate on riser front
      ctx.save();
      const o = pr(x - 0.75, g.y + g.d, g.h);
      ctx.translate(o[0], o[1]);
      ctx.transform(cA, sA * K, 0, ZK, 0, 0);
      ctx.textBaseline = 'middle';
      const st = info.status === 'working' && info.live ? shortTool(info.live.tool) : info.status;
      ctx.fillStyle = isSel ? INK : info.status === 'offline' ? '#9a9a93' : INK;
      const plateFont = `600 ${S * band * 0.27}px "IBM Plex Mono", monospace`;
      ctx.fillText(fitText(ctx, info.name.toUpperCase(), plateFont, slot * 0.92), 0, band * S * 0.36);
      ctx.fillStyle = '#86867e';
      ctx.font = `400 ${S * band * 0.2}px "IBM Plex Mono", monospace`;
      const dot = info.status === 'working' || info.status === 'walking' ? '● ' : info.status === 'idle' ? '○ ' : '◌ ';
      ctx.fillText(dot + st, 0, band * S * 0.74);
      ctx.restore();
      if (isSel) {
        const c0 = pr(x, y, g.h);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(c0[0], c0[1], S * 0.55, S * 0.2, 0, 0, 7);
        ctx.stroke();
      }
      const hd = drawStandee(ctx, pr, x, y, g.h, info, S, isSel, lw);
      const nameFont = `600 ${Math.max(10, Math.min(13, S * 0.3))}px "IBM Plex Mono", monospace`;
      const label = fitText(ctx, info.name, nameFont, slot * 0.95);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(251,251,249,.95)';
      ctx.lineWidth = 4;
      ctx.strokeText(label, hd[0], hd[1] - S * 0.3);
      ctx.fillStyle = info.status === 'offline' ? '#86867e' : INK;
      ctx.fillText(label, hd[0], hd[1] - S * 0.3);
      ctx.textAlign = 'left';
      const mid = pr(x, y, g.h + 0.7);
      hits.push({ target: { type: 'agent', id }, x: mid[0], y: mid[1], r: S * 0.6 });
      const pl = pr(x, g.y + g.d, g.h - band * 0.5);
      hits.push({ target: { type: 'agent', id }, x: pl[0], y: pl[1], r: S * 0.5 });
    });
  });

  // lights and camera
  const light = (lx: number, ly: number) => {
    for (const [dx, dy] of [[-0.35, 0.25], [0.35, 0.25], [0, -0.35]]) line3(ctx, pr, [lx, ly, 0.9], [lx + dx, ly + dy, 0], '#4a4a4d', lw * 1.4);
    line3(ctx, pr, [lx, ly, 0.9], [lx, ly, 2.7], '#4a4a4d', lw * 1.6);
    box(ctx, pr, lx - 0.5, ly - 0.5, 1.0, 1.0, 0.8, 2.6, ['#ffffff', '#e6e6e2', '#4a4c4f'], lw);
  };
  light(0.9, 7.8);
  light(15.1, 7.8);
  {
    const cx = 8, cy = 9.6;
    for (const [dx, dy] of [[-0.35, 0.3], [0.35, 0.3], [0, -0.4]]) line3(ctx, pr, [cx, cy, 1.0], [cx + dx, cy + dy, 0], '#4a4a4d', lw * 1.4);
    box(ctx, pr, cx - 0.35, cy - 0.2, 0.7, 0.45, 0.45, 1.0, DARK, lw, '#2b2c2e');
    box(ctx, pr, cx - 0.14, cy - 0.5, 0.28, 0.3, 0.26, 1.08, DARK, lw, '#2b2c2e');
    if (!s.reduce && t % 9 < 0.1) {
      ctx.fillStyle = 'rgba(255,255,255,.6)';
      ctx.fillRect(0, 0, cw, ch);
    }
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  const pickArea = (x: number, y: number) => {
    for (let i = levelPolys.length - 1; i >= 0; i--) for (const P of levelPolys[i].polys) if (inPoly(x, y, P)) return { type: 'level' as const, id: levelPolys[i].lvl };
    return null;
  };
  return { hits, pickArea };
}
