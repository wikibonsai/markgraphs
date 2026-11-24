/**
 * the label layer's styles, one sheet per document. The host overrides the colours with --mg-ink, --mg-hover,
 * --mg-pick and --mg-paper on the host element
 */

export const LABEL_CSS: string = `
.mg[data-paper=dark] { --mg-ink: #eae6da; --mg-paper: #061412; --mg-hover: #14b8a6; --mg-pick: #f2b84b; }
.mg[data-paper=light] { --mg-ink: #2f2a24; --mg-paper: #f3fcf8; --mg-hover: #0f766e; --mg-pick: #8a4f05; }
.mg { touch-action: none; cursor: grab; }
.mg.drag { cursor: grabbing !important; }
.mg-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.mg-labels { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.mg-labels { font: 13px/17px -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif; }
.mg-labels * { box-sizing: border-box; }
.mg-labels .lab { position: absolute; left: 0; top: 0; width: 0; height: 0; transform-origin: 0 0; white-space: nowrap; }
.mg-labels .lab { font-size: 13px; font-weight: 500; line-height: 17px; color: var(--mg-ink); }
.mg-labels .lab.leaf { font-weight: 400; }
.mg-labels .lab.root { font-size: 17px; font-weight: 600; line-height: 21px; }
.mg-labels .lab button { all: unset; position: absolute; pointer-events: auto; cursor: pointer; }
.mg-labels .lab .nm { left: 10px; bottom: calc(var(--up) + 1px); -webkit-text-stroke: 4px var(--mg-paper); paint-order: stroke fill; }
.mg-labels .lab.leaf .nm { left: 22px; bottom: -8px; }
.mg-labels .lab.root .nm { bottom: calc(var(--up) + 2px); }
.mg-labels .lab .tg { left: -11px; top: -11px; width: 20px; height: 22px; border-radius: 50%; }
.mg-labels .lab .bd { left: calc(var(--w) + 5px); top: -7px; font-size: 10px; line-height: 14px; font-weight: 650; color: var(--c); }
.mg-labels .lab .bd:hover { text-decoration: underline; }
.mg-labels .lab .dots { position: absolute; left: 10px; top: calc(var(--up) + 3px); display: flex; gap: 2px; }
.mg-labels .lab.leaf .dots { left: 22px; top: 9px; }
.mg-labels .lab .dots i { width: 5px; height: 5px; border-radius: 50%; }
.mg-labels .lab.line .nm { border-bottom: 1.5px solid var(--c); }
.mg-labels .lab.tiny .dots { display: none; }
.mg-labels .lab .nm:hover { color: var(--mg-hover); text-decoration: underline; }
.mg-labels .lab.sel .nm { font-weight: 650; color: var(--mg-pick); }
.mg-labels button:focus-visible { outline: 2px solid var(--mg-hover); outline-offset: 1px; }
`;
