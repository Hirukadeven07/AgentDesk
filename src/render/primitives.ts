/** Shared canvas drawing: projection types, boxes, furniture, shadows. */
import type { Item, Pt } from '../world/floor';

export type Ctx = CanvasRenderingContext2D;
export type Proj = (x: number, y: number, z?: number) => Pt;
export type Palette = [string, string, string];

export const INK = '#1f1f1e';
export const PAPER = '#fbfbf9';
export const EDGE = '#5b5b58';
export const WHITE: Palette = ['#efefec', '#e1e1dd', '#ffffff'];
export const DARK: Palette = ['#46484b', '#393b3e', '#5a5d60'];
export const CH: Palette = ['#78787b', '#6a6a6d', '#8b8b8e'];
export const SCR: Palette = ['#2f3236', '#3d4044', '#55585c'];
/** Shadow offset per unit of height, in floor tiles. */
export const SUN: Pt = [0.42, 0.62];

/** Pixels per tile for the frame being drawn. Some props size by it. */
let S_ = 20;
export const setScale = (s: number) => {
  S_ = s;
};
export const scale = () => S_;

export function poly(c: Ctx, pts: Pt[], fill?: string | null, stroke?: string | null, lw?: number) {
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.closePath();
  if (fill) {
    c.fillStyle = fill;
    c.fill();
  }
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = lw || 1;
    c.stroke();
  }
}

export function hull(input: Pt[]): Pt[] {
  const pts = input.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: Pt[] = [];
  const up: Pt[] = [];
  for (const p of pts) {
    while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop();
    lo.push(p);
  }
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop();
    up.push(p);
  }
  up.pop();
  lo.pop();
  return lo.concat(up);
}

/** An axis-aligned box: left face, right face, top face. */
export function box(c: Ctx, pr: Proj, x: number, y: number, w: number, d: number, h: number, z0: number, pal: Palette, lw: number, stroke?: string) {
  const L = [pr(x, y + d, z0), pr(x + w, y + d, z0), pr(x + w, y + d, z0 + h), pr(x, y + d, z0 + h)];
  const R = [pr(x + w, y, z0), pr(x + w, y + d, z0), pr(x + w, y + d, z0 + h), pr(x + w, y, z0 + h)];
  const Tp = [pr(x, y, z0 + h), pr(x + w, y, z0 + h), pr(x + w, y + d, z0 + h), pr(x, y + d, z0 + h)];
  const s = stroke === undefined ? EDGE : stroke;
  poly(c, L, pal[0], s, lw);
  poly(c, R, pal[1], s, lw);
  poly(c, Tp, pal[2], s, lw);
  return { L, R, Tp };
}

export function line3(c: Ctx, pr: Proj, a: [number, number, number], b: [number, number, number], col: string, lw: number) {
  const p = pr(a[0], a[1], a[2]);
  const q = pr(b[0], b[1], b[2]);
  c.strokeStyle = col;
  c.lineWidth = lw;
  c.beginPath();
  c.moveTo(p[0], p[1]);
  c.lineTo(q[0], q[1]);
  c.stroke();
}

/** Split a long item into 1-tile pieces so painter's ordering stays right. */
export function segs<T extends { x: number; y: number; w: number; d: number }>(it: T): T[] {
  const out: T[] = [];
  if (it.w >= it.d) {
    const n = Math.max(1, Math.ceil(it.w));
    for (let i = 0; i < n; i++) out.push({ ...it, x: it.x + (i * it.w) / n, w: it.w / n });
  } else {
    const n = Math.max(1, Math.ceil(it.d));
    for (let i = 0; i < n; i++) out.push({ ...it, y: it.y + (i * it.d) / n, d: it.d / n });
  }
  return out;
}

/** Shadow layer, reused between frames. */
const shadowCv = document.createElement('canvas');
const sx = shadowCv.getContext('2d')!;

type Vol = { x: number; y: number; w: number; d: number; h: number; z0?: number };

/**
 * Cast soft shadows for the given volumes (plus optional ellipses for agents)
 * onto the floor polygon, then composite them blurred into ctx.
 */
export function drawShadows(ctx: Ctx, pr: Proj, floor: Pt[], vols: Vol[], alpha: number, extra?: (s: Ctx) => void) {
  const cv = ctx.canvas;
  if (shadowCv.width !== cv.width || shadowCv.height !== cv.height) {
    shadowCv.width = cv.width;
    shadowCv.height = cv.height;
  }
  sx.setTransform(ctx.getTransform());
  sx.clearRect(0, 0, cv.width, cv.height);
  sx.save();
  poly(sx, floor);
  sx.clip();
  for (const v of vols) {
    const top = (v.z0 || 0) + v.h;
    const fp: Pt[] = [[v.x, v.y], [v.x + v.w, v.y], [v.x + v.w, v.y + v.d], [v.x, v.y + v.d]];
    poly(sx, hull(fp.concat(fp.map(([a, b]) => [a + SUN[0] * top, b + SUN[1] * top] as Pt)).map(([a, b]) => pr(a, b))), '#000');
  }
  extra?.(sx);
  sx.restore();
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = alpha;
  try {
    ctx.filter = `blur(${Math.max(2, S_ * 0.12)}px)`;
  } catch {
    /* filter unsupported */
  }
  ctx.drawImage(shadowCv, 0, 0);
  ctx.restore();
}

/** Furniture, walls and glass. `simT` drives blinking rack lights. */
export function drawItem(c: Ctx, pr: Proj, it: Item, lw: number, simT: number) {
  const { x, y, w, d, h, z0 } = it;
  switch (it.kind) {
    case 'desk': {
      box(c, pr, x + 0.04, y + 0.06, 0.05, d - 0.12, 0.72, 0, WHITE, lw);
      box(c, pr, x + w - 0.09, y + 0.06, 0.05, d - 0.12, 0.72, 0, WHITE, lw);
      box(c, pr, x + 0.09, y + 0.12, w - 0.18, 0.03, 0.32, 0.32, ['#e6e6e2', '#d8d8d4', '#f4f4f1'], lw * 0.7);
      box(c, pr, x, y, w, d, 0.05, 0.72, WHITE, lw);
      box(c, pr, x + 0.04, y, w - 0.08, 0.035, 0.34, 0.77, ['#dcdfdc', '#d0d3d0', '#eceeec'], lw * 0.8);
      for (const m of it.mons ?? []) {
        box(c, pr, x + m + 0.3, y + 0.2, 0.06, 0.06, 0.13, 0.77, CH, lw * 0.6);
        box(c, pr, x + m, y + 0.16, 0.66, 0.05, 0.4, 0.88, SCR, lw * 0.7);
        box(c, pr, x + m + 0.08, y + 0.52, 0.5, 0.16, 0.02, 0.77, ['#d3d3cf', '#c7c7c3', '#e6e6e2'], lw * 0.6);
      }
      break;
    }
    case 'chair': {
      const cx = x + w / 2;
      const cy = y + d / 2;
      for (let i = 0; i < 5; i++) {
        const an = (i * Math.PI * 2) / 5 + 0.3;
        line3(c, pr, [cx, cy, 0.06], [cx + Math.cos(an) * 0.24, cy + Math.sin(an) * 0.24, 0.03], '#4a4a4d', lw * 1.6);
      }
      line3(c, pr, [cx, cy, 0.06], [cx, cy, 0.42], '#4a4a4d', lw * 2.2);
      const back = () => box(c, pr, cx - 0.19, it.face === 'n' ? cy + 0.13 : cy - 0.19, 0.38, 0.06, 0.44, 0.5, CH, lw * 0.7);
      const seat = () => box(c, pr, cx - 0.2, cy - 0.2, 0.4, 0.4, 0.07, 0.42, CH, lw * 0.7);
      if (it.face === 'n') {
        seat();
        back();
      } else {
        back();
        seat();
      }
      break;
    }
    case 'counter':
      box(c, pr, x, y, w, d, h, 0, WHITE, lw);
      box(c, pr, x - 0.06, y + d - 0.14, w + 0.12, 0.24, 0.05, h, WHITE, lw);
      box(c, pr, x + 0.6, y + 0.15, 0.62, 0.05, 0.36, h, SCR, lw * 0.7);
      break;
    case 'sofa': {
      const sp: Palette = ['#dadad6', '#cdcdc9', '#e8e8e4'];
      const cu: Palette = ['#e6e6e2', '#d8d8d4', '#f2f2ee'];
      box(c, pr, x, y, w, 0.25, 0.75, 0, sp, lw);
      box(c, pr, x, y + 0.25, 0.22, d - 0.25, 0.55, 0, sp, lw);
      box(c, pr, x + 0.22, y + 0.25, w - 0.44, d - 0.25, 0.4, 0, cu, lw);
      for (let i = 1; i < 3; i++) line3(c, pr, [x + 0.22 + (i * (w - 0.44)) / 3, y + 0.25, 0.4], [x + 0.22 + (i * (w - 0.44)) / 3, y + d, 0.4], EDGE, lw * 0.6);
      box(c, pr, x + w - 0.22, y + 0.25, 0.22, d - 0.25, 0.55, 0, sp, lw);
      break;
    }
    case 'screen':
      box(c, pr, x, y, w, d, h, z0, SCR, lw);
      for (let i = 0; i < 3; i++) line3(c, pr, [x + 0.25, y + d, z0 + h - 0.2 - i * 0.17], [x + 0.25 + w * (0.6 - i * 0.15), y + d, z0 + h - 0.2 - i * 0.17], 'rgba(255,255,255,.55)', lw * 1.4);
      break;
    case 'rack':
      box(c, pr, x, y, w, d, h, 0, DARK, lw);
      for (let r = 0; r < 8; r++) {
        const zz = 0.2 + r * 0.22;
        line3(c, pr, [x + 0.08, y + d, zz], [x + w - 0.08, y + d, zz], 'rgba(255,255,255,.16)', lw);
        if (Math.floor(simT * 2 + r + x) % 3 === 0) {
          const p = pr(x + 0.16, y + d, zz + 0.09);
          c.fillStyle = '#ffffff';
          c.fillRect(p[0] - 1, p[1] - 1, 2, 2);
        }
      }
      break;
    case 'plant': {
      const cx = x + w / 2;
      const cy = y + d / 2;
      box(c, pr, x + 0.08, y + 0.08, w - 0.16, d - 0.16, 0.5, 0, ['#e4e4e0', '#d4d4d0', '#bdbdb8'], lw);
      for (const [dx, dy, zz, r] of [[0, 0, 0.95, 0.34], [-0.16, 0.1, 0.8, 0.27], [0.19, -0.04, 0.85, 0.27], [0.04, 0.1, 1.28, 0.25], [-0.08, -0.12, 1.18, 0.24]]) {
        const p = pr(cx + dx, cy + dy, zz);
        const R = r * S_;
        const g = c.createRadialGradient(p[0] - R * 0.35, p[1] - R * 0.4, R * 0.1, p[0], p[1], R);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(1, '#c4c6c1');
        c.fillStyle = g;
        c.beginPath();
        c.arc(p[0], p[1], R, 0, 7);
        c.fill();
        c.strokeStyle = EDGE;
        c.lineWidth = lw * 0.6;
        c.stroke();
      }
      break;
    }
    case 'cabinet':
      box(c, pr, x, y, w, d, h, 0, WHITE, lw);
      for (let r = 1; r < 4; r++) line3(c, pr, [x + 0.05, y + d, (r * h) / 4], [x + w - 0.05, y + d, (r * h) / 4], EDGE, lw * 0.6);
      for (let r = 0; r < 4; r++) {
        const p = pr(x + w / 2, y + d, (r * h) / 4 + h / 8);
        c.fillStyle = EDGE;
        c.fillRect(p[0] - 2.5, p[1] - 0.6, 5, 1.3);
      }
      break;
    case 'shelf': {
      box(c, pr, x, y, w, d, h, 0, WHITE, lw);
      const rows = 5;
      for (let r = 1; r < rows; r++) line3(c, pr, [x, y + d, (r * h) / rows], [x + w, y + d, (r * h) / rows], EDGE, lw * 0.6);
      c.strokeStyle = 'rgba(60,60,58,.5)';
      c.lineWidth = Math.max(1, lw * 1.4);
      c.beginPath();
      for (let i = 0.08; i < w - 0.04; i += 0.1) {
        for (let r = 0; r < rows; r++) {
          const gx = x + i;
          if (((gx * 13.7 + r * 5.3) | 0) % 6 === 0) continue;
          const hh = (h / rows) * (0.5 + (((gx * 31 + r * 17) | 0) % 4) / 10);
          const a = pr(gx, y + d, (r * h) / rows + 0.03);
          const b = pr(gx, y + d, (r * h) / rows + hh);
          c.moveTo(a[0], a[1]);
          c.lineTo(b[0], b[1]);
        }
      }
      c.stroke();
      break;
    }
    case 'table':
      for (const [lx, ly] of [[0.15, 0.15], [w - 0.2, 0.15], [0.15, d - 0.2], [w - 0.2, d - 0.2]]) box(c, pr, x + lx, y + ly, 0.05, 0.05, 0.7, 0, CH, lw * 0.5);
      box(c, pr, x, y, w, d, 0.05, 0.7, WHITE, lw);
      box(c, pr, x + w * 0.38, y + d * 0.3, 0.55, 0.4, 0.01, 0.75, ['#e0e0dc', '#d4d4d0', '#eaeae6'], lw * 0.5);
      break;
    case 'board':
      line3(c, pr, [x + 0.25, y + d / 2, 0], [x + 0.25, y + d / 2, z0], EDGE, lw * 1.6);
      line3(c, pr, [x + w - 0.25, y + d / 2, 0], [x + w - 0.25, y + d / 2, z0], EDGE, lw * 1.6);
      box(c, pr, x, y, w, d, h, z0, ['#ffffff', '#e1e1dd', '#efefec'], lw);
      c.strokeStyle = 'rgba(60,60,58,.55)';
      c.lineWidth = lw * 1.2;
      c.beginPath();
      [[0.4, 0.3], [1.3, 0.65], [2.1, 0.45], [3.4, 0.8]].forEach(([u, v], i) => {
        const p = pr(x + u, y + d, z0 + h * v);
        if (i) c.lineTo(p[0], p[1]);
        else c.moveTo(p[0], p[1]);
      });
      c.stroke();
      break;
    case 'kiosk':
      box(c, pr, x + 0.32, y + 0.22, w - 0.64, d - 0.44, h - 0.15, 0, WHITE, lw);
      box(c, pr, x, y, w, d, 0.15, h - 0.15, WHITE, lw);
      box(c, pr, x + 0.12, y + 0.12, w - 0.24, d - 0.24, 0.01, h, SCR, lw * 0.5);
      break;
    case 'vault':
      box(c, pr, x, y, w, d, h, 0, WHITE, lw);
      box(c, pr, x + 0.15, y + 0.15, w - 0.3, d - 0.3, 0.01, h, SCR, lw * 0.5);
      for (let k = 0; k < 4; k++) {
        const p = pr(x + 0.45 + (k * (w - 0.9)) / 3, y + d, h * 0.5);
        c.beginPath();
        c.ellipse(p[0], p[1], S_ * 0.12, S_ * 0.15, 0, 0, 7);
        c.fillStyle = '#ffffff';
        c.fill();
        c.strokeStyle = EDGE;
        c.lineWidth = lw;
        c.stroke();
        c.beginPath();
        c.arc(p[0], p[1], S_ * 0.035, 0, 7);
        c.fillStyle = EDGE;
        c.fill();
      }
      break;
    case 'glass': {
      const L = [pr(x, y + d, z0), pr(x + w, y + d, z0), pr(x + w, y + d, z0 + h), pr(x, y + d, z0 + h)];
      const R = [pr(x + w, y, z0), pr(x + w, y + d, z0), pr(x + w, y + d, z0 + h), pr(x + w, y, z0 + h)];
      const Tp = [pr(x, y, z0 + h), pr(x + w, y, z0 + h), pr(x + w, y + d, z0 + h), pr(x, y + d, z0 + h)];
      const big = d > w ? R : L;
      poly(c, L, 'rgba(185,200,204,.17)');
      poly(c, R, 'rgba(185,200,204,.22)');
      poly(c, big, null, '#868c8d', lw * 0.8);
      poly(c, Tp, '#c9cecf', '#6f7576', lw * 0.8);
      const u = (a: Pt, b: Pt, k: number): Pt => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
      const r0 = u(u(big[0], big[1], 0.3), u(big[3], big[2], 0.3), 0.2);
      const r1 = u(u(big[0], big[1], 0.6), u(big[3], big[2], 0.6), 0.75);
      c.strokeStyle = 'rgba(255,255,255,.85)';
      c.lineWidth = lw * 1.3;
      c.beginPath();
      c.moveTo(r0[0], r0[1]);
      c.lineTo(r1[0], r1[1]);
      c.stroke();
      break;
    }
    case 'wall':
      box(c, pr, x, y, w, d, h, z0, WHITE, lw);
      break;
  }
}

/** Text lying flat on the floor in axonometric view. */
export function floorText(ctx: Ctx, pr: Proj, C: number, Sn: number, x: number, y: number, parts: [string, string, string][]) {
  ctx.save();
  const o = pr(x, y);
  ctx.translate(o[0], o[1]);
  ctx.transform(C, Sn, -C, Sn, 0, 0);
  ctx.textBaseline = 'alphabetic';
  let cx = 0;
  for (const [txt, font, col] of parts) {
    ctx.font = font;
    ctx.fillStyle = col;
    ctx.fillText(txt, cx, 0);
    cx += ctx.measureText(txt + ' ').width;
  }
  ctx.restore();
}

/** North arrow in the bottom-right corner. */
export function northArrow(ctx: Ctx, pr: Proj, cw: number, ch: number) {
  const v0 = pr(0, 0);
  const v1 = pr(0, -1);
  let vx = v1[0] - v0[0];
  let vy = v1[1] - v0[1];
  const L = Math.hypot(vx, vy);
  vx /= L;
  vy /= L;
  const nx = cw - 36;
  const ny = ch - 40;
  const R = 12;
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(nx, ny, R, 0, 7);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(nx + vx * R, ny + vy * R);
  ctx.lineTo(nx - vy * R * 0.35, ny + vx * R * 0.35);
  ctx.lineTo(nx + vy * R * 0.35, ny - vx * R * 0.35);
  ctx.closePath();
  ctx.fill();
  ctx.font = '500 10px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('N', nx + vx * (R + 9), ny + vy * (R + 9));
  ctx.textAlign = 'left';
}
