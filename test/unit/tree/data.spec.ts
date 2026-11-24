import assert from 'node:assert/strict';

import type { TreeArrays, TreeNode, UnpackedTree } from '../../../src/tree/data';
import { fromNested, packTree, toArrays, unpackTree } from '../../../src/tree/data';

const NESTED: TreeNode = {
  name: 'r', children: [
    { name: 'a', children: [{ name: 'b', children: [] }, { name: 'c', children: [] }] },
    { name: 'd', children: [] },
  ],
};
const ARRAYS: TreeArrays = { names: ['r', 'a', 'b', 'c', 'd'], parents: [-1, 0, 1, 1, 0] };

describe('data', () => {

  describe('fromNested', () => {

    it('document order, the root at 0 with parent -1', () => {
      assert.deepEqual(fromNested(NESTED), ARRAYS);
    });

    it('a lone root', () => {
      assert.deepEqual(fromNested({ name: 'r', children: [] }), { names: ['r'], parents: [-1] });
    });

  });

  describe('toArrays', () => {

    it('nested nodes are converted', () => {
      assert.deepEqual(toArrays(NESTED), ARRAYS);
    });

    it('arrays pass through', () => {
      assert.equal(toArrays(ARRAYS), ARRAYS);
    });

    it('arrays without a root at 0 throw', () => {
      assert.throws(() => toArrays({ names: [], parents: [] }), /no root/);
      assert.throws(() => toArrays({ names: ['r', 'a'], parents: [0, 0] }), /no root/);
    });

    it('a parent after its child throws, naming the node', () => {
      assert.throws(() => toArrays({ names: ['r', 'a', 'b'], parents: [-1, 2, 0] }), /'a'.*parent 2/);
    });

  });

  describe('packTree / unpackTree', () => {

    it('round trips the arrays', () => {
      const text: string = packTree(ARRAYS);
      assert.equal(text, '0\tr\n1\ta\n2\tb\n2\tc\n1\td');
      const back: UnpackedTree = unpackTree(text);
      assert.deepEqual(back, { ...ARRAYS, columns: [] });
    });

    it('carries extra columns, trailing empties dropped', () => {
      const text: string = packTree(ARRAYS, [['R', '', 'B', '', ''], ['', '1', '', '', '']]);
      assert.equal(text, '0\tr\tR\n1\ta\t\t1\n2\tb\tB\n2\tc\n1\td');
      assert.deepEqual(unpackTree(text).columns, [['R', '', 'B', '', ''], ['', '1', '', '', '']]);
    });

    it('a tab or a line break in a name or a column throws', () => {
      assert.throws(() => packTree({ names: ['r\tx'], parents: [-1] }), /node 0.*tab or a line break/);
      assert.throws(() => packTree(ARRAYS, [['', '\n', '', '', '']]), /node 1/);
    });

    it('a line that cannot be read throws with its number', () => {
      assert.throws(() => unpackTree('0\tr\nx\ta'), /line 2/);
      assert.throws(() => unpackTree('0\tr\n2\ta'), /line 2/);
      assert.throws(() => unpackTree('0'), /line 1/);
    });

  });

});
