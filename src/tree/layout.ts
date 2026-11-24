/**
 * the tree's rows and columns: a row to each leaf and folded branch, a column to each depth, a branch centred on
 * its children. World units are px at scale 1
 */
import type { TreeModel } from './model';

// where the first row starts, and the root's column when shown
const TOP: number = 30;
const ROOT_X: number = 16;
// a hidden root's children: their column, the gap between their blocks, and the lead into each block
const SUBJECT_X: number = 62;
const SUBJECT_GAP: number = 34;
const SUBJECT_LEAD: number = 20;
// the farthest a child column stands from its parent's label
const MAX_STEP: number = 120;

/** a branch's thickness, by how much it holds: 43 nodes is as thick as a branch gets, and more in a tree of thousands */
export function thickness(model: TreeModel, i: number): number {
  const most: number = Math.max(43, model.count[0] / 4.6);
  return model.kids[i].length ? 1.8 + 7.2 * Math.sqrt(Math.min(1, model.count[i] / most)) : 1.5;
}

export interface LayoutOpts {
  row: number;
  rootShown: boolean;
  // the px a node's label takes
  labelWidth: (i: number) => number;
}

export interface LayoutOut {
  // each node's target column and row (world px), and the rows its subtree spans
  x: Float32Array;
  y: Float32Array;
  span: Float32Array;
}

export interface LayoutResult {
  // the nodes laid out, parents first
  visible: number[];
  // the tree's world height and width
  tall: number;
  wide: number;
  // leaves and folded branches on show
  rows: number;
}

/** lays out every node reachable through open branches */
export function layoutTree(model: TreeModel, open: Uint8Array, opts: LayoutOpts, out: LayoutOut): LayoutResult {
  const { x, y, span } = out;
  const { row: ROW, rootShown, labelWidth } = opts;
  const visible: number[] = [];
  let wide: number = 0;
  let rows: number = 0;
  let row: number = TOP;
  function order(i: number): void {
    visible.push(i);
    if (open[i]) { for (const c of model.kids[i]) { order(c); } }
  }
  function place(i: number): number {
    const pad: number = Math.max(0, thickness(model, i) - 5);
    const isOpen: boolean = i === 0 && !rootShown ? true : open[i] === 1;
    if (!isOpen || model.kids[i].length === 0) {
      row += ROW + pad;
      rows++;
      y[i] = row - ROW / 2;
      span[i] = ROW;
      return y[i];
    }
    const y0: number = row;
    for (const c of model.kids[i]) {
      if (!rootShown && i === 0) { row += SUBJECT_LEAD; }
      place(c);
      if (!rootShown && i === 0) { row += SUBJECT_GAP; }
    }
    row += 5;
    const kids: number[] = model.kids[i];
    y[i] = (y[kids[0]] + y[kids[kids.length - 1]]) / 2;
    span[i] = row - y0;
    return y[i];
  }
  if (rootShown) { order(0); } else { for (const s of model.subjects) { order(s); } }
  place(0);
  for (const i of visible) {
    const p: number = model.parents[i];
    if (i === 0) { x[i] = ROOT_X; }
    else if (!rootShown && model.depth[i] === 1) { x[i] = SUBJECT_X; }
    else { x[i] = x[p] + labelWidth(p) + Math.min(MAX_STEP, 46 + span[p] * 0.05); }
    wide = Math.max(wide, x[i] + labelWidth(i) + (model.kids[i].length ? 50 : 8));
  }
  return { visible, tall: row + (rootShown ? 25 : 55), wide, rows };
}
