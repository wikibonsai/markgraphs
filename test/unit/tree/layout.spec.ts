import assert from 'node:assert/strict';

import type { TreeModel } from '../../../src/tree/model';
import type { LayoutOut, LayoutResult } from '../../../src/tree/layout';
import { buildModel } from '../../../src/tree/model';
import { layoutTree, thickness } from '../../../src/tree/layout';

// r > (a > b, c), d
const model: TreeModel = buildModel({ names: ['r', 'a', 'b', 'c', 'd'], parents: [-1, 0, 1, 1, 0] });
const width = (i: number): number => 40 + i;

function lay(open: number[], row: number = 31, rootShown: boolean = true): LayoutResult & LayoutOut {
  const out: LayoutOut = { x: new Float32Array(5), y: new Float32Array(5), span: new Float32Array(5) };
  const o: Uint8Array = new Uint8Array(5);
  for (const i of open) { o[i] = 1; }
  return { ...layoutTree(model, o, { row, rootShown, labelWidth: width }, out), ...out };
}

describe('layoutTree', () => {

  it('a branch is centred on its children, and they start past its name', () => {
    const l: LayoutResult & LayoutOut = lay([0, 1]);
    assert.deepEqual(l.visible, [0, 1, 2, 3, 4]);
    assert.equal(l.y[1], (l.y[2] + l.y[3]) / 2);
    assert.equal(l.y[0], (l.y[1] + l.y[4]) / 2);
    assert.ok(l.x[2] > l.x[1] + width(1));
    assert.ok(l.x[1] > l.x[0] + width(0));
    assert.equal(l.rows, 3);
  });

  it('a fold hides what it holds', () => {
    const l: LayoutResult & LayoutOut = lay([0]);
    assert.deepEqual(l.visible, [0, 1, 4]);
    assert.equal(l.rows, 2);
    assert.ok(l.tall < lay([0, 1]).tall);
  });

  it('rows as tall as asked', () => {
    assert.equal(lay([0, 1], 40).tall - lay([0, 1], 25).tall, 45);
  });

  it('a hidden root takes no column and spaces its children apart', () => {
    const shown: LayoutResult & LayoutOut = lay([0, 1], 31, true);
    const hidden: LayoutResult & LayoutOut = lay([0, 1], 31, false);
    assert.deepEqual(hidden.visible, [1, 2, 3, 4]);
    assert.ok(hidden.x[1] < shown.x[1]);
    assert.ok(hidden.y[4] - hidden.y[3] > shown.y[4] - shown.y[3]);
  });

  it('a lone root', () => {
    const lone: TreeModel = buildModel({ names: ['r'], parents: [-1] });
    const out: LayoutOut = { x: new Float32Array(1), y: new Float32Array(1), span: new Float32Array(1) };
    const l: LayoutResult = layoutTree(lone, new Uint8Array(1), { row: 31, rootShown: true, labelWidth: width }, out);
    assert.deepEqual(l.visible, [0]);
    assert.equal(l.rows, 1);
    assert.ok(l.wide > 40);
  });

  it('thickness by what a branch holds, a leaf thin', () => {
    assert.equal(thickness(model, 2), 1.5);
    assert.ok(thickness(model, 0) > thickness(model, 1));
    assert.ok(thickness(model, 0) <= 9);
  });

});
