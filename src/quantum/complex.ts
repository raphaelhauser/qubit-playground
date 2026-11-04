/**
 * Minimal, immutable complex-number arithmetic.
 *
 * Every quantum calculation in the app is built on these functions, so they are
 * deliberately tiny, pure and covered by unit tests (see __tests__/complex.test.ts).
 */

export interface Complex {
  readonly re: number;
  readonly im: number;
}

export const c = (re: number, im = 0): Complex => ({ re, im });

export const ZERO: Complex = c(0, 0);
export const ONE: Complex = c(1, 0);
export const I: Complex = c(0, 1);
export const MINUS_I: Complex = c(0, -1);

export const add = (a: Complex, b: Complex): Complex => c(a.re + b.re, a.im + b.im);
export const sub = (a: Complex, b: Complex): Complex => c(a.re - b.re, a.im - b.im);
export const mul = (a: Complex, b: Complex): Complex =>
  c(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
export const neg = (a: Complex): Complex => c(-a.re, -a.im);
export const conj = (a: Complex): Complex => c(a.re, -a.im);
/** Multiply by a real scalar. */
export const scale = (a: Complex, s: number): Complex => c(a.re * s, a.im * s);

export function div(a: Complex, b: Complex): Complex {
  const d = b.re * b.re + b.im * b.im;
  if (d === 0) throw new Error('Complex division by zero');
  return c((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d);
}

/** |z|² — the Born-rule quantity. */
export const abs2 = (a: Complex): number => a.re * a.re + a.im * a.im;
export const abs = (a: Complex): number => Math.hypot(a.re, a.im);
/** Principal argument in (−π, π]. */
export const arg = (a: Complex): number => Math.atan2(a.im, a.re);

/** e^{iθ} for real θ. */
export const expi = (theta: number): Complex => c(Math.cos(theta), Math.sin(theta));
/** r·e^{iθ}. */
export const fromPolar = (r: number, theta: number): Complex =>
  c(r * Math.cos(theta), r * Math.sin(theta));

/** Complex exponential e^z. */
export function cexp(z: Complex): Complex {
  const m = Math.exp(z.re);
  return c(m * Math.cos(z.im), m * Math.sin(z.im));
}

/** Principal square root. */
export function csqrt(z: Complex): Complex {
  const r = abs(z);
  if (r === 0) return ZERO;
  const re = Math.sqrt((r + z.re) / 2);
  const im = Math.sqrt(Math.max(0, (r - z.re) / 2));
  return c(re, z.im < 0 ? -im : im);
}

export const cosh = (z: Complex): Complex => scale(add(cexp(z), cexp(neg(z))), 0.5);
export const sinh = (z: Complex): Complex => scale(sub(cexp(z), cexp(neg(z))), 0.5);

export function sum(...zs: Complex[]): Complex {
  let re = 0;
  let im = 0;
  for (const z of zs) {
    re += z.re;
    im += z.im;
  }
  return c(re, im);
}

export const approxEq = (a: Complex, b: Complex, tol = 1e-9): boolean =>
  Math.abs(a.re - b.re) <= tol && Math.abs(a.im - b.im) <= tol;

export const isReal = (a: Complex, tol = 1e-12): boolean => Math.abs(a.im) <= tol;

/** Clean tiny floating-point residue (e.g. 1e-17 → 0) for display. */
export function chop(a: Complex, tol = 1e-12): Complex {
  return c(Math.abs(a.re) < tol ? 0 : a.re, Math.abs(a.im) < tol ? 0 : a.im);
}
