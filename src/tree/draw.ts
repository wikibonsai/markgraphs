/**
 * the drawing: ribbons, knots and leaves, one canvas frame. The host draws its own decoration (a trunk, soil)
 * behind and in front through the mount's hooks
 */
import type { Scene } from './scene';
import type { TreeLook } from '../look/look';

// a leaf's length at scale 1
const LEAF: number = 19;
/** a hidden root's limb drops this far below its row before it meets the host's edge */
export function limbDrop(k: number): number { return Math.min(46, 50 * k); }

/** the screen x where a limb meets the host's edge at screen y */
export type Edge = (sy: number) => number;

// what a frame is drawn with: the context, the colours, the leaf's path, and the host's edge, paper and hooks
export interface Pen {
  g: CanvasRenderingContext2D;
  look: TreeLook;
  leaf: Path2D;
  edge: Edge;
  bg: string;
  behind: () => void;
  front: () => void;
}

// a branch on screen: a cubic from (x0, y0) to (x1, y1), level at both ends, its width easing w0 to w1
interface Branch { x0: number; y0: number; w0: number; x1: number; y1: number; w1: number }

const NX: number[] = [], NY: number[] = [], NW: number[] = [];
function ribbon(p: Path2D, b: Branch): void {
  const { x0, y0, w0, x1, y1, w1 } = b;
  const n: number = Math.min(24, Math.max(6, Math.round((Math.abs(y1 - y0) + Math.abs(x1 - x0)) / 9))), m: number = (x0 + x1) / 2;
  for (let s: number = 0; s <= n; s++) {
    const t: number = s / n, u: number = 1 - t;
    const dx: number = 3 * u * u * (m - x0) + 3 * t * t * (x1 - m), dy: number = 6 * u * t * (y1 - y0);
    const l: number = Math.hypot(dx, dy) || 1, h: number = (w0 + (w1 - w0) * t) / 2;
    NX[s] = u * u * u * x0 + 3 * u * t * m + t * t * t * x1;
    NY[s] = (u * u * u + 3 * u * u * t) * y0 + (3 * u * t * t + t * t * t) * y1;
    NW[s] = dx / l * h; NW[s + 40] = -dy / l * h;
  }
  p.moveTo(NX[0] + NW[40], NY[0] + NW[0]);
  for (let s: number = 1; s <= n; s++) { p.lineTo(NX[s] + NW[s + 40], NY[s] + NW[s]); }
  for (let s: number = n; s >= 0; s--) { p.lineTo(NX[s] - NW[s + 40], NY[s] - NW[s]); }
  p.closePath();
}

// a shown root's branch: its own ribbon, blending from the bark into its band over the first half
function rootRibbon(pen: Pen, si: number, b: Branch): void {
  const { g, look } = pen;
  const p: Path2D = new Path2D();
  ribbon(p, b);
  const fill: CanvasGradient = g.createLinearGradient(b.x0, 0, b.x1, 0);
  fill.addColorStop(0, look.bark);
  fill.addColorStop(0.5, look.subjects[si]);
  g.fillStyle = fill; g.fill(p);
}

// a knot's radius at scale 1: a limb's (a hidden root's child) or the root's own is the larger
function knotRadius(s: Scene, i: number): number {
  return (s.rootShown ? i === 0 : s.model.depth[i] === 1) ? 7 : 4.5;
}

// the band a node's wood wears: the root's own is its first subject's
function bandOf(s: Scene, i: number): number {
  return Math.max(0, s.model.subjectOf[i]);
}

// draws the wood: ribbons per band, the halo under the picked and hovered paths. Returns the nodes whose knot or
// leaf is on screen (the labels' candidates), and leaves each one's hit point in the scene
function drawWood(s: Scene, pen: Pen): number[] {
  const { g, look, edge } = pen;
  const { kids, depth, parents, subjects } = s.model;
  const W: number = s.W, H: number = s.H, L: number = s.inset.left, k: number = s.k;
  const ox: number = L + s.tx, q: number = s.kx(), z: number = Math.max(0.45, Math.min(1.5, k));
  const lit: Set<number> = s.pathSet(s.selected), warm: Set<number> = s.pathSet(s.hovered);
  const bands: number = Math.max(1, subjects.length);
  const paths = (): Path2D[] => Array.from({ length: bands }, (): Path2D => new Path2D());
  const path: Path2D[] = paths(), thin: Path2D[] = paths();
  const halo: Path2D = new Path2D(), halo2: Path2D = new Path2D();
  const shown: number[] = [];
  const drop: number = limbDrop(k);
  for (const i of s.drawn) {
    const gr: number = s.drawnGrow[i];
    if (gr < 0.02 || s.skip[i]) { continue; }
    const p: number = parents[i], limb: boolean = !s.rootShown && depth[i] === 1, hub: boolean = kids[i].length > 0;
    const y1: number = s.screenY(i), x1: number = ox + s.drawnX[i] * q;
    const x2: number = x1 + (hub && (s.open[i] || s.row * k >= 20) ? (limb && !s.open[i] ? 0 : s.labelWidth(i) * q * gr) : 0);
    s.hitX[i] = hub ? x1 : x1 + LEAF * 0.58 * z; s.hitY[i] = y1;
    if (y1 > -20 && y1 < H + 20 && x1 < W && x1 + s.labelWidth(i) * q > L - 40) { shown.push(i); }
    // the root has no branch of its own
    if (i === 0) { continue; }
    const y0: number = limb ? y1 + drop : s.screenY(p);
    const x0: number = limb ? edge(y1 + drop) : ox + (s.drawnX[p] + s.labelWidth(p) * s.drawnGrow[p]) * q;
    if (Math.max(y0, y1) < -20 || Math.min(y0, y1) > H + 20 || x0 > W || Math.max(x1, x2) < L - 40) { continue; }
    // a subtree under a pixel tall is its neighbours' stroke already
    if (s.span[i] * k < 1.2 && i % 3) { continue; }
    const w1: number = Math.max(k < 0.3 ? 0.9 : 1.4, s.thick(i) * z * gr);
    const w0: number = limb ? w1 * 2.2 + 7 * z : Math.max(w1, Math.min(s.thick(p) * z * 0.85, w1 * 1.6));
    const si: number = bandOf(s, i);
    if (Math.max(w0, w1) < 1.6) { const m: number = (x0 + x1) / 2; thin[si].moveTo(x0, y0); thin[si].bezierCurveTo(m, y0, m, y1, x1, y1); }
    else if (s.rootShown && depth[i] === 1) { rootRibbon(pen, si, { x0, y0, w0, x1, y1, w1 }); }
    else { ribbon(path[si], { x0, y0, w0, x1, y1, w1 }); }
    // the stalk its name stands on
    if (hub && x2 > x1) {
      const e: number = s.open[i] ? Math.max(w1 * 0.9, 1.6) : 1.6;
      path[si].rect(x1, y1 - e / 2, x2 - x1, e);
    }
    const hp: Path2D | null = lit.has(i) ? halo : warm.has(i) ? halo2 : null;
    if (hp) { const m: number = (x0 + x1) / 2; hp.moveTo(x0, y0); hp.bezierCurveTo(m, y0, m, y1, x1, y1); if (hub) { hp.lineTo(x2, y1); } }
  }
  // the root's own stalk
  if (s.rootShown && s.drawn.includes(0) && kids[0].length) {
    const x1: number = ox + s.drawnX[0] * q, y1: number = s.screenY(0), e: number = s.open[0] ? Math.max(s.thick(0) * z * 0.6, 1.6) : 1.6;
    g.fillStyle = look.bark; g.fillRect(x1, y1 - e / 2, s.labelWidth(0) * q, e);
  }
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = look.warm; g.lineWidth = 9 * z;
  g.globalAlpha = look.dark ? 0.32 : 0.26; g.stroke(halo);
  g.globalAlpha = 0.22; g.stroke(halo2); g.globalAlpha = 1;
  for (let si: number = 0; si < bands; si++) {
    g.fillStyle = g.strokeStyle = look.subjects[si]; g.lineWidth = k < 0.12 ? 0.8 : 1.4; g.stroke(thin[si]); g.fill(path[si]);
  }
  return shown;
}

// the knots, hollow open and filled folded, and the leaves
function drawKnots(s: Scene, pen: Pen, shown: number[]): void {
  const { g, look, leaf, bg } = pen;
  const { kids } = s.model;
  const dpr: number = s.dpr, k: number = s.k, ox: number = s.inset.left + s.tx, q: number = s.kx(), z: number = Math.max(0.45, Math.min(1.5, k));
  for (const i of shown) {
    const gr: number = s.drawnGrow[i], x: number = ox + s.drawnX[i] * q, y: number = s.hitY[i];
    const sel: boolean = i === s.selected;
    const wood: string = i === 0 ? look.bark : look.subjects[bandOf(s, i)];
    if (kids[i].length) {
      if (s.span[i] * k < 3) { continue; }
      const r: number = Math.max(2, knotRadius(s, i) * z * gr) * (sel ? 1.35 : 1);
      if (sel) { g.globalAlpha = 0.3; g.fillStyle = look.warm; g.beginPath(); g.arc(x, y, r + 4, 0, 7); g.fill(); g.globalAlpha = 1; }
      g.beginPath(); g.arc(x, y, r, 0, 7);
      g.fillStyle = s.open[i] ? (sel ? look.warm : bg) : wood; g.fill();
      g.lineWidth = Math.max(1.2, Math.min(2.4, r * 0.44)); g.strokeStyle = wood; g.stroke();
    } else if (k < 0.3 && s.opts.across > 0) {
      // (squeezed, far out: a square a leaf, and only every other one under a pixel)
      if (s.span[i] * k < 1.2 && i % 2) { continue; }
      const r: number = Math.max(0.8, 6 * k); g.fillStyle = look.leaves[i] || look.root; g.fillRect(x, y - r, 2 * r, 2 * r);
    } else {
      const L: number = LEAF * z * gr * (sel ? 1.28 : 1);
      if (sel) { g.globalAlpha = 0.35; g.fillStyle = look.pick; g.beginPath(); g.arc(x + L * 0.55, y, L * 0.62, 0, 7); g.fill(); g.globalAlpha = 1; }
      g.setTransform(0, dpr * L, dpr * L, 0, dpr * x, dpr * y);
      g.fillStyle = look.leaves[i] || look.root; g.fill(leaf);
      if (sel) { g.lineWidth = 2 / L; g.strokeStyle = look.warm; g.stroke(leaf); }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }
}

/** draws one frame of the tree between the host's hooks; returns the nodes on screen (the labels' candidates) */
export function drawScene(s: Scene, pen: Pen): number[] {
  const { g } = pen;
  const dpr: number = s.dpr;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, s.W, s.H);
  pen.behind();
  g.save();
  g.beginPath(); g.rect(s.inset.left - 60, 0, s.W, s.H); g.clip();
  const shown: number[] = drawWood(s, pen);
  drawKnots(s, pen, shown);
  g.restore();
  pen.front();
  return shown;
}
