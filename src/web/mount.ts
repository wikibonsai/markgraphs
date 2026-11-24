/** mounts the web on a host as an svg: real text, each name a link */
import type { Paper, WebLook } from '../look';
import type { Cluster, Web, WebLayout, WebNode } from './layout';
import { webLook } from '../look';
import { CORE_FONT, FONT, layoutWeb } from './layout';
import { WEB_CSS } from './style';

export interface WebOpts {
  paper?: Paper;
  // the host's paper colour, for the core, the hubs and the names' halo (the look's by default)
  bg?: string;
  // a name was clicked, as written
  onPick?: (name: string) => void;
}

export interface WebMount {
  setData(web: Web): void;
  setPaper(paper: Paper, bg?: string): void;
  dispose(): void;
}

type Attrs = Record<string, string | number>;

function el(tag: string, attrs: Attrs, text?: string): SVGElement {
  const e: SVGElement = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) { e.setAttribute(k, String(v)); }
  if (text !== undefined) { e.textContent = text; }
  return e;
}

// the styles, once per document
function ensureStyle(): void {
  if (document.head.querySelector('style[data-markgraphs-web]') !== null) { return; }
  const style: HTMLStyleElement = document.createElement('style');
  style.dataset.markgraphsWeb = '';
  style.textContent = WEB_CSS;
  document.head.append(style);
}

const upright = (c: Cluster): boolean => c.side === 'above' || c.side === 'below';

// a bond from the core: level into a side's hub, upright into a row's
function toHub(c: Cluster, coreWidth: number): string {
  if (upright(c)) { return `M0 0 L${c.hub.x} ${c.hub.y}`; }
  const x: number = Math.sign(c.hub.x) * coreWidth / 2;
  return `M${x} 0 C${(x + c.hub.x) / 2} 0 ${(x + c.hub.x) / 2} ${c.hub.y} ${c.hub.x} ${c.hub.y}`;
}

function toNode(c: Cluster, n: WebNode): string {
  const { x, y } = c.hub;
  if (upright(c)) { return `M${x} ${y} C${x} ${(y + n.y) / 2} ${n.x} ${(y + n.y) / 2} ${n.x} ${n.y}`; }
  return `M${x} ${y} C${(x + n.x) / 2} ${y} ${(x + n.x) / 2} ${n.y} ${n.x} ${n.y}`;
}

const labelX = (n: WebNode): number => n.anchor === 'middle' ? n.x : n.x + (n.anchor === 'end' ? -10 : 10);
const labelY = (c: Cluster, n: WebNode): number => c.side === 'above' ? n.y - 13 : c.side === 'below' ? n.y + 13 : n.y;

function drawCluster(c: Cluster, color: string, pick: (name: string) => void): SVGElement {
  const g: SVGElement = el('g', { class: 'cluster' });
  for (const n of c.nodes) { g.append(el('path', { class: 'bond', d: toNode(c, n), stroke: color, 'stroke-width': 1.6, opacity: 0.75 })); }
  g.append(
    el('circle', { class: 'hub', cx: c.hub.x, cy: c.hub.y, r: 4.5, stroke: color, 'stroke-width': 2 }),
    el('text', { class: 'heading', x: c.heading.x, y: c.heading.y, 'text-anchor': c.heading.anchor, style: `fill: ${color}` }, c.kind),
  );
  for (const n of c.nodes) {
    const node: SVGElement = el('g', { class: 'node', role: 'link', tabindex: 0, 'aria-label': n.label });
    node.append(
      el('circle', { cx: n.x, cy: n.y, r: 4, fill: color }),
      el('text', { x: labelX(n), y: labelY(c, n), 'text-anchor': n.anchor, 'font-size': FONT }, n.label),
    );
    node.addEventListener('click', (): void => pick(n.name));
    node.addEventListener('keydown', (e: KeyboardEvent): void => { if (e.key === 'Enter') { pick(n.name); } });
    g.append(node);
  }
  return g;
}

function drawWeb(at: WebLayout, look: WebLook, pick: (name: string) => void): SVGElement {
  const { core, clusters, box } = at;
  const svg: SVGElement = el('svg', {
    viewBox: `${box.x} ${box.y} ${box.width} ${box.height}`,
    style: `max-width: ${box.width * 1.1}px; aspect-ratio: ${box.width} / ${box.height}`,
    role: 'group', 'aria-label': `${core.label} and its related concepts`,
  });
  for (const c of clusters) { svg.append(el('path', { class: 'bond', d: toHub(c, core.width), stroke: look.bark, 'stroke-width': 3 })); }
  for (const c of clusters) { svg.append(drawCluster(c, look.kinds[c.kind] ?? look.other, pick)); }
  svg.append(
    el('rect', {
      class: 'core', x: -core.width / 2, y: -core.height / 2, width: core.width, height: core.height, rx: core.height / 2,
      stroke: look.core, 'stroke-width': 2.5,
    }),
    el('text', { 'text-anchor': 'middle', 'font-size': CORE_FONT, 'font-weight': 600 }, core.label),
  );
  return svg;
}

/** mounts a web on the host: an svg as wide as the host, no larger than 1.1 */
export function mountWeb(host: HTMLElement, web: Web, opts: WebOpts = {}): WebMount {
  let data: Web = web;
  let paper: Paper = opts.paper ?? 'dark';
  let bg: string | undefined = opts.bg;
  let svg: SVGElement | null = null;
  const pick = (name: string): void => opts.onPick?.(name);

  function draw(): void {
    const look: WebLook = webLook(paper);
    const next: SVGElement = drawWeb(layoutWeb(data), look, pick);
    const vars: Record<string, string> = { ink: look.ink, hover: look.hover, paper: bg ?? look.bg };
    for (const [name, value] of Object.entries(vars)) { next.style.setProperty(`--mg-web-${name}`, value); }
    if (svg === null) { host.append(next); } else { svg.replaceWith(next); }
    svg = next;
  }

  ensureStyle();
  host.classList.add('mg-web');
  draw();

  return {
    setData(next: Web): void { data = next; draw(); },
    setPaper(next: Paper, nextBg?: string): void { paper = next; bg = nextBg; draw(); },
    dispose(): void { svg?.remove(); svg = null; host.classList.remove('mg-web'); },
  };
}
