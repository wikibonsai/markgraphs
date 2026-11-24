/** the tree in memory: what the layout, drawing and colours read, derived once from the arrays */
import type { TreeArrays } from './data';
import { checkArrays } from './data';

export interface TreeModel {
  size: number;
  // the name as read ('plant anatomy')
  names: string[];
  parents: Int32Array;
  kids: number[][];
  depth: Uint8Array;
  // nodes in the subtree, itself included
  count: Int32Array;
  // the index into `subjects` of the subject a node hangs under; -1 for the root
  subjectOf: Int16Array;
  // the root's children, in order
  subjects: number[];
}

/** the tree in memory, derived once from the arrays */
export function buildModel(data: TreeArrays): TreeModel {
  checkArrays(data);
  const size: number = data.names.length;
  const parents: Int32Array = new Int32Array(size);
  const kids: number[][] = Array.from({ length: size }, (): number[] => []);
  const depth: Uint8Array = new Uint8Array(size);
  const count: Int32Array = new Int32Array(size).fill(1);
  for (let i: number = 1; i < size; i++) {
    const p: number = data.parents[i];
    parents[i] = p;
    kids[p].push(i);
    depth[i] = depth[p] + 1;
  }
  parents[0] = -1;
  for (let i: number = size - 1; i > 0; i--) { count[parents[i]] += count[i]; }
  const subjects: number[] = kids[0];
  const subjectOf: Int16Array = new Int16Array(size).fill(-1);
  subjects.forEach((s: number, band: number): void => { subjectOf[s] = band; });
  for (let i: number = 1; i < size; i++) { if (depth[i] > 1) { subjectOf[i] = subjectOf[parents[i]]; } }
  const names: string[] = data.names.map((name: string): string => name.replace(/[-_]+/g, ' '));
  return { size, names, parents, kids, depth, count, subjectOf, subjects };
}

/** the node's ancestors' names, root excluded, outermost first ('number › counting') */
export function pathOf(model: TreeModel, i: number): string {
  const names: string[] = [];
  for (let p: number = model.parents[i]; p > 0; p = model.parents[p]) { names.unshift(model.names[p]); }
  return names.join(' › ');
}
