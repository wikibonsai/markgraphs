/** a concept in a web of the concepts it relates to: each kind of relation a cluster on its side of the core */
import { spoken } from '../markdown/name';

export interface Point { x: number; y: number }

export interface WebRelation {
  // the relation's name: 'synonym'
  kind: string;
  concepts: string[];
}

export interface Web {
  title: string;
  relations: WebRelation[];
}

export const FONT: number = 13;
export const CORE_FONT: number = 16;
const ROW: number = 24;
const HEAD: number = 22;   // a cluster's heading
const GROUP_GAP: number = 18;
const SIDE: number = 84;   // from the core to a side cluster's names
const RISE: number = 34;   // a row's hub to its names
const PAD: number = 10;

// where a cluster sits round the core
export type Side = 'above' | 'below' | 'left' | 'right';

export type Anchor = 'start' | 'middle' | 'end';

export interface WebNode extends Point { label: string; name: string; anchor: Anchor }

export interface Heading extends Point { anchor: Anchor }

export interface Cluster {
  kind: string;
  side: Side;
  // where the core's bond ends and the concepts' begin
  hub: Point;
  heading: Heading;
  nodes: WebNode[];
}

export interface WebLayout {
  core: { label: string; width: number; height: number };
  clusters: Cluster[];
  // the drawing's box, the core at (0, 0)
  box: { x: number; y: number; width: number; height: number };
}

// broader above, narrower below, unlike to the left, alike to the right
const SIDES: Record<string, Side> = {
  hypernym: 'above', holonym: 'above',
  hyponym: 'below', meronym: 'below',
  synonym: 'right', alias: 'right',
  antonym: 'left',
};
const ORDER: string[] = ['hypernym', 'holonym', 'synonym', 'alias', 'antonym', 'hyponym', 'meronym'];
const rank = (kind: string): number => (ORDER.indexOf(kind) + 1) || ORDER.length + 1;

const sideOf = (kind: string): Side => SIDES[kind] ?? 'left';

interface Slot { name: string; label: string; width: number }

const slot = (name: string): Slot => {
  const label: string = spoken(name);
  return { name, label, width: textWidth(label, FONT) + 26 };
};

/** rows of names no wider than `most` (a name wider than that has a row of its own) */
function wrap(slots: Slot[], most: number): Slot[][] {
  const rows: Slot[][] = [];
  let width: number = Infinity;
  for (const s of slots) {
    if (width + s.width > most) { rows.push([]); width = 0; }
    rows[rows.length - 1].push(s);
    width += s.width;
  }
  return rows;
}

// about how wide a label is: there is no canvas to measure on when a layout runs
function textWidth(text: string, size: number): number {
  let w: number = 0;
  for (const c of text) { w += /[ijlt.,'()\-|fI ]/.test(c) ? 0.33 : /[mwMW]/.test(c) ? 0.86 : /[A-Z]/.test(c) ? 0.68 : 0.61; }
  return w * size;
}

/** the core at (0, 0), broader above, narrower below, unlike to the left, alike to the right */
export function layoutWeb(web: Web): WebLayout {
  const label: string = spoken(web.title);
  const core: WebLayout['core'] = { label, width: textWidth(label, CORE_FONT) + 36, height: 40 };
  const on = (side: Side): WebRelation[] => web.relations
    .filter((r: WebRelation): boolean => sideOf(r.kind) === side)
    .sort((a: WebRelation, b: WebRelation): number => rank(a.kind) - rank(b.kind));
  const clusters: Cluster[] = [];
  const bounds: { x0: number; x1: number; y0: number; y1: number } =
    { x0: -core.width / 2, x1: core.width / 2, y0: -core.height / 2, y1: core.height / 2 };
  const cover = (x0: number, x1: number, y0: number, y1: number): void => {
    bounds.x0 = Math.min(bounds.x0, x0); bounds.x1 = Math.max(bounds.x1, x1);
    bounds.y0 = Math.min(bounds.y0, y0); bounds.y1 = Math.max(bounds.y1, y1);
  };

  // the sides: a column, its clusters stacked and centred on the core
  for (const side of ['left', 'right'] as Side[]) {
    const dir: number = side === 'left' ? -1 : 1;
    const anchor: 'start' | 'end' = side === 'left' ? 'end' : 'start';
    const x: number = dir * (core.width / 2 + SIDE);
    const relations: WebRelation[] = on(side);
    const tall: number = relations.reduce((h: number, r: WebRelation): number => h + HEAD + r.concepts.length * ROW, 0)
      + Math.max(0, relations.length - 1) * GROUP_GAP;
    let y: number = -tall / 2;
    for (const r of relations) {
      const nodes: WebNode[] = r.concepts.map((name: string, i: number): WebNode =>
        ({ name, label: spoken(name), anchor, x, y: y + HEAD + (i + 0.5) * ROW }));
      const hub: Point = { x: dir * (core.width / 2 + SIDE / 2), y: y + HEAD + (r.concepts.length * ROW) / 2 };
      clusters.push({ kind: r.kind, side, hub, heading: { x: x + dir * 10, y: y + HEAD / 2, anchor }, nodes });
      const wide: number = Math.max(textWidth(r.kind, FONT), ...nodes.map((n: WebNode): number => textWidth(n.label, FONT))) + 14;
      cover(Math.min(x, x + dir * wide), Math.max(x, x + dir * wide), y, y + HEAD + r.concepts.length * ROW);
      y += HEAD + r.concepts.length * ROW + GROUP_GAP;
    }
  }

  // above and below: rows centred on the core, clear of the sides
  const most: number = Math.max(360, bounds.x1 - bounds.x0);
  for (const side of ['above', 'below'] as Side[]) {
    const dir: number = side === 'above' ? -1 : 1;
    let edge: number = dir === -1 ? bounds.y0 : bounds.y1;
    for (const r of on(side)) {
      const hub: Point = { x: 0, y: edge + dir * 28 };
      const rows: Slot[][] = wrap(r.concepts.map(slot), most);
      const nodes: WebNode[] = rows.flatMap((row: Slot[], i: number): WebNode[] => {
        let x: number = -row.reduce((w: number, s: Slot): number => w + s.width, 0) / 2;
        return row.map((s: Slot): WebNode => {
          const at: WebNode = { name: s.name, label: s.label, anchor: 'middle', x: x + s.width / 2, y: hub.y + dir * (RISE + i * 40) };
          x += s.width;
          return at;
        });
      });
      clusters.push({ kind: r.kind, side, hub, heading: { x: 12, y: hub.y - dir * 2, anchor: 'start' }, nodes });
      edge = hub.y + dir * (RISE + (rows.length - 1) * 40 + 24);
      const half: number = Math.max(...rows.map((row: Slot[]): number => row.reduce((w: number, s: Slot): number => w + s.width, 0))) / 2;
      cover(-half, half, Math.min(hub.y, edge), Math.max(hub.y, edge));
    }
  }

  return {
    core,
    clusters,
    box: { x: bounds.x0 - PAD, y: bounds.y0 - PAD, width: bounds.x1 - bounds.x0 + 2 * PAD, height: bounds.y1 - bounds.y0 + 2 * PAD },
  };
}
