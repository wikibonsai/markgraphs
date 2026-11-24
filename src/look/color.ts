/**
 * a colour held in linear sRGB, read and written as sRGB hex or HSL (the maths of a colour managed renderer, so
 * palettes written for one come out the same here)
 */

export interface HSL { h: number; s: number; l: number }

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const srgbToLinear = (c: number): number => (c < 0.04045) ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4);
const linearToSrgb = (c: number): number => (c < 0.0031308) ? c * 12.92 : 1.055 * Math.pow(c, 0.41666) - 0.055;

function hue2rgb(p: number, q: number, t: number): number {
  if (t < 0) { t += 1; }
  if (t > 1) { t -= 1; }
  if (t < 1 / 6) { return p + (q - p) * 6 * t; }
  if (t < 1 / 2) { return q; }
  if (t < 2 / 3) { return p + (q - p) * 6 * (2 / 3 - t); }
  return p;
}

// (r, g, b) in [0, 1], gamma encoded, as HSL
function rgbToHsl(r: number, g: number, b: number): HSL {
  const max: number = Math.max(r, g, b), min: number = Math.min(r, g, b);
  const l: number = (min + max) / 2;
  if (min === max) { return { h: 0, s: 0, l }; }
  const delta: number = max - min;
  const s: number = l <= 0.5 ? delta / (max + min) : delta / (2 - max - min);
  let h: number = 0;
  switch (max) {
    case r: h = (g - b) / delta + (g < b ? 6 : 0); break;
    case g: h = (b - r) / delta + 2; break;
    case b: h = (r - g) / delta + 4; break;
  }
  return { h: h / 6, s, l };
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 1) + 1) % 1;
  s = clamp(s, 0, 1);
  l = clamp(l, 0, 1);
  if (s === 0) { return [l, l, l]; }
  const p: number = l <= 0.5 ? l * (1 + s) : l + s - l * s;
  const q: number = 2 * l - p;
  return [hue2rgb(q, p, h + 1 / 3), hue2rgb(q, p, h), hue2rgb(q, p, h - 1 / 3)];
}

export class Color {
  r: number = 0;
  g: number = 0;
  b: number = 0;

  constructor(hex?: number) {
    if (hex !== undefined) { this.setHex(hex); }
  }

  // an sRGB hex
  setHex(hex: number): this {
    hex = Math.floor(hex);
    this.r = srgbToLinear(((hex >> 16) & 255) / 255);
    this.g = srgbToLinear(((hex >> 8) & 255) / 255);
    this.b = srgbToLinear((hex & 255) / 255);
    return this;
  }

  getHex(): number {
    const r: number = Math.round(clamp(linearToSrgb(this.r) * 255, 0, 255));
    const g: number = Math.round(clamp(linearToSrgb(this.g) * 255, 0, 255));
    const b: number = Math.round(clamp(linearToSrgb(this.b) * 255, 0, 255));
    return r * 65536 + g * 256 + b;
  }

  // HSL of the linear channels, or of the gamma encoded ones
  getHSL(srgb: boolean = false): HSL {
    return srgb
      ? rgbToHsl(linearToSrgb(this.r), linearToSrgb(this.g), linearToSrgb(this.b))
      : rgbToHsl(this.r, this.g, this.b);
  }

  setHSL(h: number, s: number, l: number, srgb: boolean = false): this {
    const [r, g, b] = hslToRgb(h, s, l);
    if (srgb) { this.r = srgbToLinear(r); this.g = srgbToLinear(g); this.b = srgbToLinear(b); }
    else { this.r = r; this.g = g; this.b = b; }
    return this;
  }

  lerp(to: Color, alpha: number): this {
    this.r += (to.r - this.r) * alpha;
    this.g += (to.g - this.g) * alpha;
    this.b += (to.b - this.b) * alpha;
    return this;
  }

  clone(): Color {
    const c: Color = new Color();
    c.r = this.r; c.g = this.g; c.b = this.b;
    return c;
  }
}

/** WCAG relative luminance of an sRGB hex */
export function luminance(hex: number): number {
  const ch = (v: number): number => { const x: number = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
  return 0.2126 * ch((hex >> 16) & 255) + 0.7152 * ch((hex >> 8) & 255) + 0.0722 * ch(hex & 255);
}

/** WCAG contrast ratio of two sRGB hexes */
export function contrast(a: number, b: number): number {
  const x: number = luminance(a), y: number = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** `hex` lifted toward `toward` in small steps until it reads at `ratio` against `bg` */
export function liftToContrast(hex: number, bg: number, ratio: number, toward: number): number {
  const c: Color = new Color(hex), t: Color = new Color(toward);
  for (let i: number = 0; i < 40 && contrast(c.getHex(), bg) < ratio; i++) { c.lerp(t, 0.08); }
  return c.getHex();
}

/** an sRGB hex as css */
export function cssHex(hex: number): string {
  return `#${(hex & 0xffffff).toString(16).padStart(6, '0')}`;
}
