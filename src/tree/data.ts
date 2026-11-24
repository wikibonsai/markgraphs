/**
 * a tree's two forms: nested nodes, and the engine's arrays (one entry per node in document order, so every
 * subtree is a contiguous index range after its root, the root at 0). The packed text ships the arrays as lines
 */

export interface TreeNode {
  name: string;
  children: TreeNode[];
}

export interface TreeArrays {
  names: string[];
  // each node's parent index; -1 for the root
  parents: number[];
}

export type TreeInput = TreeNode | TreeArrays;

export interface UnpackedTree extends TreeArrays {
  // the extra columns read, one array per column with a value per node ('' where a line had none)
  columns: string[][];
}

/** the arrays of a nested tree, in document order */
export function fromNested(root: TreeNode): TreeArrays {
  const names: string[] = [];
  const parents: number[] = [];
  const walk = (node: TreeNode, parent: number): void => {
    const i: number = names.length;
    names.push(node.name);
    parents.push(parent);
    for (const kid of node.children) { walk(kid, i); }
  };
  walk(root, -1);
  return { names, parents };
}

/** the arrays checked: a root at 0, every parent before its child */
export function checkArrays(data: TreeArrays): TreeArrays {
  if (data.names.length === 0 || data.parents[0] !== -1) { throw new Error('markgraphs: the tree has no root at index 0'); }
  for (let i: number = 1; i < data.names.length; i++) {
    const p: number = data.parents[i];
    if (!(p >= 0 && p < i)) { throw new Error(`markgraphs: node ${i} ('${data.names[i]}') has parent ${p}, which is not before it`); }
  }
  return data;
}

/** either form as arrays: nested nodes converted, arrays checked */
export function toArrays(tree: TreeInput): TreeArrays {
  return 'children' in tree ? fromNested(tree) : checkArrays(tree);
}

/** the tree as one line per node: the depth, the name, then each extra column's value */
export function packTree(data: TreeArrays, columns: string[][] = []): string {
  const depth: number[] = [];
  const lines: string[] = data.names.map((name: string, i: number): string => {
    const cells: string[] = [name, ...columns.map((col: string[]): string => col[i] ?? '')];
    if (cells.some((c: string): boolean => /[\t\n]/.test(c))) { throw new Error(`markgraphs: node ${i} ('${name}') holds a tab or a line break`); }
    depth[i] = data.parents[i] < 0 ? 0 : depth[data.parents[i]] + 1;
    return `${depth[i]}\t${cells.join('\t')}`.replace(/\t+$/, '');
  });
  return lines.join('\n');
}

/** the arrays back from packed text, with the extra columns read */
export function unpackTree(text: string): UnpackedTree {
  const data: UnpackedTree = { names: [], parents: [], columns: [] };
  const last: number[] = [];
  text.split('\n').forEach((line: string, i: number): void => {
    const [at, name, ...cells]: string[] = line.split('\t');
    const depth: number = Number(at);
    if (!Number.isInteger(depth) || name === undefined || depth > last.length) {
      throw new Error(`markgraphs: line ${i + 1} cannot be read: "${line}"`);
    }
    data.names.push(name);
    data.parents.push(depth === 0 ? -1 : last[depth - 1]);
    while (data.columns.length < cells.length) { data.columns.push(new Array<string>(i).fill('')); }
    data.columns.forEach((col: string[], j: number): void => { col.push(cells[j] ?? ''); });
    last.length = depth;
    last.push(i);
  });
  return data;
}
