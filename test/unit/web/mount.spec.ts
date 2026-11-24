import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import type { Web, WebMount } from '../../../src/web';
import { webLook } from '../../../src/look';
import { mountWeb } from '../../../src/web';

const WEB: Web = { title: 'the-core', relations: [{ kind: 'synonym', concepts: ['a-b', '<b>'] }, { kind: 'cousin', concepts: ['c'] }] };

describe('mountWeb', () => {

  let host: HTMLElement;
  let picked: string[];
  let mount: WebMount;

  const all = (selector: string): Element[] => [...host.querySelectorAll(selector)];
  const texts = (selector: string): (string | null)[] => all(selector).map((e: Element): string | null => e.textContent);

  beforeEach(() => {
    const { window } = new JSDOM('<!doctype html><html><body><div id="host"></div></body></html>');
    Object.assign(globalThis, { window, document: window.document });
    host = window.document.getElementById('host') as HTMLElement;
    picked = [];
    mount = mountWeb(host, WEB, { paper: 'light', onPick: (name: string): void => { picked.push(name); } });
  });

  it('draws the core, each cluster\'s heading and its names as prose', () => {
    assert.deepEqual(texts('.node text').sort(), ['<b>', 'a b', 'c']);
    assert.deepEqual(texts('.heading').sort(), ['cousin', 'synonym']);
    assert.equal(all('svg')[0].getAttribute('aria-label'), 'the core and its related concepts');
  });

  it('a click or enter on a name picks it as written, another key does not', () => {
    const node: Element = all('.node[aria-label="a b"]')[0];
    const press = (key: string): boolean => node.dispatchEvent(new window.KeyboardEvent('keydown', { key }));
    node.dispatchEvent(new window.MouseEvent('click'));
    press('Enter');
    press('x');
    assert.deepEqual(picked, ['a-b', 'a-b']);
  });

  it('a kind it does not know wears the other colour', () => {
    const colors: (string | null)[] = all('.hub').map((e: Element): string | null => e.getAttribute('stroke'));
    assert.deepEqual(colors.sort(), [webLook('light').kinds.synonym, webLook('light').other].sort());
  });

  it('setPaper wears the paper, setData draws the next web, each in place of the last', () => {
    mount.setPaper('dark', '#123456');
    assert.equal(all('.core')[0].getAttribute('stroke'), webLook('dark').core);
    assert.equal((all('svg')[0] as SVGElement).style.getPropertyValue('--mg-web-paper'), '#123456');
    mount.setData({ title: 'alone', relations: [] });
    assert.equal(all('svg').length, 1);
    assert.equal(all('.node').length, 0);
  });

  it('shares one style among mounts', () => {
    mountWeb(host, WEB);
    assert.equal(document.head.querySelectorAll('style[data-markgraphs-web]').length, 1);
  });

  it('dispose leaves the host as it was', () => {
    mount.dispose();
    assert.equal(host.childNodes.length, 0);
    assert.equal(host.classList.contains('mg-web'), false);
  });

  it('without a document it throws', () => {
    Object.assign(globalThis, { document: undefined });
    assert.throws(() => mountWeb(host, WEB), /head/);
  });

});
