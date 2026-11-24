/**
 * the labels: real text in the DOM, one element per node on screen, pooled and placed over the canvas each
 * frame. A fold toggle and a count badge stand beside a branch's name; the host's dots under a node's
 */
import type { Scene } from './scene';
import type { TreeLook } from '../look/look';

// the collision grid's cell, px, when the rows are too tight for every label
const CELL_W: number = 24;
const CELL_H: number = 6;
const MAX_LABELS: number = 400;
// one long name would push the whole tree over: cut, the whole name on hover
const LONGEST: number = 30;

export const LABEL_FONT: string = '500 13px -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif';
export const ROOT_FONT: string = '600 17px -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif';

export function shortName(name: string): string {
  return name.length > LONGEST ? `${name.slice(0, LONGEST - 1).trimEnd()}…` : name;
}

interface Label {
  el: HTMLDivElement;
  name: HTMLButtonElement;
  toggle: HTMLButtonElement | null;
  badge: HTMLButtonElement | null;
  // the last state dressed, so an unchanged label costs no style writes
  state: string;
}

// where a label stands on screen, its scale and its opacity
interface Spot { x: number; y: number; fs: number; opacity: number }

export class LabelLayer {
  private readonly host: HTMLElement;
  private readonly scene: Scene;
  private readonly dotsOf: (i: number) => string[];
  private readonly pool: Map<number, Label> = new Map();
  look: TreeLook;

  constructor(host: HTMLElement, scene: Scene, look: TreeLook, dotsOf: (i: number) => string[]) {
    this.host = host;
    this.scene = scene;
    this.look = look;
    this.dotsOf = dotsOf;
  }

  private label(i: number): Label {
    const hit: Label | undefined = this.pool.get(i);
    if (hit) { return hit; }
    const { model } = this.scene;
    const hub: boolean = model.kids[i].length > 0;
    const el: HTMLDivElement = document.createElement('div');
    el.className = (hub ? 'lab hub' : 'lab leaf') + (i === 0 ? ' root' : '');
    const name: HTMLButtonElement = document.createElement('button');
    const full: string = model.names[i], short: string = shortName(full);
    name.className = 'nm'; name.textContent = short; name.dataset.i = String(i);
    if (short !== full) { name.title = full; }
    el.append(name);
    const dots: string[] = this.dotsOf(i);
    if (dots.length > 0) {
      const d: HTMLDivElement = document.createElement('div');
      d.className = 'dots';
      for (const c of dots) { const dot: HTMLElement = document.createElement('i'); dot.style.background = c; d.append(dot); }
      el.append(d);
    }
    let toggle: HTMLButtonElement | null = null, badge: HTMLButtonElement | null = null;
    if (hub) {
      toggle = document.createElement('button');
      toggle.className = 'tg'; toggle.dataset.t = String(i);
      badge = document.createElement('button');
      badge.className = 'bd'; badge.dataset.t = String(i); badge.tabIndex = -1; badge.setAttribute('aria-hidden', 'true');
      el.prepend(toggle); el.append(badge);
    }
    this.host.append(el);
    const made: Label = { el, name, toggle, badge, state: '' };
    this.pool.set(i, made);
    return made;
  }

  private sweep(keep: Set<number>): void {
    for (const [i, l] of this.pool) { if (!keep.has(i)) { l.el.remove(); this.pool.delete(i); } }
  }

  private dress(i: number, spot: Spot): void {
    const { x, y, fs, opacity } = spot;
    const s: Scene = this.scene, { model } = s;
    const l: Label = this.label(i), hub: boolean = model.kids[i].length > 0, w: number = s.labelWidth(i) * Math.max(s.kx() / fs, 1);
    const open: boolean = s.open[i] === 1;
    const up: number = hub && open ? s.thick(i) * Math.max(0.45, Math.min(1.5, s.k)) / 2 / fs : 1;
    const state: string = `${x.toFixed(1)},${y.toFixed(1)},${fs.toFixed(3)},${opacity.toFixed(2)},${open},${i === s.selected},`
      + `${i === s.hovered},${this.look.paper},${s.k < 0.55},${s.row * s.k < 20},${w | 0}`;
    if (l.state === state) { return; }
    l.state = state;
    const st: CSSStyleDeclaration = l.el.style;
    st.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${fs.toFixed(3)})`;
    st.opacity = opacity.toFixed(2);
    st.zIndex = i === s.hovered || i === s.selected ? '3' : hub ? '2' : '1';
    st.setProperty('--c', i === 0 ? this.look.bark : this.look.subjects[Math.max(0, model.subjectOf[i])]);
    st.setProperty('--up', `${up.toFixed(1)}px`);
    st.setProperty('--w', `${w.toFixed(0)}px`);
    l.el.classList.toggle('line', hub && !open && s.row * s.k < 20);
    l.el.classList.toggle('sel', i === s.selected);
    l.el.classList.toggle('tiny', s.opts.across > 0 && s.k < 0.55);
    l.el.classList.toggle('open', open && hub);
    if (l.toggle && l.badge) {
      l.toggle.setAttribute('aria-label', `${open ? 'fold' : 'unfold'} ${model.names[i]}`);
      l.toggle.setAttribute('aria-expanded', String(open));
      l.toggle.title = open ? 'fold' : 'unfold';
      l.badge.textContent = open ? '' : `+${(model.count[i] - 1).toLocaleString()}`;
    }
  }

  // places a label on each shown node that has room; when the rows are tighter than a line of text, the
  // hovered and picked first, then the shallowest and largest branches, each taking its cells on a grid
  place(shown: number[]): void {
    const s: Scene = this.scene, { model } = s;
    const keep: Set<number> = new Set(), q: number = s.kx();
    // unsqueezed, the names scale with the view and every one is placed; squeezed, they hold at 0.82 and the
    // rows too tight for a line of text share a collision grid
    const uniform: boolean = s.opts.across === 0;
    const full: boolean = uniform || s.row * s.k >= 20;
    const fs: number = uniform ? Math.min(1.6, s.k) : full ? Math.max(0.82, Math.min(1.6, s.k)) : 0.82;
    const named = (i: number): boolean => s.rootShown || model.depth[i] > 1;
    const room = (i: number): boolean => full || s.span[i] * s.k > 4 || i === s.selected || i === s.hovered;
    const cand: number[] = shown.filter((i: number): boolean => named(i) && s.drawnGrow[i] > 0.4 && room(i));
    const force = (i: number): number => (i === s.hovered ? 1e6 : 0) + (i === s.selected ? 1e5 : 0);
    const first = (a: number, b: number): number => force(b) - force(a) || model.depth[a] - model.depth[b] || model.count[b] - model.count[a];
    if (!full) { cand.sort(first); }
    const gw: number = Math.ceil(s.W / CELL_W) + 2, gh: number = Math.ceil(s.H / CELL_H) + 6, grid: Uint8Array = new Uint8Array(full ? 0 : gw * gh);
    for (const i of cand) {
      if (keep.size > MAX_LABELS) { break; }
      const x: number = s.inset.left + s.tx + s.drawnX[i] * q, y: number = s.hitY[i];
      if (x < s.inset.left - 18 || x > s.W) { continue; }
      if (!full) {
        const a0: number = Math.max(0, (x / CELL_W) | 0);
        const a1: number = Math.min(gw - 1, ((x + s.labelWidth(i) * fs + (model.kids[i].length ? 34 : 0)) / CELL_W) | 0);
        const b0: number = Math.max(0, ((y - 17) / CELL_H) | 0);
        const b1: number = Math.min(gh - 1, Math.max(0, ((y + 4) / CELL_H) | 0));
        let free: boolean = true;
        for (let b: number = b0; b <= b1 && free; b++) { for (let a: number = a0; a <= a1; a++) { if (grid[b * gw + a]) { free = false; break; } } }
        if (!free && !force(i)) { continue; }
        for (let b: number = b0; b <= b1; b++) { grid.fill(1, b * gw + a0, b * gw + a1 + 1); }
      }
      keep.add(i);
      this.dress(i, { x, y, fs, opacity: Math.min(1, (s.drawnGrow[i] - 0.4) * 2) });
    }
    this.sweep(keep);
  }

  clear(): void {
    for (const l of this.pool.values()) { l.el.remove(); }
    this.pool.clear();
  }
}
