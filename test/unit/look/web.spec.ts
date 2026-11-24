import assert from 'node:assert/strict';

import { contrast } from '../../../src/look/color';
import { webLook } from '../../../src/look';

const hex = (css: string): number => parseInt(css.slice(1), 16);

describe('webLook', () => {

  for (const paper of ['dark', 'light'] as const) {
    it(`${paper}: every kind's colour reads on the paper`, () => {
      const { bg, core, bark, kinds, other } = webLook(paper);
      for (const c of [core, bark, other, ...Object.values(kinds)]) { assert.ok(contrast(hex(c), hex(bg)) >= 3, c); }
    });
  }

});
