/** the tree as drawn: each node's target and drawn position, the fold's tween between them, and the view */
import type { TreeModel } from './model';
import type { LayoutOpts, LayoutOut, LayoutResult } from './layout';
import type { FitOpts, Inset, Viewport } from './view';
import { layoutTree, thickness } from './layout';
import { easeInOut, easeOut, holdTx, holdTy, isWhole, scaleAcross } from './view';

/** a fold's tween and a view glide, ms */
export const FOLD_MS: number = 420;
export const GLIDE_MS: number = 600;
// an open branch's knot slides along its children to stay in view, clear of the top and the foot
const PAD_TOP: number = 76;
const PAD_BOTTOM: number = 44;
// a hidden root's children carry no label: only a knot's width
const KNOT_ONLY: number = 26;

export interface Glide { t: number; k0: number; k1: number; x0: number; x1: number; y0: number; y1: number }

export interface Rows { least: number; most: number }

export interface SceneOpts {
  reducedMotion: boolean;
  rootShown: boolean;
  // the row height's range: rows spread to fill the height between them
  rows: Rows;
  // the least scale across (0 for none)
  across: number;
  fit: FitOpts;
}

/** the px a label takes: `root` for the root's larger font */
export type Measure = (text: string, root: boolean) => number;

// how far inside the host's edge a limb starts to grow, world px
const LIMB_START: number = 30;

export class Scene {
  readonly model: TreeModel;
  readonly opts: SceneOpts;
  // which branches are open
  readonly open: Uint8Array;
  // target columns, rows and growth (0 to 1); where they are drawn; where the tween started
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly grow: Float32Array;
  readonly drawnX: Float32Array;
  readonly drawnY: Float32Array;
  readonly drawnGrow: Float32Array;
  private growth: ((i: number) => number) | null = null;
  readonly fromX: Float32Array;
  readonly fromY: Float32Array;
  readonly fromGrow: Float32Array;
  // the rows a node's subtree spans
  readonly span: Float32Array;
  // the screen point a click on a node's knot or leaf hits
  readonly hitX: Float32Array;
  readonly hitY: Float32Array;
  // laid out, parents first; drawn: laid out and what is leaving
  visible: number[] = [];
  drawn: number[] = [];
  // the row height in use
  row: number;
  // the tree's height and width, eased through a fold to where they land
  tall: number = 0;
  wide: number = 0;
  tallTo: number = 0;
  tallFrom: number = 0;
  wideTo: number = 0;
  wideFrom: number = 0;
  // what comes or goes out of sight is not drawn through a fold
  readonly skip: Uint8Array;
  came: number[] = [];
  left: number[] = [];
  // the fold's tween: -1 idle, 0 armed to start on the next frame, else its start time
  tweenStart: number = -1;
  // the fold's view: the clicked branch stays where it was
  tyGoal: number = NaN;
  tyFrom: number = 0;
  glide: Glide | null = null;
  // the view: scale, px right of the left inset's edge, the screen y of world 0
  k: number = 0.9;
  tx: number = 0;
  ty: number = 0;
  W: number = 0;
  H: number = 0;
  dpr: number = 1;
  inset: Inset = { top: 0, right: 0, bottom: 0, left: 0 };
  selected: number = -1;
  hovered: number = -1;
  dirty: boolean = true;
  private readonly widths: Float32Array;
  private readonly measure: Measure;

  constructor(model: TreeModel, measure: Measure, opts: SceneOpts) {
    this.model = model;
    this.measure = measure;
    this.opts = opts;
    this.row = opts.rows.least;
    const n: number = model.size;
    const F = (): Float32Array => new Float32Array(n);
    this.open = new Uint8Array(n);
    this.x = F(); this.y = F(); this.grow = F();
    this.drawnX = F(); this.drawnY = F(); this.drawnGrow = F();
    this.fromX = F(); this.fromY = F(); this.fromGrow = F();
    this.span = F(); this.hitX = F(); this.hitY = F();
    this.skip = new Uint8Array(n);
    this.widths = F();
    this.openDefaults();
  }

  get rootShown(): boolean { return this.opts.rootShown; }

  // the tree as it opens: everything open under a shown root; a hidden root's subjects open, all under them folded
  openDefaults(): void {
    this.open.fill(0);
    if (this.rootShown) { for (let i: number = 0; i < this.model.size; i++) { if (this.model.kids[i].length) { this.open[i] = 1; } } }
    else { for (const s of this.model.subjects) { this.open[s] = 1; } }
  }

  // only the root open: the limbs shut
  openRootOnly(): void {
    this.open.fill(0);
    this.open[0] = 1;
  }

  // the px a node's label takes: a hidden root's subjects stand on the host's edge, so only a knot's width
  labelWidth(i: number): number {
    if (!this.rootShown && this.model.depth[i] < 2) { return KNOT_ONLY; }
    if (this.widths[i] === 0) {
      this.widths[i] = Math.ceil(this.measure(this.model.names[i], i === 0)) + (this.model.kids[i].length ? 18 : 26);
    }
    return this.widths[i];
  }

  thick(i: number): number { return thickness(this.model, i); }

  viewport(): Viewport { return { W: this.W, H: this.H, inset: this.inset }; }

  // the scale across
  kx(): number { return scaleAcross(this.k, this.viewport(), this.wide, this.opts.across); }

  resize(W: number, H: number, dpr: number, inset: Inset): void {
    this.W = W; this.H = H; this.dpr = dpr; this.inset = inset;
    this.dirty = true;
  }

  // the node and its ancestors, root excluded
  pathSet(i: number): Set<number> {
    const s: Set<number> = new Set();
    for (let a: number = i; a > 0; a = this.model.parents[a]) { s.add(a); }
    return s;
  }

  private lay(row: number): LayoutResult {
    const out: LayoutOut = { x: this.x, y: this.y, span: this.span };
    const opts: LayoutOpts = { row, rootShown: this.rootShown, labelWidth: (i: number): number => this.labelWidth(i) };
    return layoutTree(this.model, this.open, opts, out);
  }

  // the row height that spreads the rows to fill the height at the fit's scale, within the range
  private rowFor(r: LayoutResult): number {
    const { least, most } = this.opts.rows;
    if (least === most) { return least; }
    const across: number = this.W - this.inset.left - this.inset.right - 28;
    const down: number = this.H - this.inset.top - this.inset.bottom;
    const kw: number = Math.min(this.opts.fit.most, across / r.wide);
    return Math.min(most, Math.max(least, (down / kw - 24) / r.rows));
  }

  layout(): void {
    let r: LayoutResult = this.lay(this.opts.rows.least);
    const row: number = this.rowFor(r);
    if (row !== this.opts.rows.least) { r = this.lay(row); }
    this.row = row;
    this.visible = r.visible;
    this.tallTo = r.tall;
    this.wideTo = r.wide;
    for (const i of r.visible) { this.grow[i] = 1; }
  }

  // lays the tree out again after a fold; what was clicked (`anchor`) stays where it was on screen. `jump` lands
  // at once instead of tweening
  relayout(anchor: number, jump: boolean = false): void {
    const { parents } = this.model;
    const before: Set<number> = new Set(this.drawn);
    const keepY: number = anchor > 0 && before.has(anchor) ? this.screenY(anchor) : NaN;
    const was: number[] = this.drawn;
    this.layout();
    const now: Set<number> = new Set(this.visible);
    this.tallFrom = this.tall; this.wideFrom = this.wide;
    for (const i of this.came) { this.skip[i] = 0; }
    for (const i of this.left) { this.skip[i] = 0; }
    this.came = []; this.left = [];
    if (jump || this.opts.reducedMotion) {
      this.tall = this.tallTo; this.wide = this.wideTo;
      this.drawn = this.visible;
      for (const i of this.visible) { this.drawnX[i] = this.x[i]; this.drawnY[i] = this.y[i]; this.drawnGrow[i] = 1; }
      for (const i of was) { if (!now.has(i)) { this.grow[i] = this.drawnGrow[i] = 0; } }
      this.tweenStart = -1;
    } else {
      // the nearest ancestor in a set: what a newcomer grows out of, what a leaver folds into
      const up = (i: number, set: Set<number>): number => { let a: number = parents[i]; while (a > 0 && !set.has(a)) { a = parents[a]; } return a; };
      for (const i of this.visible) {
        if (before.has(i)) { this.fromX[i] = this.drawnX[i]; this.fromY[i] = this.drawnY[i]; this.fromGrow[i] = this.drawnGrow[i]; continue; }
        this.came.push(i);
        const a: number = up(i, before);
        this.fromX[i] = a > 0 ? this.drawnX[a] + this.labelWidth(a) : 0;
        this.fromY[i] = a > 0 ? this.drawnY[a] : this.y[i];
        this.fromGrow[i] = 0;
      }
      const gone: number[] = was.filter((i: number): boolean => !now.has(i));
      this.left = gone;
      for (const i of gone) {
        const a: number = up(i, now);
        this.fromX[i] = this.drawnX[i]; this.fromY[i] = this.drawnY[i]; this.fromGrow[i] = this.drawnGrow[i];
        this.x[i] = a > 0 ? this.x[a] + this.labelWidth(a) : 0;
        this.y[i] = a > 0 ? this.y[a] : this.drawnY[i];
        this.grow[i] = 0;
      }
      this.drawn = [...this.visible, ...gone].sort((a: number, b: number): number => a - b);
      this.tweenStart = 0;
    }
    if (!Number.isNaN(keepY)) {
      this.tyGoal = holdTy(keepY - this.y[anchor] * this.k, this.tallTo, this.k, this.H);
      this.tyFrom = this.ty;
      if (this.tweenStart < 0) { this.ty = this.tyGoal; this.tyGoal = NaN; }
    }
    this.dirty = true;
  }

  // a node's screen row; an open branch slides along its own children to stay in view
  screenY(i: number): number {
    const { kids } = this.model;
    const y: number = this.ty + this.drawnY[i] * this.k, c: number[] = kids[i];
    if (!this.open[i] || !c.length || this.drawnGrow[c[0]] < 0.01) { return y; }
    const lo: number = this.ty + this.drawnY[c[0]] * this.k, hi: number = this.ty + this.drawnY[c[c.length - 1]] * this.k;
    return Math.max(Math.min(hi, Math.max(lo, PAD_TOP)), Math.min(Math.max(lo, Math.min(hi, this.H - PAD_BOTTOM)), y));
  }

  // the view glides to a scale and offsets (a reveal, a fit)
  glideTo(k: number, tx: number, ty: number): void {
    this.tyGoal = NaN;
    this.glide = { t: this.opts.reducedMotion ? -1e9 : performance.now(), k0: this.k, k1: k, x0: this.tx, x1: tx, y0: this.ty, y1: ty };
    this.dirty = true;
  }

  // the glide lands at once
  settle(): void {
    if (this.glide) { this.k = this.glide.k1; this.tx = this.glide.x1; this.ty = this.glide.y1; this.glide = null; }
    this.dirty = true;
  }

  /**
   * how far each node has grown out of its parent (0 to 1), asked every frame; null when the tree stands grown.
   * A hidden root's limbs grow from the host's edge
   */
  setGrowth(growth: ((i: number) => number) | null): void {
    this.growth = growth;
    this.dirty = true;
    if (growth !== null) { return; }
    for (const i of this.drawn) { this.drawnX[i] = this.x[i]; this.drawnY[i] = this.y[i]; this.drawnGrow[i] = this.grow[i]; }
  }

  private grown(growth: (i: number) => number): void {
    for (const i of this.drawn) {
      const u: number = Math.max(0, Math.min(1, growth(i)));
      const p: number = this.model.parents[i], limb: boolean = p === 0 && !this.opts.rootShown;
      const x0: number = p < 0 ? this.x[i] : limb ? -LIMB_START : this.drawnX[p] + this.labelWidth(p) * this.drawnGrow[p];
      const y0: number = p < 0 || limb ? this.y[i] : this.drawnY[p];
      this.drawnX[i] = x0 + (this.x[i] - x0) * u;
      this.drawnY[i] = y0 + (this.y[i] - y0) * u;
      this.drawnGrow[i] = u;
    }
  }

  // the fold's tween and the glide, one frame on: true when there is something to draw
  tick(now: number): boolean {
    if (this.tweenStart >= 0) {
      if (this.tweenStart === 0) {
        this.tweenStart = now;
        const endK: number = this.glide ? this.glide.k1 : this.k;
        const endY: number = !Number.isNaN(this.tyGoal) ? this.tyGoal : this.glide ? this.glide.y1 : this.ty;
        for (const i of this.came) { const y: number = endY + this.y[i] * endK; this.skip[i] = y < -this.H * 0.5 || y > this.H * 1.5 ? 1 : 0; }
        for (const i of this.left) {
          const y: number = this.ty + this.fromY[i] * this.k;
          this.skip[i] = y < -this.H * 0.5 || y > this.H * 1.5 ? 1 : 0;
        }
      }
      const u: number = Math.min(1, (now - this.tweenStart) / FOLD_MS), e: number = easeOut(u);
      for (const i of this.drawn) {
        this.drawnX[i] = this.fromX[i] + (this.x[i] - this.fromX[i]) * e;
        this.drawnY[i] = this.fromY[i] + (this.y[i] - this.fromY[i]) * e;
        this.drawnGrow[i] = this.fromGrow[i] + (this.grow[i] - this.fromGrow[i]) * e;
      }
      if (!Number.isNaN(this.tyGoal)) { this.ty = this.tyFrom + (this.tyGoal - this.tyFrom) * e; }
      this.tall = this.tallFrom + (this.tallTo - this.tallFrom) * e;
      this.wide = this.wideFrom + (this.wideTo - this.wideFrom) * e;
      if (u === 1) {
        for (const i of this.came) { this.skip[i] = 0; }
        for (const i of this.left) { this.skip[i] = 0; this.drawnGrow[i] = 0; }
        this.came = []; this.left = []; this.tweenStart = -1; this.tyGoal = NaN; this.drawn = this.visible;
      }
      this.dirty = true;
    }
    if (this.glide) {
      const g: Glide = this.glide;
      const u: number = Math.min(1, (now - g.t) / GLIDE_MS), e: number = easeInOut(u);
      this.k = g.k0 + (g.k1 - g.k0) * e; this.tx = g.x0 + (g.x1 - g.x0) * e; this.ty = g.y0 + (g.y1 - g.y0) * e;
      if (u >= 1) { this.glide = null; }
      this.dirty = true;
    }
    if (this.growth !== null) { this.grown(this.growth); this.dirty = true; }
    if (!this.dirty) { return false; }
    this.dirty = false;
    return true;
  }

  whole(): boolean { return isWhole(this.ty, this.tall, this.k, this.H); }

  // the view held inside the tree's reach and the inset
  clampView(): void {
    this.tx = holdTx(this.tx, this.viewport(), { wide: this.wide, kx: this.kx(), hug: !this.rootShown });
    this.ty = holdTy(this.ty, this.tall, this.k, this.H);
  }
}
