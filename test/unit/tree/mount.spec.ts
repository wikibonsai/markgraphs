import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import type { TreeNode } from '../../../src/tree/data';
import type { TreeMount } from '../../../src/tree/mount';
import { mountTree } from '../../../src/tree/mount';

// a 2d context that records nothing and measures 8px a character: jsdom draws no canvas
function fakeContext(): CanvasRenderingContext2D {
  const noop = (): void => {};
  return new Proxy({} as CanvasRenderingContext2D, {
    get: (_: CanvasRenderingContext2D, key: string): unknown =>
      key === 'measureText' ? (text: string): { width: number } => ({ width: text.length * 8 })
        : key === 'createLinearGradient' ? (): { addColorStop: () => void } => ({ addColorStop: noop }) : noop,
    set: (): boolean => true,
  });
}

interface Dom { window: Window & typeof globalThis; host: HTMLElement; frames: FrameRequestCallback[]; contexts: number }

function dom(width: number = 800, height: number = 600, context: boolean = true): Dom {
  const { window } = new JSDOM('<!doctype html><html><body><div id="host"></div></body></html>', { pretendToBeVisual: true });
  const frames: FrameRequestCallback[] = [];
  const d: Dom = {
    window: window as unknown as Window & typeof globalThis,
    host: window.document.getElementById('host') as HTMLElement,
    frames, contexts: 0,
  };
  const getContext = (): CanvasRenderingContext2D | null => { d.contexts++; return context ? fakeContext() : null; };
  window.HTMLCanvasElement.prototype.getContext = getContext as typeof window.HTMLCanvasElement.prototype.getContext;
  window.requestAnimationFrame = (cb: FrameRequestCallback): number => { frames.push(cb); return frames.length; };
  window.cancelAnimationFrame = (): void => {};
  d.host.getBoundingClientRect = (): DOMRect =>
    ({ x: 0, y: 0, left: 0, top: 0, width, height, right: width, bottom: height, toJSON: (): string => '' });
  // (every Path2D method is a no-op)
  class FakePath { constructor() { return new Proxy(this, { get: (): (() => void) => (): void => {} }); } }
  Object.assign(globalThis, {
    window, document: window.document, HTMLElement: window.HTMLElement, Path2D: FakePath,
    requestAnimationFrame: window.requestAnimationFrame, cancelAnimationFrame: window.cancelAnimationFrame, ResizeObserver: undefined,
  });
  return d;
}

// one frame drawn
function frame(d: Dom): void {
  const cb: FrameRequestCallback | undefined = d.frames.pop();
  assert.ok(cb, 'a frame was requested');
  cb(performance.now() + 5000);
}

const TREE: TreeNode = { name: 'r', children: [
  { name: 'a', children: [{ name: 'b', children: [] }, { name: 'c', children: [] }] },
  { name: 'd', children: [] },
] };

describe('mountTree', () => {

  afterEach(() => { Object.assign(globalThis, { window: undefined, document: undefined }); });

  it('fills the host with a canvas and a label layer, draws, and places a label per node', () => {
    const d: Dom = dom();
    const tree: TreeMount = mountTree(d.host, TREE, { paper: 'light' });
    assert.equal(d.host.querySelectorAll('canvas').length, 1);
    assert.equal(d.host.dataset.paper, 'light');
    assert.ok(d.window.document.head.querySelector('style[data-markgraphs]'));
    frame(d);
    const labels: HTMLElement[] = [...d.host.querySelectorAll<HTMLElement>('.lab')];
    assert.equal(labels.length, 5);
    assert.ok(labels.some((l: HTMLElement): boolean => l.classList.contains('root')));
    const toggle: HTMLButtonElement = d.host.querySelector('.lab.hub .tg') as HTMLButtonElement;
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');
    tree.dispose();
    assert.equal(d.host.querySelectorAll('canvas, .lab').length, 0);
    assert.equal(d.host.classList.contains('mg'), false);
  });

  it('a toggle click folds, with a badge; a name click picks; a second mount shares the one style sheet', () => {
    const d: Dom = dom();
    const picked: number[] = [], folds: [number, boolean][] = [];
    const tree: TreeMount = mountTree(d.host, TREE, {
      reducedMotion: true,
      onPick: (i: number): void => { picked.push(i); },
      onFold: (i: number, open: boolean): void => { folds.push([i, open]); },
    });
    frame(d);
    (d.host.querySelector('.lab.hub .tg[data-t="1"]') as HTMLButtonElement).click();
    assert.deepEqual(folds, [[1, false]]);
    assert.equal(tree.isOpen(1), false);
    frame(d);
    assert.equal(tree.visible(), 3);
    assert.equal((d.host.querySelector('.lab.hub .bd[data-t="1"]') as HTMLButtonElement).textContent, '+2');
    (d.host.querySelector('.lab .nm[data-i="4"]') as HTMLButtonElement).click();
    assert.deepEqual(picked, [4]);
    const other: HTMLElement = d.window.document.createElement('div');
    d.window.document.body.append(other);
    mountTree(other, TREE).dispose();
    assert.equal(d.window.document.head.querySelectorAll('style[data-markgraphs]').length, 1);
    tree.dispose();
  });

  it('keys on the host: f fits, Escape drops the pick, the arrows walk', () => {
    const d: Dom = dom();
    const picked: number[] = []; let unpicked: number = 0;
    const tree: TreeMount = mountTree(d.host, TREE, {
      reducedMotion: true,
      onPick: (i: number): void => { picked.push(i); },
      onUnpick: (): void => { unpicked++; },
    });
    frame(d);
    const key = (key: string): void => { d.host.dispatchEvent(new d.window.KeyboardEvent('keydown', { key, bubbles: true })); };
    key('ArrowDown');
    assert.deepEqual(picked, [0]);
    key('ArrowRight');
    assert.deepEqual(picked, [0, 1]);
    key('ArrowDown');
    assert.deepEqual(picked, [0, 1, 4]);
    key('Escape');
    assert.equal(unpicked, 1);
    tree.zoom(2);
    const k: number = tree.frame().k;
    key('f');
    frame(d);
    assert.notEqual(tree.frame().k, k);
    tree.dispose();
  });

  it('a drag that moved does not click; the view moves; refit holds until moved by hand', () => {
    const d: Dom = dom();
    let moved: number = 0; const picked: number[] = [];
    const tree: TreeMount = mountTree(d.host, TREE, {
      reducedMotion: true, refit: true,
      onMoved: (): void => { moved++; },
      onPick: (i: number): void => { picked.push(i); },
    });
    frame(d);
    const tx0: number = tree.frame().tx;
    // (jsdom has no PointerEvent: a MouseEvent with the pointer's fields)
    const ev = (type: string, x: number, y: number, target: Element = d.host): void => {
      const e: MouseEvent = new d.window.MouseEvent(type, { clientX: x, clientY: y, bubbles: true, button: 0 });
      Object.assign(e, { pointerId: 1, pointerType: 'mouse' });
      target.dispatchEvent(e);
    };
    const name: HTMLButtonElement = d.host.querySelector('.lab .nm[data-i="4"]') as HTMLButtonElement;
    d.host.setPointerCapture = (): void => {};
    ev('pointerdown', 100, 100, name); ev('pointermove', 140, 100); ev('pointerup', 140, 100);
    name.dispatchEvent(new d.window.MouseEvent('click', { bubbles: true }));
    assert.deepEqual(picked, []);
    assert.equal(moved, 1);
    frame(d);
    assert.equal(tree.frame().tx, tx0 + 40);
    tree.toggle(1);
    frame(d);
    assert.equal(tree.frame().tx, tx0 + 40);
    tree.fit();
    tree.toggle(1);
    frame(d);
    assert.ok(Math.abs(tree.frame().tx - tx0) < 0.01);
    tree.dispose();
  });

  it('a hidden root: no root label, limbs start at the edge, the host hooks run each frame', () => {
    const d: Dom = dom();
    let behind: number = 0, front: number = 0, edges: number = 0;
    const tree: TreeMount = mountTree(d.host, TREE, {
      root: 'hide', inset: { top: 0, right: 0, bottom: 0, left: 100 },
      edge: (): number => { edges++; return 80; },
      behind: (): void => { behind++; }, front: (): void => { front++; },
      fit: { most: 1, squeeze: true },
    });
    frame(d);
    assert.deepEqual([behind, front], [1, 1]);
    assert.ok(edges > 0);
    assert.equal(d.host.querySelector('.lab.root'), null);
    assert.equal(tree.visible(), 4);
    assert.equal(tree.frame().tx, 0);
    assert.ok(tree.blockTop(1) < tree.screenY(1));
    tree.dispose();
  });

  it('setData swaps the tree; foldUnder opens a wide tree on its root only; rows spread', () => {
    const d: Dom = dom(300, 2000);
    const leaves: TreeNode[] = [0, 1, 2, 3].map((j: number): TreeNode => ({ name: `a very long leaf name number ${j} that goes on`, children: [] }));
    const wide: TreeNode = { name: 'r', children: [0, 1, 2].map((i: number): TreeNode => ({ name: `limb ${i}`, children: leaves })) };
    const tree: TreeMount = mountTree(d.host, TREE, { reducedMotion: true, foldUnder: 0.5, rows: { least: 25, most: 40 } });
    assert.equal(tree.visible(), 5);
    tree.setData(wide);
    assert.equal(tree.model.size, 16);
    assert.equal(tree.visible(), 4);
    assert.equal(tree.isOpen(1), false);
    tree.dispose();
  });

  it('labels scale with the view when the tree is not squeezed, and never under 0.82 when it is', () => {
    const scale = (host: HTMLElement): number => Number((host.querySelector('.lab .nm[data-i="2"]') as HTMLElement).parentElement?.style.transform.match(/scale\(([\d.]+)\)/)?.[1]);
    const d: Dom = dom();
    const uniform: TreeMount = mountTree(d.host, TREE, { reducedMotion: true });
    uniform.zoom(0.3);
    frame(d);
    assert.ok(Math.abs(scale(d.host) - uniform.frame().k) < 0.002);
    assert.equal(d.host.querySelectorAll('.lab').length, 5);
    uniform.dispose();
    const squeezed: TreeMount = mountTree(d.host, TREE, { reducedMotion: true, fit: { most: 1, squeeze: true } });
    squeezed.zoom(0.3);
    frame(d);
    assert.equal(scale(d.host), 0.82);
    squeezed.dispose();
  });

  it('throws when the canvas has no 2d context', () => {
    const d: Dom = dom(800, 600, false);
    assert.throws(() => mountTree(d.host, TREE), /no 2d context/);
  });

  it('a long name is cut, the whole name on hover', () => {
    const d: Dom = dom();
    const tree: TreeMount = mountTree(d.host, { name: 'x'.repeat(50), children: [] });
    frame(d);
    const name: HTMLButtonElement = d.host.querySelector('.lab .nm') as HTMLButtonElement;
    assert.equal(name.textContent, 'x'.repeat(29) + '…');
    assert.equal(name.title, 'x'.repeat(50));
    tree.dispose();
  });

});
