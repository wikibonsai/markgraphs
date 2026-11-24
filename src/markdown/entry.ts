/** a concept's entry: its attributes, and the ones that relate it to other concepts */
import * as caml from '@wikibonsai/caml';

import { bare } from './name';

/** an attribute that names other concepts */
export interface Relation {
  // the attribute, singular: 'synonym'
  kind: string;
  concepts: string[];
}

export interface Entry {
  title: string;
  tldr: string;
  relations: Relation[];
}

// attributes that describe the concept rather than relate it
const PLAIN: string[] = ['title', 'tldr'];

function singular(key: string): string {
  const kind: string = key.trim().toLowerCase();
  if (kind === 'aliases') { return 'alias'; }
  return /^(hypernym|hyponym|synonym|antonym|meronym|holonym)s$/.test(kind) ? kind.slice(0, -1) : kind;
}

function strings(value: unknown): string[] {
  const list: unknown[] = Array.isArray(value) ? value.flat(Infinity) : [value];
  return list.filter((v: unknown): boolean => v !== null && v !== undefined)
    .map((v: unknown): string => bare(String(v)))
    .filter((v: string): boolean => v !== '');
}

/** an entry from attributes already read: a plural key joins its singular */
export function entryOf(attrs: Record<string, unknown>): Entry {
  const byKind: Map<string, string[]> = new Map();
  for (const [key, value] of Object.entries(attrs)) {
    const kind: string = singular(key);
    byKind.set(kind, [...new Set([...byKind.get(kind) ?? [], ...strings(value)])]);
  }
  return {
    title: byKind.get('title')?.[0] ?? '',
    tldr: byKind.get('tldr')?.join(', ') ?? '',
    relations: [...byKind]
      .filter(([kind, concepts]: [string, string[]]): boolean => !PLAIN.includes(kind) && concepts.length > 0)
      .map(([kind, concepts]: [string, string[]]): Relation => ({ kind, concepts })),
  };
}

/** an entry from the markdown's caml attributes */
export function readEntry(markdown: string): Entry {
  return entryOf(caml.load(markdown).data);
}
