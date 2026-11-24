import assert from 'node:assert/strict';

import type { TreeModel } from '../../../src/tree/model';
import { buildModel } from '../../../src/tree/model';
import { Scene } from '../../../src/tree/scene';

// r > (a > b, c), (d > e)
const model: TreeModel = buildModel({ names: ['r', 'a', 'b', 'c', 'd', 'e'], parents: [-1, 0, 1, 1, 0, 4] });
const measure = (text: string): number => text.length * 8;
const INSET = { top: 0, right: 0, bottom: 0, left: 0 };

function scene(rootShown: boolean, reducedMotion: boolean = false, rows: { least: number; most: number } = { least: 31, most: 31 }): Scene {
  const s: Scene = new Scene(model, measure, {
    reducedMotion, rootShown, rows, across: rootShown ? 0 : 0.8, fit: { most: 1.15, squeeze: !rootShown },
  });
  s.resize(800, 600, 1, INSET);
  return s;
}

describe('Scene', () => {

  it('opens with everything open when the root is shown, the subjects open when hidden', () => {
    assert.deepEqual([...scene(true).open], [1, 1, 0, 0, 1, 0]);
    assert.deepEqual([...scene(false).open], [0, 1, 0, 0, 1, 0]);
  });

  it('a label\'s width is measured once; a hidden root\'s subjects take only a knot', () => {
    const shown: Scene = scene(true);
    assert.equal(shown.labelWidth(2), 8 + 26);
    assert.equal(shown.labelWidth(1), 8 + 18);
    assert.ok(shown.labelWidth(0) > 8);
    assert.equal(scene(false).labelWidth(1), 26);
  });

  it('relayout with a jump lands at once', () => {
    const s: Scene = scene(true);
    s.relayout(-1, true);
    assert.deepEqual(s.drawn, [0, 1, 2, 3, 4, 5]);
    assert.equal(s.tall, s.tallTo);
    assert.equal(s.tweenStart, -1);
    assert.equal(s.drawnY[2], s.y[2]);
  });

  it('a fold tweens: leavers fold into their nearest drawn ancestor, then go', () => {
    const s: Scene = scene(true);
    s.relayout(-1, true);
    s.open[1] = 0;
    s.relayout(1);
    assert.deepEqual(s.visible, [0, 1, 4, 5]);
    assert.deepEqual(s.left, [2, 3]);
    assert.equal(s.tweenStart, 0);
    assert.equal(s.y[2], s.y[1]);
    assert.ok(s.tick(1000));
    assert.ok(s.tick(1000 + 1000));
    assert.deepEqual(s.drawn, [0, 1, 4, 5]);
    assert.equal(s.drawnGrow[2], 0);
    assert.equal(s.tweenStart, -1);
  });

  it('the clicked branch stays where it was on screen through the fold', () => {
    const s: Scene = scene(true);
    s.relayout(-1, true);
    s.ty = 100; s.k = 1;
    const before: number = s.screenY(1);
    s.open[1] = 0;
    s.relayout(1);
    s.tick(1000);
    s.tick(5000);
    assert.ok(Math.abs(s.screenY(1) - before) < 0.01);
  });

  it('reduced motion lands every fold at once', () => {
    const s: Scene = scene(true, true);
    s.relayout(-1, true);
    s.open[1] = 0;
    s.relayout(1);
    assert.equal(s.tweenStart, -1);
    assert.deepEqual(s.drawn, [0, 1, 4, 5]);
  });

  it('rows spread to fill the height, between least and most', () => {
    const tight: Scene = scene(true, false, { least: 25, most: 40 });
    tight.resize(800, 90, 1, INSET);
    tight.relayout(-1, true);
    const tall: Scene = scene(true, false, { least: 25, most: 40 });
    tall.resize(800, 2000, 1, INSET);
    tall.relayout(-1, true);
    assert.equal(tight.row, 25);
    assert.equal(tall.row, 40);
    assert.ok(tall.tallTo > tight.tallTo);
  });

  it('the glide eases the view and settles', () => {
    const s: Scene = scene(true);
    s.relayout(-1, true);
    s.glideTo(2, 10, 20);
    assert.ok(s.tick(performance.now() + 10));
    assert.ok(s.k > 0.9 && s.k < 2);
    s.settle();
    assert.deepEqual([s.k, s.tx, s.ty], [2, 10, 20]);
    assert.equal(s.glide, null);
  });

  it('clampView holds the view inside the tree\'s reach', () => {
    const s: Scene = scene(false);
    s.relayout(-1, true);
    s.tx = 500; s.ty = -5000;
    s.clampView();
    assert.equal(s.tx, 0);
    assert.ok(s.ty >= 14);
  });

  it('pathSet: the node and its ancestors, root excluded', () => {
    assert.deepEqual([...scene(true).pathSet(2)].sort(), [1, 2]);
    assert.equal(scene(true).pathSet(-1).size, 0);
  });

  describe('setGrowth', () => {

    it('grows each node out of its parent, and stands grown when dropped', () => {
      const s: Scene = scene(false);
      s.relayout(-1, true);
      const at: number[] = [s.x[2], s.y[2]];
      s.setGrowth((i: number): number => i === 2 ? 0.5 : 1);
      assert.equal(s.tick(0), true);
      assert.equal(s.drawnGrow[2], 0.5);
      assert.ok(s.drawnX[2] < at[0] && s.drawnX[2] > s.drawnX[1]);
      s.setGrowth(null);
      assert.deepEqual([s.drawnX[2], s.drawnY[2], s.drawnGrow[2]], [...at, 1]);
    });

    it('holds a growth out of range to 0 and 1, and draws every frame while it lasts', () => {
      const s: Scene = scene(true);
      s.relayout(-1, true);
      s.setGrowth((i: number): number => i === 1 ? -3 : 7);
      s.tick(0);
      assert.equal(s.drawnGrow[1], 0);
      assert.equal(s.drawnGrow[0], 1);
      assert.equal(s.tick(1), true);
    });

  });

});
