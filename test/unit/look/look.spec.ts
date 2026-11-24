import assert from 'node:assert/strict';

import type { TreeModel } from '../../../src/tree/model';
import type { TreeLook } from '../../../src/look/look';
import { buildModel } from '../../../src/tree/model';
import { bandTone, treeLook } from '../../../src/look/look';
import { Color, contrast, cssHex, liftToContrast } from '../../../src/look/color';

// r > (a > b, c), (d > e), f
const model: TreeModel = buildModel({ names: ['r', 'a', 'b', 'c', 'd', 'e', 'f'], parents: [-1, 0, 1, 1, 0, 4, 0] });

describe('look', () => {

  it('bandTone drifts hue in order and alternates lightness', () => {
    assert.deepEqual(bandTone(0, 1), { dh: 0, dl: 0 });
    assert.ok(bandTone(0, 3).dh < bandTone(2, 3).dh);
    assert.ok(bandTone(0, 2).dl > 0 && bandTone(1, 2).dl < 0);
    assert.throws(() => bandTone(3, 3), /no band 3 of 3/);
  });

  for (const paper of ['dark', 'light'] as const) {
    it(`${paper}: every branch and leaf reads on the paper`, () => {
      const look: TreeLook = treeLook(model, paper);
      const bg: number = parseInt(look.bg.slice(1), 16);
      assert.equal(look.subjects.length, 3);
      for (const c of look.subjects) { assert.ok(contrast(parseInt(c.slice(1), 16), bg) >= 3, c); }
      assert.ok(contrast(parseInt(look.bark.slice(1), 16), bg) >= 3, look.bark);
      for (const i of [2, 3, 5, 6]) { assert.ok(contrast(parseInt(look.leaves[i].slice(1), 16), bg) >= 3, look.leaves[i]); }
      assert.equal(look.leaves[1], '');
      assert.equal(look.dark, paper === 'dark');
    });
  }

  it('subjects with children get different bands; a childless subject wears its leaf colour', () => {
    const look: TreeLook = treeLook(model, 'dark');
    assert.notEqual(look.subjects[0], look.subjects[1]);
    assert.equal(look.subjects[2], look.leaves[6]);
  });

  it('leaves wear one colour per top branch, from the palette by band', () => {
    const look: TreeLook = treeLook(model, 'light');
    assert.equal(look.leaves[2], look.leaves[3]);
    assert.notEqual(look.leaves[2], look.leaves[5]);
    assert.notEqual(look.leaves[5], look.leaves[6]);
    // (three top branches spread over the palette's eight: the first slot is the palette's first)
    assert.equal(look.leaves[2], '#6e9c4f');
  });

});

describe('color', () => {

  it('round trips a hex through linear sRGB', () => {
    assert.equal(new Color(0x7cba5e).getHex(), 0x7cba5e);
    assert.equal(cssHex(0x00ff00), '#00ff00');
  });

  it('lifts a colour until it reads', () => {
    const lifted: number = liftToContrast(0x101010, 0x061412, 3, 0xeae6da);
    assert.ok(contrast(lifted, 0x061412) >= 3);
    assert.equal(liftToContrast(0xeeeeee, 0x061412, 3, 0xeae6da), 0xeeeeee);
  });

});

