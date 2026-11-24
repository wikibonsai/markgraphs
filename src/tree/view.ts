/**
 * the view's maths: the scale and offsets that keep the tree in the viewport. `k` is the scale, `tx` the px the
 * tree stands right of the left inset's edge, `ty` the screen y of world 0
 */

export interface Inset { top: number; right: number; bottom: number; left: number }
export interface Viewport { W: number; H: number; inset: Inset }
export interface ViewTarget { k: number; tx: number; ty: number }
export interface FitOpts { most: number; squeeze: boolean }
export interface ZoomOpts { least: number; most: number }

// the margin a fit keeps clear of the inset
const MARGIN: number = 14;

/**
 * the scale across: held open at `least` and closed enough to fit the window (the right inset may cover it),
 * until zoomed in past that
 */
export function scaleAcross(k: number, v: Viewport, wide: number, least: number): number {
  const room: number = v.W - v.inset.left - 24;
  return Math.max(k, Math.min(least, wide > 0 ? room / wide : least));
}

/** the whole tree stands in the window: nothing to scroll down to */
export function isWhole(ty: number, tall: number, k: number, H: number): boolean {
  return ty > 8 && ty + tall * k < H - 8;
}

/** `ty` held so the foot never climbs past the window's, unless the whole tree is shorter than the window */
export function holdTy(ty: number, tall: number, k: number, H: number): number {
  const t: number = tall * k, least: number = Math.min(14 + (H - 60 - t) / 2, H - 50 - t);
  return t < H - 60 ? Math.min(H - 14 - t, Math.max(ty, 14)) : Math.min(70, Math.max(ty, least));
}

/**
 * `tx` held sideways as far as the tree reaches. Hugging (a hidden root) it never stands right of the edge;
 * free, it stays anywhere inside when it fits, else between its own edges
 */
export function holdTx(tx: number, v: Viewport, wide: number, kx: number, hug: boolean): number {
  const across: number = v.W - v.inset.left - v.inset.right;
  if (hug) { return Math.min(0, Math.max(tx, across - 20 - wide * kx)); }
  const far: number = across - MARGIN - wide * kx;
  return Math.min(Math.max(MARGIN, far), Math.max(tx, Math.min(MARGIN, far)));
}

/**
 * the whole tree in the viewport. Squeezed, only the height sets the scale and the tree hugs the left; else the
 * width counts too and the tree is centred
 */
export function fitView(v: Viewport, tall: number, wide: number, fit: FitOpts): ViewTarget {
  const across: number = v.W - v.inset.left - v.inset.right - 2 * MARGIN;
  const down: number = v.H - v.inset.top - v.inset.bottom - 2 * MARGIN;
  const k: number = Math.min(fit.most, down / tall, fit.squeeze ? Infinity : across / wide);
  return { k, tx: fit.squeeze ? 0 : MARGIN + (across - wide * k) / 2, ty: v.inset.top + MARGIN + (down - tall * k) / 2 };
}

/** a branch framed: scaled to fit its rows, centred when they fit, else from the top */
export function branchView(H: number, y: number, span: number): ViewTarget {
  const k: number = Math.max(0.75, Math.min(1, (H - 110) / span));
  return { k, tx: 0, ty: span * k < H - 100 ? H / 2 - y * k : 70 - (y - span / 2) * k };
}

/** a node brought into view: at least scale 0.9, its column a third of the way across, its row at the middle */
export function revealView(v: Viewport, k: number, x: number, y: number): ViewTarget {
  const kk: number = Math.max(k, 0.9);
  return { k: kk, tx: Math.min(0, (v.W - v.inset.left) * 0.35 - x * Math.max(kk, 0.8)), ty: v.H / 2 - y * kk };
}

/** the view zoomed by `f` about the screen point (cx, cy): the point stays put */
export function zoomView(
  view: ViewTarget, f: number, cx: number, cy: number, v: Viewport, tall: number, wide: number, zoom: ZoomOpts, least: number,
): ViewTarget {
  const kk: number = Math.max(Math.min(zoom.least, (v.H - 60) / tall), Math.min(zoom.most, view.k * f)), r: number = kk / view.k;
  const q0: number = scaleAcross(view.k, v, wide, least), q1: number = scaleAcross(kk, v, wide, least);
  const L: number = v.inset.left;
  return { k: kk, ty: cy - (cy - view.ty) * r, tx: cx - L - (cx - L - view.tx) * (q1 / q0) };
}

/** the fold's ease, and the glide's */
export const easeOut = (u: number): number => 1 - Math.pow(1 - u, 3);
export const easeInOut = (u: number): number => u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
