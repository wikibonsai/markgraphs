/**
 * the web's styles, one sheet per document. The host overrides the colours with --mg-ink, --mg-hover and --mg-paper,
 * and the halo round a name with --mg-halo
 */

export const WEB_CSS: string = `
.mg-web svg { display: block; width: 100%; max-height: 100%; margin: auto; }
.mg-web text { fill: var(--mg-ink, var(--mg-web-ink)); dominant-baseline: central; }
.mg-web text { stroke: var(--mg-halo, var(--mg-paper, var(--mg-web-paper))); stroke-width: 4px; paint-order: stroke; stroke-linejoin: round; }
.mg-web .hub, .mg-web .core { fill: var(--mg-paper, var(--mg-web-paper)); }
.mg-web .heading { font-size: 11px; font-weight: 600; letter-spacing: 0.04em; }
.mg-web .node { cursor: pointer; }
.mg-web .node:hover text, .mg-web .node:focus-visible text { fill: var(--mg-hover, var(--mg-web-hover)); text-decoration: underline; }
.mg-web .node:focus { outline: none; }
.mg-web .bond { fill: none; stroke-linecap: round; }
`;
