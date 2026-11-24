/** what a graph draws, read from markdown */
export type {
  Entry,
  Relation,
} from './entry';
export {
  entryOf,
  readEntry,
} from './entry';
export {
  bare,
  spoken,
} from './name';
export type { OutlineNode } from './outline';
export { readTree } from './outline';
