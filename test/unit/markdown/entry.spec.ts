import assert from 'node:assert/strict';

import type { Entry, Relation } from '../../../src/markdown';
import { entryOf, readEntry } from '../../../src/markdown';

const relation = (entry: Entry, kind: string): string[] | undefined =>
  entry.relations.find((r: Relation): boolean => r.kind === kind)?.concepts;

const CAML: string = `: title    :: Machine Learning
: alias    :: ML
: hypernym :: [[ai]]
: hyponym  ::
             - [[supervised-learning]]
             - [[unsupervised learning]]
: antonym  :: ''
: tldr     :: "A branch of AI: data in, predictions out."
`;

describe('readEntry', () => {

  it('reads caml', () => {
    const entry: Entry = readEntry(CAML);
    assert.equal(entry.title, 'Machine Learning');
    assert.equal(entry.tldr, 'A branch of AI: data in, predictions out.');
    assert.deepEqual(entry.relations, [
      { kind: 'alias', concepts: ['ML'] },
      { kind: 'hypernym', concepts: ['ai'] },
      { kind: 'hyponym', concepts: ['supervised-learning', 'unsupervised learning'] },
    ]);
  });

  it('reads relations without brackets', () => assert.deepEqual(relation(readEntry(': synonym :: ai\n'), 'synonym'), ['ai']));

  it('takes a plural attribute as its singular', () => {
    assert.deepEqual(relation(readEntry(': synonyms :: [[ai]]\n'), 'synonym'), ['ai']);
    assert.deepEqual(relation(readEntry(': aliases :: ML\n'), 'alias'), ['ML']);
  });

  for (const text of ['', 'sorry, no']) {
    it(`an entry with nothing in it: '${text}'`, () => assert.deepEqual(readEntry(text), { title: '', tldr: '', relations: [] }));
  }

});

describe('entryOf', () => {

  it('joins a plural with its singular, each concept once', () => {
    assert.deepEqual(relation(entryOf({ synonym: '[[a]]', synonyms: ['a', '[[b]]'] }), 'synonym'), ['a', 'b']);
  });

  it('a value that is missing or empty is no relation', () => {
    assert.deepEqual(entryOf({ synonym: null, antonym: undefined, hyponym: [], alias: '' }).relations, []);
  });

  it('a value that is not text is read as text', () => assert.deepEqual(relation(entryOf({ alias: 42 }), 'alias'), ['42']));

});
