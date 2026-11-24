/**
 * mounts the tree on a host: the canvas, the label layer, the frame loop, the keys and the resize. Everything it
 * binds is unbound by dispose()
 */
import type { TreeArrays, TreeInput } from './data';
import type { TreeModel } from './model';
import type { Paper, TreeLook } from '../look/look';
import type { FitOpts, Inset, ViewTarget, ZoomOpts } from './view';
import type { Rows } from './scene';
import { toArrays } from './data';
import { buildModel } from './model';
import { treeLook } from '../look/look';
import { COIN_LEAF } from './leaf-shape';
import { Scene } from './scene';
import type { Hooks } from './draw';
import { drawScene } from './draw';
import { LABEL_FONT, LabelLayer, ROOT_FONT } from './labels';
import { bindInput } from './input';
import { branchView, fitView, revealView, zoomView } from './view';
import { LABEL_CSS } from './style';

export interface Frame {
  W: number; H: number; dpr: number;
  k: number; kx: number; tx: number; ty: number;
  tall: number; wide: number;
  inset: Inset;
  look: TreeLook;
}

export interface MountOpts {
  paper?: Paper;
  // the host's paper colour, for hollow knots and the names' halo (the look's by default)
  bg?: string;
  reducedMotion?: boolean;
  root?: 'show' | 'hide';
  // px kept clear per side, read each frame
  inset?: Inset | ((W: number, H: number) => Inset);
  // hidden root: the screen x where a limb meets the host's edge at screen y
  edge?: (sy: number, frame: Frame) => number;
  // drawn on the same canvas under the tree, and over it
  behind?: (g: CanvasRenderingContext2D, frame: Frame) => void;
  front?: (g: CanvasRenderingContext2D, frame: Frame) => void;
  // dot colours under a name
  decorate?: (i: number) => string[];
  onPick?: (i: number) => void;
  onUnpick?: () => void;
  onFold?: (i: number, open: boolean) => void;
  // -1 when nothing is hovered
  onHover?: (i: number) => void;
  // the view was moved by hand
  onMoved?: () => void;
  onFrame?: (frame: Frame) => void;
  keys?: 'host' | 'window' | 'none';
  rows?: Rows;
  fit?: FitOpts;
  zoom?: ZoomOpts;
  // open with only the root open when the tree's width would be under this scale to fit
  foldUnder?: number;
  // fit again after a fold or a resize until the view is moved by hand
  refit?: boolean;
}

export interface TreeMount {
  model: TreeModel;
  setData(tree: TreeInput): void;
  fit(): void;
  expandAll(): void;
  collapseAll(): void;
  reset(): void;
  reveal(i: number): void;
  // opens the branch and frames its rows
  focusBranch(i: number): void;
  // -1 drops the pick
  select(i: number): void;
  toggle(i: number): void;
  // about the middle
  zoom(f: number): void;
  // an arrow key's name
  walk(key: string): void;
  setPaper(paper: Paper, bg?: string): void;
  resize(): void;
  // how far each node has grown out of its parent (0 to 1), asked every frame; null stands the tree grown
  setGrowth(growth: ((i: number) => number) | null): void;
  frame(): Frame;
  screenY(i: number): number;
  // the screen y where a node's rows start
  blockTop(i: number): number;
  isOpen(i: number): boolean;
  visible(): number;
  find(name: string): number;
  dispose(): void;
}

const EDITING: Set<string> = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
const NO_INSET: Inset = { top: 0, right: 0, bottom: 0, left: 0 };

// the label styles, once per document
function ensureStyle(): void {
  if (document.head.querySelector('style[data-markgraphs]') !== null) { return; }
  const style: HTMLStyleElement = document.createElement('style');
  style.dataset.markgraphs = '';
  style.textContent = LABEL_CSS;
  document.head.append(style);
}

function context(canvas: HTMLCanvasElement, what: string): CanvasRenderingContext2D {
  const g: CanvasRenderingContext2D | null = canvas.getContext('2d');
  if (g === null) { throw new Error(`markgraphs: no 2d context ${what}`); }
  return g;
}

/** mounts a tree on the host: a canvas and a label layer, the frame loop, the keys and the resize */
export function mountTree(host: HTMLElement, tree: TreeInput, opts: MountOpts = {}): TreeMount {
  const paperOf = (p: Paper | undefined): Paper => p === 'light' ? 'light' : 'dark';
  const rootShown: boolean = opts.root !== 'hide';
  const rows: Rows = opts.rows ?? { least: 31, most: 31 };
  const fitOpts: FitOpts = opts.fit ?? { most: 1.15, squeeze: false };
  const zoomOpts: ZoomOpts = opts.zoom ?? { least: 0.15, most: 4 };
  const across: number = fitOpts.squeeze ? 0.8 : 0;
  const reducedMotion: boolean = opts.reducedMotion === true;
  const insetOf = (W: number, H: number): Inset => typeof opts.inset === 'function' ? opts.inset(W, H) : opts.inset ?? NO_INSET;

  ensureStyle();
  host.classList.add('mg');
  const canvas: HTMLCanvasElement = document.createElement('canvas');
  canvas.className = 'mg-canvas';
  const labelHost: HTMLDivElement = document.createElement('div');
  labelHost.className = 'mg-labels';
  host.append(canvas, labelHost);
  const g: CanvasRenderingContext2D = context(canvas, 'on the host\'s canvas');
  const measurer: CanvasRenderingContext2D = context(document.createElement('canvas'), 'to measure labels with');
  const measure = (text: string, root: boolean): number => {
    measurer.font = root ? ROOT_FONT : LABEL_FONT;
    return measurer.measureText(text).width;
  };
  const leaf: Path2D = new Path2D(COIN_LEAF);

  let model: TreeModel;
  let scene: Scene;
  let looks: Map<Paper, TreeLook>;
  let look: TreeLook;
  let paper: Paper = paperOf(opts.paper);
  let bg: string | undefined = opts.bg;
  let labels: LabelLayer;
  let unbindInput: () => void = (): void => {};
  let rect: DOMRect = host.getBoundingClientRect();
  let movedByHand: boolean = false;
  let disposed: boolean = false;
  let raf: number = 0;

  const lookOf = (p: Paper): TreeLook => {
    let l: TreeLook | undefined = looks.get(p);
    if (l === undefined) { l = treeLook(model, p); looks.set(p, l); }
    return l;
  };
  const frame = (): Frame => ({
    W: scene.W, H: scene.H, dpr: scene.dpr, k: scene.k, kx: scene.kx(), tx: scene.tx, ty: scene.ty,
    tall: scene.tall, wide: scene.wide, inset: scene.inset, look,
  });
  const at = (e: { clientX: number; clientY: number }): { x: number; y: number } => ({ x: e.clientX - rect.left, y: e.clientY - rect.top });

  // acts

  const glide = (v: ViewTarget): void => scene.glideTo(v.k, v.tx, v.ty);
  const fitTarget = (): ViewTarget => fitView(scene.viewport(), scene.tallTo, scene.wideTo, fitOpts);
  const widthFit = (): number => Math.min(fitOpts.most, (scene.W - scene.inset.left - scene.inset.right - 28) / scene.wideTo);
  function fit(): void { movedByHand = false; glide(fitTarget()); }
  function home(): void { fit(); scene.settle(); }
  // a fold or a resize keeps the fit until the view was moved by hand
  function refit(): void { if (opts.refit === true && !movedByHand) { home(); } }
  function toggle(i: number): void {
    if (!model.kids[i].length) { return; }
    scene.open[i] = scene.open[i] ? 0 : 1;
    // the fold holds the view
    scene.glide = null;
    scene.relayout(i);
    refit();
    opts.onFold?.(i, scene.open[i] === 1);
  }
  function select(i: number): void {
    const was: number = scene.selected;
    scene.selected = i; scene.dirty = true;
    if (i < 0) { if (was >= 0) { opts.onUnpick?.(); } return; }
    opts.onPick?.(i);
  }
  function reveal(i: number): void {
    for (let a: number = model.parents[i]; a > 0; a = model.parents[a]) { scene.open[a] = 1; }
    // (its glide is the motion)
    scene.relayout(i, true);
    select(i);
    glide(revealView(scene.viewport(), scene.k, scene.x[i], scene.y[i]));
  }
  function focusBranch(i: number): void {
    if (!scene.open[i]) { toggle(i); }
    glide(branchView(scene.H, scene.y[i], scene.span[i]));
  }
  function setAll(v: 0 | 1): void {
    // inside the picked branch, else the whole tree
    const root: number = scene.selected > 0 && model.kids[scene.selected].length ? scene.selected : 0;
    for (let i: number = root + 1; i < root + model.count[root]; i++) {
      if (model.kids[i].length && (root > 0 || model.depth[i] > 1 || v || rootShown)) { scene.open[i] = v; }
    }
    if (root > 0) { scene.open[root] = v; } else if (!v && !rootShown) { for (const s of model.subjects) { scene.open[s] = 0; } }
    scene.relayout(-1);
    fit();
  }
  function reset(): void {
    scene.openDefaults();
    select(-1);
    scene.relayout(-1);
    fit();
  }
  function zoomAt(f: number, cx: number, cy: number): void {
    movedByHand = true;
    const now: ViewTarget = { k: scene.k, tx: scene.tx, ty: scene.ty };
    const v: ViewTarget = zoomView(now, f, cx, cy, scene.viewport(), scene.tallTo, scene.wide, zoomOpts, across);
    scene.k = v.k; scene.tx = v.tx; scene.ty = v.ty; scene.dirty = true;
    opts.onMoved?.();
  }
  function zoomMid(f: number): void { zoomAt(f, scene.W / 2, scene.H / 2); }
  function moved(): void { movedByHand = true; opts.onMoved?.(); }
  function walk(key: string): void {
    const sel: number = scene.selected;
    if (sel < 0) {
      const first: number = rootShown ? 0 : model.subjects.length && model.kids[model.subjects[0]].length ? model.kids[model.subjects[0]][0] : -1;
      if (first >= 0) { reveal(first); }
      return;
    }
    const sib: number[] = sel === 0 ? [0] : model.kids[model.parents[sel]], j: number = sib.indexOf(sel);
    let to: number = -1;
    if (key === 'ArrowDown') { to = sib[j + 1] ?? -1; }
    if (key === 'ArrowUp') { to = sib[j - 1] ?? -1; }
    if (key === 'ArrowRight' && model.kids[sel].length) { if (!scene.open[sel]) { toggle(sel); } else { to = model.kids[sel][0]; } }
    if (key === 'ArrowLeft') {
      if (scene.open[sel] && model.kids[sel].length) { toggle(sel); }
      else if (model.depth[sel] > (rootShown ? 0 : 2)) { to = model.parents[sel]; }
    }
    if (to < 0 || (to === 0 && !rootShown)) { return; }
    select(to);
    const y: number = scene.ty + scene.y[to] * scene.k, x: number = scene.inset.left + scene.tx + scene.x[to] * scene.kx();
    scene.glideTo(
      scene.k,
      x < scene.inset.left || x > scene.W - 220 ? (scene.W - scene.inset.left) * 0.35 - scene.x[to] * scene.kx() : scene.tx,
      y < 60 || y > scene.H - 60 ? scene.H / 2 - scene.y[to] * scene.k : scene.ty,
    );
  }
  function setPaper(p: Paper, nextBg?: string): void {
    paper = paperOf(p);
    bg = nextBg ?? bg;
    look = lookOf(paper);
    labels.look = look;
    host.dataset.paper = paper;
    scene.dirty = true;
  }

  // the frame

  function tick(now: number): void {
    if (disposed) { return; }
    raf = requestAnimationFrame(tick);
    if (!scene.tick(now)) { return; }
    scene.inset = insetOf(scene.W, scene.H);
    scene.clampView();
    const f: Frame = frame();
    const edge = (sy: number): number => opts.edge ? opts.edge(sy, f) : scene.inset.left;
    const hooks: Hooks = { behind: (): void => opts.behind?.(g, f), front: (): void => opts.front?.(g, f) };
    const shown: number[] = drawScene(g, scene, look, leaf, edge, bg ?? look.bg, hooks);
    labels.place(shown);
    opts.onFrame?.(f);
  }

  function resize(): void {
    rect = host.getBoundingClientRect();
    const W: number = Math.max(1, Math.round(rect.width)), H: number = Math.max(1, Math.round(rect.height));
    scene.resize(W, H, Math.min(2, window.devicePixelRatio || 1), insetOf(W, H));
    canvas.width = W * scene.dpr;
    canvas.height = H * scene.dpr;
    if (opts.refit === true && !movedByHand) { scene.relayout(-1, true); home(); }
  }

  function onKey(e: KeyboardEvent): void {
    const t: HTMLElement | null = e.target as HTMLElement | null;
    if (t !== null && (EDITING.has(t.tagName) || t.isContentEditable)) { return; }
    if (e.metaKey || e.ctrlKey || e.altKey) { return; }
    if (e.key === 'Escape') { select(-1); return; }
    if (e.key === ']') { setAll(1); } else if (e.key === '[') { setAll(0); }
    else if (e.key === 'r') { reset(); } else if (e.key === 'f' || e.key === '0') { fit(); }
    else if (e.key === '+' || e.key === '=') { zoomMid(1.25); } else if (e.key === '-') { zoomMid(0.8); }
    else if (e.key.startsWith('Arrow')) { walk(e.key); }
    else { return; }
    e.preventDefault();
  }

  // the tree

  function boot(input: TreeInput): void {
    const data: TreeArrays = toArrays(input);
    model = buildModel(data);
    looks = new Map();
    look = lookOf(paper);
    scene = new Scene(model, measure, { reducedMotion, rootShown, rows, across, fit: fitOpts });
    labels = new LabelLayer(labelHost, scene, look, opts.decorate ?? ((): string[] => []));
    unbindInput = bindInput(host, labelHost, scene, at, { toggle, pick: select, zoom: zoomAt, hover: (i: number): void => opts.onHover?.(i), moved });
    host.dataset.paper = paper;
    movedByHand = false;
    resize();
    scene.relayout(-1, true);
    // a tree too wide to read whole opens on its limbs
    if (opts.foldUnder !== undefined && widthFit() < opts.foldUnder) { scene.openRootOnly(); scene.relayout(-1, true); }
    home();
  }
  function clear(): void {
    unbindInput();
    labels.clear();
  }

  boot(tree);
  const keyTarget: Window | HTMLElement | null = opts.keys === 'window' ? window : opts.keys === 'none' ? null : host;
  keyTarget?.addEventListener('keydown', onKey as EventListener);
  const observer: ResizeObserver | null = typeof ResizeObserver === 'function' ? new ResizeObserver((): void => resize()) : null;
  observer?.observe(host);
  window.addEventListener('resize', resize);
  raf = requestAnimationFrame(tick);

  return {
    get model(): TreeModel { return model; },
    setData: (next: TreeInput): void => { clear(); boot(next); },
    fit, reset, reveal, focusBranch, select, toggle, walk, setPaper, resize, frame,
    expandAll: (): void => setAll(1),
    collapseAll: (): void => setAll(0),
    zoom: zoomMid,
    setGrowth: (growth: ((i: number) => number) | null): void => scene.setGrowth(growth),
    screenY: (i: number): number => scene.screenY(i),
    blockTop: (i: number): number => scene.ty + (scene.drawnY[i] - scene.span[i] / 2) * scene.k,
    isOpen: (i: number): boolean => scene.open[i] === 1,
    visible: (): number => scene.visible.length,
    find: (name: string): number => model.names.indexOf(name),
    dispose: (): void => {
      disposed = true;
      cancelAnimationFrame(raf);
      clear();
      keyTarget?.removeEventListener('keydown', onKey as EventListener);
      observer?.disconnect();
      window.removeEventListener('resize', resize);
      canvas.remove();
      labelHost.remove();
      host.classList.remove('mg');
      delete host.dataset.paper;
    },
  };
}
