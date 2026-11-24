/**
 * the leaf: a coin, a round on a short stalk. A path in the leaf's unit
 * frame (its base at (0, 0), its tip at (0, 1), y up), absolute M, L, C and Z only, for a canvas Path2D
 */

const f = (n: number): string => (Math.abs(n) < 5e-4 ? '0' : n.toFixed(3).replace(/\.?0+$/, ''));

// a closed circle of four cubics
function circle(cx: number, cy: number, r: number): string {
  const k: number = 0.5523 * r;
  return `M${f(cx)} ${f(cy - r)}`
    + ` C${f(cx + k)} ${f(cy - r)} ${f(cx + r)} ${f(cy - k)} ${f(cx + r)} ${f(cy)}`
    + ` C${f(cx + r)} ${f(cy + k)} ${f(cx + k)} ${f(cy + r)} ${f(cx)} ${f(cy + r)}`
    + ` C${f(cx - k)} ${f(cy + r)} ${f(cx - r)} ${f(cy + k)} ${f(cx - r)} ${f(cy)}`
    + ` C${f(cx - r)} ${f(cy - k)} ${f(cx - k)} ${f(cy - r)} ${f(cx)} ${f(cy - r)} Z`;
}

export const COIN_LEAF: string = `${circle(0, 0.58, 0.34)} M0.03 0 L0.03 0.26 L-0.03 0.26 L-0.03 0 Z`;
