/**
 * the tree's colours: a juniper palette on bonsai bark, worn on a dark or light paper. Each subject (a root's
 * child) is a band: the tree's tone drifted in hue and stepped in lightness, held readable on the paper. Each leaf
 * (a childless node) wears its top branch's leaf green from the leaf palette, lifted until it reads on the paper
 */
import type { TreeModel } from '../tree/model';
import type { HSL } from './color';
import { Color, cssHex, liftToContrast, luminance } from './color';

export type Paper = 'dark' | 'light';

interface Palette { young: number; old: number }
// the juniper palette
const JUNIPER: Palette = { young: 0xb2dc7c, old: 0x3a8050 };
// the leaf greens, one per top branch, on each paper
const LEAVES: Record<Paper, number[]> = {
  dark: [0x79ad57, 0x94a650, 0x8cbc5d, 0xa8d162, 0x97d267, 0x61b456, 0x7ec761, 0x7dc85e],
  light: [0x6e9c4f, 0x869549, 0x73984d, 0x7c9849, 0x70994d, 0x569c4c, 0x659b4d, 0x649c4b],
};

// `count` top branches spread over the palette's slots
function slot(index: number, count: number, of: number): number {
  return count >= of ? index % of : Math.floor((index * of) / count);
}
// the bark a band keeps a share of
const BONSAI_BARK: number = 0x4e3d30;

interface PaperTokens { bg: number; ink: number; soil: number; warm: number; light: [number, number]; root: number; bark: number }
// the papers: the background, the label ink, the soil, a focus's warm,
// a branch's lightness range (sRGB HSL), the root's green and its bark
const PAPERS: Record<Paper, PaperTokens> = {
  dark: { bg: 0x061412, ink: 0xeae6da, soil: 0x1c3030, warm: 0xffc861, light: [0.6, 0.72], root: 0x7fd65a, bark: 0x9c7450 },
  light: { bg: 0xf3fcf8, ink: 0x2f2a24, soil: 0xe4d6bc, warm: 0xd9861c, light: [0.34, 0.48], root: 0x4f9a2e, bark: 0x4e3d30 },
};
// the gold of a picked leaf; a band's hue drift's width; a branch's least
// saturation and the share of bark it keeps; WCAG's least contrast for wood on the paper (AA non-text)
const PICK: number = 0xf2b84b;
const SPREAD: number = 3.2;
const LEAST_SAT: number = 0.42;
const BARK_SHARE: number = 0.2;
const WOOD_CONTRAST: number = 3;

/** the tree's tone: between the palette's young and old leaves, per channel */
export function treeTone(pal: Palette = JUNIPER): number {
  const mid = (sh: number): number => ((((pal.young >> sh) & 255) + ((pal.old >> sh) & 255)) >> 1) << sh;
  return mid(16) | mid(8) | mid(0);
}

/** a band's tone over a palette: a gentle hue drift in list order and a lightness that alternates */
export function bandTone(i: number, n: number): { dh: number; dl: number } {
  if (!Number.isInteger(i) || !Number.isInteger(n) || i < 0 || i >= n) { throw new Error(`markgraphs look: no band ${i} of ${n}`); }
  if (n === 1) { return { dh: 0, dl: 0 }; }
  const dh: number = -0.06 + (0.12 * i) / (n - 1);
  const dl: number = n % 2 === 1 && i === n - 1 ? 0 : i % 2 === 0 ? 0.07 : -0.07;
  return { dh, dl };
}

/** a colour worn in a band: its hue drifted and its lightness stepped (in linear HSL) */
export function bandColor(hex: number, i: number, n: number, k: number = 1): number {
  const t: { dh: number; dl: number } = bandTone(i, n);
  const c: Color = new Color(hex);
  const hsl: HSL = c.getHSL();
  c.setHSL((hsl.h + t.dh * k + 1) % 1, Math.min(1, hsl.s + 0.08 * k), Math.min(0.9, Math.max(0.1, hsl.l + t.dl * k)));
  return c.getHex();
}

/** a band made bold for the paper: its drift widened, its lightness held in the paper's range, a little bark kept */
export function branchTone(tone: number, band: number, n: number, bark: number, paper: PaperTokens): number {
  const c: Color = new Color(bandColor(tone, band, n, SPREAD));
  const h: HSL = c.getHSL(true);
  const [l0, l1]: [number, number] = paper.light;
  const l: number = band % 2 === 0 ? l0 + (l1 - l0) * 0.35 : l1 - (l1 - l0) * 0.15;
  c.setHSL(h.h, Math.min(0.75, Math.max(LEAST_SAT, h.s)), l, true);
  return liftToContrast(c.lerp(new Color(bark), BARK_SHARE).getHex(), paper.bg, WOOD_CONTRAST, paper.ink);
}

export interface TreeLook {
  paper: Paper;
  dark: boolean;
  bg: string;
  soil: string;
  warm: string;
  pick: string;
  // a lone root's leaf green
  root: string;
  // the bark: a shown root's knot and stalk, and the root side of its branches
  bark: string;
  // each subject's branch colour, in the root's list order
  subjects: string[];
  // each node's leaf colour; '' for a node with children (it is a branch, not a leaf)
  leaves: string[];
}

/** every colour the drawing needs for one tree on one paper */
export function treeLook(model: TreeModel, paper: Paper): TreeLook {
  const tokens: PaperTokens = PAPERS[paper];
  const bg: number = tokens.bg;
  const dark: boolean = luminance(bg) < 0.2;
  const bark: number = liftToContrast(BONSAI_BARK, bg, WOOD_CONTRAST, tokens.ink);
  const tone: number = treeTone();
  // the bands: the subjects with children, in list order (a leaf straight off the root is in no band)
  const bandOf: Int16Array = new Int16Array(model.subjects.length).fill(-1);
  let n: number = 0;
  model.subjects.forEach((s: number, k: number): void => { if (model.kids[s].length > 0) { bandOf[k] = n++; } });
  // (one band, or none: every branch the one tone)
  const banded: boolean = n > 1;
  // the leaf greens, one per top branch
  const greens: string[] = model.subjects.map((_: number, k: number): string =>
    cssHex(liftToContrast(LEAVES[paper][slot(k, model.subjects.length, LEAVES[paper].length)], bg, WOOD_CONTRAST, tokens.ink)));
  const leaves: string[] = new Array<string>(model.size).fill('');
  for (let i: number = 1; i < model.size; i++) {
    if (model.kids[i].length === 0) { leaves[i] = greens[model.subjectOf[i]]; }
  }
  // a childless subject's stalk and button wear its leaf's colour
  const subjects: string[] = model.subjects.map((s: number, k: number): string =>
    bandOf[k] < 0 ? leaves[s] : cssHex(branchTone(tone, banded ? bandOf[k] : 0, banded ? n : 1, bark, tokens)));
  return {
    paper, dark, bg: cssHex(bg), soil: cssHex(tokens.soil), warm: cssHex(tokens.warm), pick: cssHex(PICK), root: cssHex(tokens.root),
    bark: cssHex(tokens.bark), subjects, leaves,
  };
}
