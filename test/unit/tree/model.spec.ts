import assert from 'node:assert/strict';

import type { TreeModel } from '../../../src/tree/model';
import { buildModel, pathOf } from '../../../src/tree/model';

const model: TreeModel = buildModel({ names: ['r', 'a-b', 'c', 'c', 'd'], parents: [-1, 0, 1, 1, 0] });

describe('model', () => {

  it('kids, depth, counts', () => {
    assert.deepEqual(model.kids, [[1, 4], [2, 3], [], [], []]);
    assert.deepEqual([...model.depth], [0, 1, 2, 2, 1]);
    assert.deepEqual([...model.count], [5, 3, 1, 1, 1]);
    assert.deepEqual([...model.parents], [-1, 0, 1, 1, 0]);
  });

  it('subjects are the root children; every node knows its subject', () => {
    assert.deepEqual(model.subjects, [1, 4]);
    assert.deepEqual([...model.subjectOf], [-1, 0, 0, 0, 1]);
  });

  it('names read with spaces', () => {
    assert.equal(model.names[1], 'a b');
  });

  it('pathOf: the ancestors, root excluded', () => {
    assert.equal(pathOf(model, 2), 'a b');
    assert.equal(pathOf(model, 1), '');
  });

  it('bad arrays throw', () => {
    assert.throws(() => buildModel({ names: [], parents: [] }), /no root/);
    assert.throws(() => buildModel({ names: ['r', 'a'], parents: [-1, 5] }), /parent 5/);
  });

});
