import assert from 'node:assert/strict';

import * as look from '../../src/look';
import * as markdown from '../../src/markdown';
import * as tree from '../../src/tree';
import * as web from '../../src/web';

// each subpath's surface as listed in the readme
const SURFACES: [string, object, string[]][] = [
  ['tree', tree, [
    'fromNested', 'toArrays', 'packTree', 'unpackTree', 'buildModel', 'pathOf', 'layoutTree', 'thickness', 'branchView', 'fitView',
    'scaleAcross', 'zoomView', 'revealView', 'holdTx', 'holdTy', 'isWhole', 'limbDrop', 'mountTree',
  ]],
  ['web', web, ['layoutWeb', 'mountWeb']],
  ['markdown', markdown, ['bare', 'spoken', 'entryOf', 'readEntry', 'readTree']],
  ['look', look, ['treeLook', 'webLook']],
];

describe('surface', () => {

  for (const [name, surface, names] of SURFACES) {
    it(`/${name} exports every documented name, and nothing else`, () => {
      assert.deepEqual(Object.keys(surface).sort(), [...names].sort());
      for (const [key, value] of Object.entries(surface)) { assert.equal(typeof value, 'function', key); }
    });
  }

});
