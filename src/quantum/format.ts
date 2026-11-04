/**
 * Turning numbers, complex amplitudes and matrices into KaTeX strings.
 * Common exact values (1/√2, √3/2, …) and rational multiples of π are recognized,
 * so presets display as the textbook expressions rather than as decimals.
 */
import { Complex, chop } from './complex';
import type { Mat2, Vec2, PauliCoeffs } from './linalg';

const EXACT: Array<[number, string]> = [
  [0.5, '\\tfrac{1}{2}'],
  [Math.SQRT1_2, '\\tfrac{1}{\\sqrt{2}}'],
  [Math.sqrt(3) / 2, '\\tfrac{\\sqrt{3}}{2}'],
  [0.25, '\\tfrac{1}{4}'],
  [0.75, '\\tfrac{3}{4}'],
  [Math.SQRT2, '\\sqrt{2}'],
  [Math.sqrt(3), '\\sqrt{3}'],
  [1 / (2 * Math.SQRT2), '\\tfrac{1}{2\\sqrt{2}}'],
  [1 / Math.sqrt(3), '\\tfrac{1}{\\sqrt{3}}'],
  [1 / 3, '\\tfrac{1}{3}'],
  [2 / 3, '\\tfrac{2}{3}'],
];

export interface NumFormat {
  digits?: number;
  /** recognize exact values like 1/√2 (default true) */
  exact?: boolean;
}

/** Plain-text number with a typographic minus, e.g. "−0.707". */
export function fmt(x: number, digits = 3): string {
  if (!Number.isFinite(x)) return x > 0 ? '∞' : x < 0 ? '−∞' : '—';
  const lim = 0.5 * 10 ** -digits;
  if (Math.abs(x) < lim) x = 0;
  const s = x.toFixed(digits);
  return s.startsWith('-') ? '−' + s.slice(1) : s;
}

export function texReal(x: number, opts: NumFormat = {}): string {
  const { digits = 3, exact = true } = opts;
  if (!Number.isFinite(x)) return x > 0 ? '\\infty' : '-\\infty';
  const lim = 0.5 * 10 ** -digits;
  if (Math.abs(x) < lim) return '0';
  const sign = x < 0 ? '-' : '';
  const a = Math.abs(x);
  if (exact) {
    if (Math.abs(a - Math.round(a)) < 1e-9 && a < 1e6) return sign + String(Math.round(a));
    for (const [v, t] of EXACT) if (Math.abs(a - v) < 1e-9) return sign + t;
  }
  return sign + a.toFixed(digits);
}

/** Coefficient form: 1 → "", −1 → "-", i → "i", 0.5+0.5i → "(0.5+0.5i)". */
export function texCoef(z: Complex, opts: NumFormat = {}): string {
  const w = chop(z, 0.5 * 10 ** -(opts.digits ?? 3));
  if (w.im === 0) {
    if (Math.abs(w.re - 1) < 1e-12) return '';
    if (Math.abs(w.re + 1) < 1e-12) return '-';
    return texReal(w.re, opts);
  }
  if (w.re === 0) {
    if (Math.abs(w.im - 1) < 1e-12) return 'i';
    if (Math.abs(w.im + 1) < 1e-12) return '-i';
    return texReal(w.im, opts) + 'i';
  }
  return `(${texComplex(w, opts)})`;
}

export function texComplex(z: Complex, opts: NumFormat = {}): string {
  const w = chop(z, 0.5 * 10 ** -(opts.digits ?? 3));
  const reS = texReal(w.re, opts);
  const imAbs = Math.abs(w.im);
  const imIsZero = reS !== '' && texReal(imAbs, opts) === '0';
  if (imIsZero) return reS;
  const imMag = texReal(imAbs, opts);
  const imPart = imMag === '1' ? 'i' : `${imMag}i`;
  if (reS === '0') return (w.im < 0 ? '-' : '') + imPart;
  return `${reS} ${w.im < 0 ? '-' : '+'} ${imPart}`;
}

/** Angles as rational multiples of π when possible, else in units of π (or radians). */
export function texAngle(theta: number, opts: { mode?: 'pi' | 'rad'; digits?: number; inline?: boolean } = {}): string {
  const { mode = 'pi', digits = 2, inline = false } = opts;
  const q = theta / Math.PI;
  if (Math.abs(theta) < 1e-9) return '0';
  for (const den of [1, 2, 3, 4, 6, 8, 12]) {
    const num = q * den;
    if (Math.abs(num - Math.round(num)) < 1e-6) {
      const n = Math.round(num);
      const sign = n < 0 ? '-' : '';
      const an = Math.abs(n);
      const numer = an === 1 ? '\\pi' : `${an}\\pi`;
      if (den === 1) return sign + numer;
      return inline ? `${sign}${numer}/${den}` : `${sign}\\tfrac{${numer}}{${den}}`;
    }
  }
  if (mode === 'rad') return texReal(theta, { digits, exact: false });
  return `${texReal(q, { digits, exact: false })}\\pi`;
}

/** Plain-text angle, e.g. "π/2" or "0.39π". */
export function fmtAngle(theta: number, digits = 2): string {
  const q = theta / Math.PI;
  if (Math.abs(theta) < 1e-9) return '0';
  for (const den of [1, 2, 3, 4, 6, 8, 12]) {
    const num = q * den;
    if (Math.abs(num - Math.round(num)) < 1e-6) {
      const n = Math.round(num);
      const sign = n < 0 ? '−' : '';
      const an = Math.abs(n);
      const numer = an === 1 ? 'π' : `${an}π`;
      return den === 1 ? sign + numer : `${sign}${numer}/${den}`;
    }
  }
  return `${fmt(q, digits)}π`;
}

export function texMatrix(M: Mat2, opts: NumFormat & { factor?: boolean; env?: 'pmatrix' | 'bmatrix' } = {}): string {
  const { factor = true, env = 'pmatrix' } = opts;
  const entries = [M[0][0], M[0][1], M[1][0], M[1][1]].map((z) => chop(z, 1e-10));
  if (factor) {
    const nz = entries.filter((z) => Math.hypot(z.re, z.im) > 1e-9);
    if (nz.length > 0) {
      const m = Math.hypot(nz[0].re, nz[0].im);
      const unitish = nz.every((z) => {
        const a = z.re / m;
        const b = z.im / m;
        return (
          (Math.abs(Math.abs(a) - 1) < 1e-9 && Math.abs(b) < 1e-9) ||
          (Math.abs(Math.abs(b) - 1) < 1e-9 && Math.abs(a) < 1e-9)
        );
      });
      const mTex = texReal(m);
      if (unitish && Math.abs(m - 1) > 1e-9 && !mTex.includes('.')) {
        const inner = entries.map((z) => texComplex({ re: z.re / m, im: z.im / m }, opts));
        return `${mTex}\\begin{${env}} ${inner[0]} & ${inner[1]} \\\\ ${inner[2]} & ${inner[3]} \\end{${env}}`;
      }
    }
  }
  const e = entries.map((z) => texComplex(z, opts));
  return `\\begin{${env}} ${e[0]} & ${e[1]} \\\\ ${e[2]} & ${e[3]} \\end{${env}}`;
}

export function texColumn(v: Vec2, opts: NumFormat = {}): string {
  return `\\begin{pmatrix} ${texComplex(v[0], opts)} \\\\ ${texComplex(v[1], opts)} \\end{pmatrix}`;
}

/** α|0⟩ + β|1⟩ (zero terms dropped). */
export function texKet(v: Vec2, opts: NumFormat & { labels?: [string, string] } = {}): string {
  const labels = opts.labels ?? ['|0\\rangle', '|1\\rangle'];
  const terms: string[] = [];
  v.forEach((z, k) => {
    const coef = texCoef(z, opts);
    if (coef === '0') return;
    terms.push(coef + labels[k]);
  });
  if (terms.length === 0) return '0';
  return terms.reduce((acc, t, i) => (i === 0 ? t : t.startsWith('-') ? `${acc} - ${t.slice(1)}` : `${acc} + ${t}`), '');
}

/** a₀ I + a₁ X + a₂ Y + a₃ Z with zero terms dropped, e.g. "2iZ" or "0". */
export function texPauliSum(coeffs: PauliCoeffs, names: [string, string, string, string] = ['I', 'X', 'Y', 'Z'], opts: NumFormat = {}): string {
  const terms: string[] = [];
  coeffs.forEach((z, k) => {
    const coef = texCoef(z, opts);
    if (coef === '0') return;
    terms.push(coef + names[k]);
  });
  if (terms.length === 0) return '0';
  return terms.reduce((acc, t, i) => (i === 0 ? t : t.startsWith('-') ? `${acc} - ${t.slice(1)}` : `${acc} + ${t}`), '');
}

export const pct = (p: number, digits = 1): string => `${(100 * p).toFixed(digits)}%`;
