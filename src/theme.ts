/**
 * Visual grammar of the app — every figure follows four rules:
 *
 *   1. Ink is the state.        The quantum state is drawn in full-strength ink.
 *   2. Hue is phase.            Colour on a figure always means a complex phase, read on the
 *                               colour wheel (the Bloch-sphere equator, the complex unit circle).
 *   3. Dashes are constructions. Axes, projections and eigen-directions are thin or dashed.
 *   4. Filled vs hollow is the outcome.  + / 0 / ↑ is filled, − / 1 / ↓ is hollow.
 *
 * The palette exists in two themes ("graphite" dark and "paper" light). This module is the single
 * source of truth: it writes CSS variables for Tailwind and exposes live values to WebGL/SVG code
 * through the `COLORS` getters. Changing the theme remounts the app so every figure redraws.
 */

export type ThemeName = 'dark' | 'light';

type Shade = 950 | 900 | 850 | 800 | 750 | 700 | 600 | 500 | 400 | 300 | 200 | 100;

/** Neutral scale: 950 = page extreme, 100 = strongest ink. The light theme mirrors the dark one. */
const NEUTRALS: Record<ThemeName, Record<Shade, string>> = {
  dark: {
    950: '#0c0c0b',
    900: '#121211',
    850: '#171716',
    800: '#1c1c1a',
    750: '#222220',
    700: '#2b2a27',
    600: '#3a3934',
    500: '#514f49',
    400: '#7a766d',
    300: '#a6a196',
    200: '#d0cbc0',
    100: '#f2eee5',
  },
  light: {
    950: '#fcfaf6',
    900: '#f6f3ec',
    850: '#f0ece3',
    800: '#eae6dc',
    750: '#e3ded3',
    700: '#d7d1c4',
    600: '#c4bdae',
    500: '#a8a092',
    400: '#847d71',
    300: '#5f5950',
    200: '#3a3631',
    100: '#171513',
  },
};

// ---------------------------------------------------------------------------
// colour maths: OKLCH → sRGB, so equal steps in phase are equal steps in perceived hue
// ---------------------------------------------------------------------------

const toHex = (x: number) =>
  Math.round(Math.max(0, Math.min(1, x)) * 255)
    .toString(16)
    .padStart(2, '0');

export function oklch(L: number, C: number, hDeg: number): string {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const gam = lin.map((x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(Math.max(0, x), 1 / 2.4) - 0.055));
  return '#' + gam.map(toHex).join('');
}

export function mixHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((x, i) => toHex((x + (pb[i] - x) * t) / 255)).join('');
}

const PHASE_HUE_OFFSET = 28; // φ = 0 (positive real) is a warm vermilion
const PHASE_LC: Record<ThemeName, [number, number]> = { dark: [0.77, 0.13], light: [0.57, 0.15] };

let current: ThemeName = 'dark';

/** Colour of a complex phase φ (radians) on the app's phase wheel. */
export function phaseColor(phi: number, theme: ThemeName = current): string {
  const [L, C] = PHASE_LC[theme];
  const deg = ((((phi * 180) / Math.PI + PHASE_HUE_OFFSET) % 360) + 360) % 360;
  return oklch(L, C, deg);
}

/** n evenly spaced stops around the wheel, for gradients and rings. */
export const phaseStops = (n = 24): string[] => Array.from({ length: n }, (_, k) => phaseColor((2 * Math.PI * k) / n));

// ---------------------------------------------------------------------------
// semantic palette
// ---------------------------------------------------------------------------

interface Palette {
  bg: string;
  panel: string;
  grid: string;
  gridStrong: string;
  text: string;
  muted: string;
  faint: string;
  /** the quantum state: full-strength ink */
  state: string;
  stateDim: string;
  /** constructions: axes, generators, projections */
  axis: string;
  /** pencil: the secondary / comparison ink (ghosts, second paths). Actual phases use phaseColor(φ). */
  phase: string;
  /** outcome + / 0 / ↑ (drawn filled) */
  p0: string;
  /** outcome − / 1 / ↓ (drawn hollow or hatched) */
  p1: string;
  good: string;
  bad: string;
  x: string;
  y: string;
  z: string;
}

function palette(t: ThemeName): Palette {
  const n = NEUTRALS[t];
  const dark = t === 'dark';
  return {
    bg: n[900],
    panel: n[850],
    grid: n[700],
    gridStrong: n[600],
    text: n[100],
    muted: n[300],
    faint: n[400],
    state: n[100],
    stateDim: n[500],
    axis: dark ? '#b3ad9f' : '#55504a',
    phase: dark ? '#c3b393' : '#85724f',
    p0: n[200],
    p1: dark ? '#8f8a80' : '#8a8378',
    good: dark ? '#93c9a0' : '#2f7a45',
    bad: dark ? '#eb978b' : '#b2392d',
    x: n[300],
    y: n[300],
    z: n[300],
  };
}

const PALETTES: Record<ThemeName, Palette> = { dark: palette('dark'), light: palette('light') };

/** Live colour values for WebGL/SVG code. Read them during render. */
export const COLORS: Readonly<Palette> = Object.defineProperties(
  {},
  Object.fromEntries(
    (Object.keys(PALETTES.dark) as (keyof Palette)[]).map((k) => [k, { get: () => PALETTES[current][k], enumerable: true }]),
  ),
) as Palette;

export type ColorKey = keyof Palette;

// ---------------------------------------------------------------------------
// applying a theme
// ---------------------------------------------------------------------------

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ');

export function applyTheme(t: ThemeName) {
  current = t;
  const root = document.documentElement;
  root.dataset.theme = t;
  root.style.colorScheme = t;
  const n = NEUTRALS[t];
  (Object.keys(n) as unknown as Shade[]).forEach((s) => root.style.setProperty(`--ink-${s}`, rgb(n[s])));
  const p = PALETTES[t];
  (['state', 'axis', 'phase', 'p0', 'p1', 'good', 'bad'] as const).forEach((k) => root.style.setProperty(`--c-${k}`, rgb(p[k])));
  // CSS conic gradients run clockwise from 12 o'clock; phases run counter-clockwise from 3 o'clock
  const stops = phaseStops(36);
  const cw = [stops[0], ...stops.slice(1).reverse(), stops[0]];
  root.style.setProperty('--phase-wheel', `conic-gradient(from 90deg, ${cw.join(', ')})`);
  root.style.background = n[900];
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', n[900]);
}

export const getTheme = (): ThemeName => current;

export function initialTheme(): ThemeName {
  try {
    const s = window.localStorage.getItem('qp.theme');
    if (s === 'dark' || s === 'light') return s;
  } catch {
    /* storage unavailable */
  }
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function storeTheme(t: ThemeName) {
  try {
    window.localStorage.setItem('qp.theme', t);
  } catch {
    /* storage unavailable */
  }
}
