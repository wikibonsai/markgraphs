import assert from 'node:assert/strict';

import type { Cluster, Web, WebLayout, WebNode } from '../../../src/web/layout';
import { layoutWeb } from '../../../src/web/layout';

const words = (stem: string, n: number): string[] => Array.from({ length: n }, (_: unknown, i: number): string => `${stem}-${i}`);
const WEB: Web = {
  title: 'the-concept',
  relations: [
    { kind: 'hyponym', concepts: words('narrow', 9) },
    { kind: 'alias', concepts: words('name', 2) },
    { kind: 'synonym', concepts: words('same', 5) },
    { kind: 'antonym', concepts: words('opposite', 3) },
    { kind: 'hypernym', concepts: words('broad', 2) },
    { kind: 'cousin', concepts: words('cousin', 2) },
  ],
};

describe('layoutWeb', () => {

  const web: WebLayout = layoutWeb(WEB);
  const of = (kind: string): Cluster => web.clusters.find((c: Cluster): boolean => c.kind === kind) as Cluster;

  it('broader above, narrower below, unlike left, alike right', () => {
    const half: number = web.core.height / 2;
    for (const n of of('hypernym').nodes) { assert.ok(n.y < -half); }
    for (const n of of('hyponym').nodes) { assert.ok(n.y > half); }
    for (const kind of ['synonym', 'alias']) for (const n of of(kind).nodes) { assert.ok(n.x > web.core.width / 2); }
    for (const n of of('antonym').nodes) { assert.ok(n.x < -web.core.width / 2); }
  });

  it('an attribute it does not know goes left', () => assert.equal(of('cousin').side, 'left'));

  it('rows above and below clear the sides', () => {
    const ys: number[] = ['synonym', 'alias', 'antonym', 'cousin'].flatMap((k: string): number[] => of(k).nodes.map((n: WebNode): number => n.y));
    for (const n of of('hypernym').nodes) { assert.ok(n.y < Math.min(...ys)); }
    for (const n of of('hyponym').nodes) { assert.ok(n.y > Math.max(...ys)); }
  });

  it('a cluster keeps together: no two overlap', () => {
    const ys = (k: string): number[] => of(k).nodes.map((n: WebNode): number => n.y);
    assert.ok(Math.min(...ys('alias')) > Math.max(...ys('synonym')));
  });

  it('every node is in the box', () => {
    const { x, y, width, height } = web.box;
    for (const c of web.clusters) for (const n of c.nodes) {
      assert.ok(n.x > x && n.x < x + width);
      assert.ok(n.y > y && n.y < y + height);
    }
  });

  it('no relations is just the core', () => {
    const bare: WebLayout = layoutWeb({ title: 'x', relations: [] });
    assert.deepEqual(bare.clusters, []);
    assert.equal(Number.isFinite(bare.box.width + bare.box.height), true);
  });

});
