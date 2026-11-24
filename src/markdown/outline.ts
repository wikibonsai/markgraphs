/** an outline of list items as nested nodes */
import { bare } from './name';

export interface OutlineNode {
  // as written, without its brackets
  name: string;
  children: OutlineNode[];
}

/** an outline's tree; several top level items hang from one nameless root */
export function readTree(markdown: string): OutlineNode | null {
  const root: OutlineNode = { name: '', children: [] };
  const path: { indent: number; node: OutlineNode }[] = [{ indent: -1, node: root }];
  for (const line of markdown.split('\n')) {
    const item: RegExpMatchArray | null = line.match(/^(\s*)[-*+] +(.+)$/);
    if (item === null) { continue; }
    const indent: number = item[1].replace(/\t/g, '    ').length;
    while (path[path.length - 1].indent >= indent) { path.pop(); }
    const node: OutlineNode = { name: bare(item[2]), children: [] };
    path[path.length - 1].node.children.push(node);
    path.push({ indent, node });
  }
  if (root.children.length === 0) { return null; }
  return root.children.length === 1 ? root.children[0] : root;
}
