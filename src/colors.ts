// Event chip colors, worked out from one calendar or family color.
//
// Tinted chips sit on a dark surface in the event's own hue with a thick bar
// of the color itself, so white text stays legible on any color and any
// background photo. Solid chips fill with the color and pick white or
// near-black text, whichever reads better on it. Same color math as the
// Travel Times module, so a person's color looks the same across modules.

import { parseColor, resolveColor } from './host-style';

export interface ChipColors {
  /** The color itself: the bar, or a solid chip's fill. */
  base: string;
  /** Text on `base`. */
  onBase: string;
  /** A tinted chip's surface. */
  surface: string;
}

type RGB = [number, number, number];
type HSL = [number, number, number];

function toHsl([r, g, b]: RGB): HSL {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return [h * 60, s, l];
}

function toRgb([h, s, l]: HSL): RGB {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

const css = (rgb: RGB, alpha = 1) =>
  alpha >= 1 ? `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})` : `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;

/** WCAG relative luminance. */
function luminance([r, g, b]: RGB): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** White when it reaches WCAG's 3:1 for large bold text, else near-black.
 *  Strict "whichever contrasts more" puts dark text on mid-blues and pinks,
 *  which reads worse from across a room. */
export function textOn(bg: RGB): string {
  return contrast(luminance(bg), 1) >= 3 ? '#ffffff' : '#111827';
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

const cache = new Map<string, ChipColors>();

export function chipColors(color: string | null | undefined): ChipColors {
  const key = color ?? '';
  const hit = cache.get(key);
  if (hit) return hit;
  const resolved = color ? resolveColor(color) : null;
  const rgb = resolved ? parseColor(resolved) : null;
  let out = NEUTRAL;
  if (rgb) {
    const [h, s] = toHsl(rgb);
    out = {
      base: css(rgb),
      onBase: textOn(rgb),
      surface: css(toRgb([h, clamp(s * 0.65, 0.12, 0.55), 0.2]), 0.94),
    };
  }
  cache.set(key, out);
  return out;
}

const NEUTRAL: ChipColors = {
  base: '#94a3b8',
  onBase: '#111827',
  surface: 'rgba(36, 40, 48, 0.94)',
};
