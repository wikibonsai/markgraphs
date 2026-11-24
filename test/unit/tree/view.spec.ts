import assert from 'node:assert/strict';

import type { ViewTarget, Viewport, ZoomBounds } from '../../../src/tree/view';
import { fitView, holdTx, holdTy, isWhole, revealView, scaleAcross, zoomView } from '../../../src/tree/view';

const inset = { top: 0, right: 0, bottom: 0, left: 0 };
const room: Viewport = { W: 400, H: 300, inset };

describe('view', () => {

  describe('fitView', () => {

    for (const [tall, wide] of [[100, 2000], [5000, 100], [50, 50]]) {
      it(`fits ${wide} by ${tall} whole, centred`, () => {
        const v: ViewTarget = fitView(room, tall, wide, { most: 1.15, squeeze: false });
        assert.ok(wide * v.k <= 400 - 28 + 0.01);
        assert.ok(tall * v.k <= 300 - 28 + 0.01);
        assert.ok(Math.abs(v.tx * 2 + wide * v.k - 400) < 0.01);
        assert.ok(Math.abs(v.ty * 2 + tall * v.k - 300) < 0.01);
        assert.ok(v.k <= 1.15);
      });
    }

    it('squeezed: only the height sets the scale, the tree hugs the left', () => {
      const v: ViewTarget = fitView({ W: 1440, H: 900, inset: { top: 0, right: 0, bottom: 32, left: 176 } }, 840, 9000, { most: 1, squeeze: true });
      assert.equal(v.k, 1);
      assert.equal(v.tx, 0);
      assert.equal(v.ty, 14 + (900 - 60 - 840) / 2);
    });

    it('the inset is kept clear', () => {
      const v: ViewTarget = fitView({ W: 400, H: 300, inset: { top: 42, right: 0, bottom: 32, left: 0 } }, 1000, 10, { most: 1, squeeze: true });
      assert.equal(v.k, (300 - 42 - 32 - 28) / 1000);
      assert.equal(v.ty, 42 + 14);
    });

  });

  describe('scaleAcross', () => {

    it('holds the tree open at least and closed enough to fit', () => {
      assert.equal(scaleAcross(0.3, room, 1000, 0.8), 0.376);
      assert.equal(scaleAcross(0.3, room, 100, 0.8), 0.8);
      assert.equal(scaleAcross(1.2, room, 1000, 0.8), 1.2);
    });

    it('with no least it is the scale', () => {
      assert.equal(scaleAcross(0.3, room, 100, 0), 0.3);
    });

    it('the right inset may cover the tree: it does not close it further', () => {
      assert.equal(scaleAcross(0.3, { ...room, inset: { ...inset, right: 200 } }, 1000, 0.8), 0.376);
    });

  });

  describe('zoomView', () => {

    it('keeps its point', () => {
      const bounds: ZoomBounds = { tall: 100, wide: 100, zoom: { least: 0.15, most: 4 }, least: 0 };
      const z: ViewTarget = zoomView({ k: 1, tx: 10, ty: 20 }, { f: 2, cx: 110, cy: 70 }, room, bounds);
      assert.ok(Math.abs((110 - z.tx) / z.k - 100) < 1e-9);
      assert.ok(Math.abs((70 - z.ty) / z.k - 50) < 1e-9);
    });

    it('has ends, and can always zoom out to see the whole tree', () => {
      const zoom = { least: 0.15, most: 4 };
      const bounds = (tall: number): ZoomBounds => ({ tall, wide: 100, zoom, least: 0 });
      assert.equal(zoomView({ k: 3.9, tx: 0, ty: 0 }, { f: 9, cx: 0, cy: 0 }, room, bounds(100)).k, 4);
      assert.equal(zoomView({ k: 0.2, tx: 0, ty: 0 }, { f: 0.01, cx: 0, cy: 0 }, room, bounds(100)).k, 0.15);
      assert.equal(zoomView({ k: 0.2, tx: 0, ty: 0 }, { f: 0.01, cx: 0, cy: 0 }, room, bounds(10000)).k, (300 - 60) / 10000);
    });

  });

  describe('holdTx', () => {

    it('hugging: never right of the edge, never past the tree\'s reach', () => {
      assert.equal(holdTx(50, room, { wide: 100, kx: 1, hug: true }), 0);
      assert.equal(holdTx(-9999, room, { wide: 1000, kx: 1, hug: true }), 400 - 20 - 1000);
    });

    it('free: anywhere inside when the tree fits, else to its edges', () => {
      assert.equal(holdTx(50, room, { wide: 100, kx: 1, hug: false }), 50);
      assert.equal(holdTx(9999, room, { wide: 100, kx: 1, hug: false }), 400 - 14 - 100);
      assert.equal(holdTx(-9999, room, { wide: 100, kx: 1, hug: false }), 14);
      assert.equal(holdTx(-9999, room, { wide: 1000, kx: 1, hug: false }), 400 - 14 - 1000);
      assert.equal(holdTx(9999, room, { wide: 1000, kx: 1, hug: false }), 14);
    });

    it('the right inset is kept clear', () => {
      assert.equal(holdTx(-9999, { ...room, inset: { ...inset, right: 100 } }, { wide: 1000, kx: 1, hug: true }), 400 - 100 - 20 - 1000);
    });

  });

  describe('holdTy', () => {

    it('a short tree stays wholly inside', () => {
      assert.equal(holdTy(-50, 100, 1, 300), 14);
      assert.equal(holdTy(500, 100, 1, 300), 300 - 14 - 100);
    });

    it('a tall tree: the foot never climbs past the window, the top never drops below 70', () => {
      assert.equal(holdTy(500, 1000, 1, 300), 70);
      assert.equal(holdTy(-5000, 1000, 1, 300), 300 - 50 - 1000);
    });

  });

  it('isWhole', () => {
    assert.equal(isWhole(14, 100, 1, 300), true);
    assert.equal(isWhole(14, 1000, 1, 300), false);
  });

  it('revealView brings a node a third across and to the middle', () => {
    const v: ViewTarget = revealView(room, 0.5, 100, 200);
    assert.equal(v.k, 0.9);
    assert.equal(v.ty, 150 - 200 * 0.9);
    assert.equal(v.tx, Math.min(0, 400 * 0.35 - 100 * 0.9));
  });

});
