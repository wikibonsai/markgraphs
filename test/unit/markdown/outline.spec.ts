import assert from 'node:assert/strict';

import type { OutlineNode } from '../../../src/markdown';
import { bare, readTree, spoken } from '../../../src/markdown';

function outline(node: OutlineNode | null): unknown {
  return node === null ? null : [node.name, ...node.children.map(outline)];
}

describe('readTree', () => {

  for (const indent of ['  ', '    ', '\t']) {
    it(`reads ${JSON.stringify(indent)} indents`, () => {
      assert.deepEqual(
        outline(readTree(`- [[a]]\n${indent}- [[b]]\n${indent}${indent}- [[c]]\n${indent}- [[d]]`)),
        ['a', ['b', ['c']], ['d']],
      );
    });
  }

  it('several roots hang from a nameless one', () => assert.deepEqual(outline(readTree('- a\n- b')), ['', ['a'], ['b']]));

  it('no outline is no tree', () => assert.equal(readTree('sorry'), null));

});

describe('names', () => {

  it('bare', () => assert.equal(bare('"[[a-b]]"'), 'a-b'));

  it('spoken', () => assert.equal(spoken('[[a-b_(c)]]'), 'a b (c)'));

});
