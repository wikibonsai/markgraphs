/**
 * the pointer, wheel and label clicks on the host: drag or scroll to move, pinch or ctrl scroll to zoom, a click
 * on a knot folds, on a name picks. Keys are the mount's
 */
import type { Scene } from './scene';

export interface InputActions {
  toggle(i: number): void;
  pick(i: number): void;
  zoom(f: number, cx: number, cy: number): void;
  hover(i: number): void;
  // the view was moved by hand
  moved(): void;
}

interface Drag { x: number; y: number; moved: boolean }
interface Point { x: number; y: number }

// the hit radius, px, of a knot or leaf under the pointer
const HIT: number = 13;
// a press that moved this far is a drag, not a click
const DRAG: number = 4;

/** the nearest knot or leaf to a host point among the laid out nodes, or -1 */
export function nearest(scene: Scene, x: number, y: number): number {
  if (x < scene.inset.left) { return -1; }
  let hit: number = -1, best: number = HIT;
  for (const i of scene.visible) {
    const d: number = Math.hypot(scene.hitX[i] - x, scene.hitY[i] - y);
    if (d < best) { best = d; hit = i; }
  }
  return hit;
}

// what input is bound to: the host, its label layer, and a client point mapped onto the host
export interface InputSurface {
  host: HTMLElement;
  labels: HTMLElement;
  at: (e: { clientX: number; clientY: number }) => Point;
}

/** binds the host's pointer, wheel and click handlers. Returns the unbind */
export function bindInput(surface: InputSurface, scene: Scene, act: InputActions): () => void {
  const { host, labels, at } = surface;
  let drag: Drag | null = null;
  // a click right after a drag is the drag's release, not a pick
  let dragged: boolean = false;
  const touches: Map<number, Point> = new Map();
  let pinch: number = 0;

  const onDown = (e: PointerEvent): void => {
    if (e.button !== 0 && e.pointerType === 'mouse') { return; }
    const p: Point = at(e);
    touches.set(e.pointerId, p);
    drag = { x: p.x, y: p.y, moved: false };
    dragged = false;
    scene.glide = null;
    pinch = 0;
  };
  const onMove = (e: PointerEvent): void => {
    const p: Point = at(e);
    if (!drag) {
      const n: HTMLElement | null = (e.target as HTMLElement).closest('[data-i],[data-t]');
      const h: number = n ? Number(n.dataset.i ?? n.dataset.t) : nearest(scene, p.x, p.y);
      host.style.cursor = h >= 0 && (n !== null || h > 0 || scene.rootShown) ? 'pointer' : '';
      if (h !== scene.hovered) { scene.hovered = h; scene.dirty = true; act.hover(h); }
      return;
    }
    if (touches.has(e.pointerId)) { touches.set(e.pointerId, p); }
    if (touches.size === 2) {
      const [a, b]: Point[] = [...touches.values()], d: number = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) { act.zoom(d / pinch, (a.x + b.x) / 2, (a.y + b.y) / 2); }
      pinch = d; drag.moved = true; dragged = true;
      return;
    }
    const dx: number = p.x - drag.x, dy: number = p.y - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG) { return; }
    if (!drag.moved) { host.setPointerCapture(e.pointerId); host.classList.add('drag'); }
    act.moved();
    drag.moved = true; dragged = true; drag.x = p.x; drag.y = p.y;
    scene.tx += dx;
    scene.ty += scene.whole() ? 0 : dy;
    scene.dirty = true;
  };
  const onLeave = (): void => { if (scene.hovered >= 0) { scene.hovered = -1; scene.dirty = true; act.hover(-1); } };
  const onUp = (e: PointerEvent): void => {
    touches.delete(e.pointerId);
    const onLabel: boolean = (e.target as HTMLElement).closest('button') !== null;
    if (drag && !drag.moved && touches.size === 0 && e.type === 'pointerup' && !onLabel) {
      // a click off the names takes the nearest branch end
      const p: Point = at(e), hit: number = nearest(scene, p.x, p.y);
      if (hit >= 0 && scene.model.kids[hit].length) { act.toggle(hit); } else { act.pick(hit); }
    }
    if (touches.size === 0) { drag = null; host.classList.remove('drag'); }
  };
  const onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    scene.glide = null;
    const p: Point = at(e);
    if (e.ctrlKey || e.metaKey) { act.zoom(Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.008)), p.x, p.y); return; }
    const m: number = e.deltaMode ? 24 : 1;
    act.moved();
    scene.tx -= (e.shiftKey ? e.deltaY : e.deltaX) * m;
    scene.ty -= (e.shiftKey || scene.whole() ? 0 : e.deltaY) * m;
    scene.dirty = true;
  };
  const onClick = (e: MouseEvent): void => {
    if (dragged) { dragged = false; return; }
    const b: HTMLElement = e.target as HTMLElement;
    if (b.dataset.t) { act.toggle(Number(b.dataset.t)); } else if (b.dataset.i) { act.pick(Number(b.dataset.i)); }
  };
  const onDouble = (e: MouseEvent): void => {
    const b: HTMLElement = e.target as HTMLElement;
    if (b.dataset.i) { act.toggle(Number(b.dataset.i)); }
  };

  host.addEventListener('pointerdown', onDown);
  host.addEventListener('pointermove', onMove);
  host.addEventListener('pointerleave', onLeave);
  host.addEventListener('pointerup', onUp);
  host.addEventListener('pointercancel', onUp);
  host.addEventListener('wheel', onWheel, { passive: false });
  labels.addEventListener('click', onClick);
  labels.addEventListener('dblclick', onDouble);
  return (): void => {
    host.removeEventListener('pointerdown', onDown);
    host.removeEventListener('pointermove', onMove);
    host.removeEventListener('pointerleave', onLeave);
    host.removeEventListener('pointerup', onUp);
    host.removeEventListener('pointercancel', onUp);
    host.removeEventListener('wheel', onWheel);
    labels.removeEventListener('click', onClick);
    labels.removeEventListener('dblclick', onDouble);
  };
}
