/**
 * Bloch-sphere geometry.
 *
 * Convention (as in Nielsen & Chuang):
 *   |ψ⟩ = cos(θ/2)|0⟩ + e^{iφ} sin(θ/2)|1⟩   ↔   r = (sinθ cosφ, sinθ sinφ, cosθ)
 *   |0⟩ = +z (north pole), |1⟩ = −z, |+⟩ = +x, |−⟩ = −x, |+i⟩ = +y, |−i⟩ = −y.
 */
import { c, conj, mul, abs2, arg, expi, scale } from './complex';
import { Vec2, Vec3, normalize, inner, stateAlong, vscale } from './linalg';

export function stateFromAngles(theta: number, phi: number): Vec2 {
  return [c(Math.cos(theta / 2)), scale(expi(phi), Math.sin(theta / 2))];
}

/** Bloch vector (⟨X⟩, ⟨Y⟩, ⟨Z⟩) of a (not necessarily normalized) pure state. */
export function blochVector(psi: Vec2): Vec3 {
  const [a, b] = normalize(psi);
  const ab = mul(conj(a), b); // ā b
  return [2 * ab.re, 2 * ab.im, abs2(a) - abs2(b)];
}

/** Polar angles of a Bloch vector. φ ∈ [0, 2π); at the poles φ is reported as 0. */
export function anglesFromBloch(v: Vec3): { theta: number; phi: number } {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  const theta = Math.acos(Math.max(-1, Math.min(1, v[2] / len)));
  let phi = Math.atan2(v[1], v[0]);
  if (Math.hypot(v[0], v[1]) < 1e-12) phi = 0;
  if (phi < 0) phi += 2 * Math.PI;
  return { theta, phi };
}

export function anglesFromState(psi: Vec2): { theta: number; phi: number } {
  return anglesFromBloch(blochVector(psi));
}

export const stateFromBloch = (v: Vec3): Vec2 => stateAlong(v);

/**
 * Split off the global phase: ψ = e^{iγ} ψ_c with the |0⟩-amplitude of ψ_c real and ≥ 0.
 * (If the |0⟩-amplitude vanishes, the |1⟩-amplitude is made real and positive instead.)
 */
export function canonicalize(psi: Vec2): { state: Vec2; globalPhase: number } {
  const n = normalize(psi);
  const ref = abs2(n[0]) > 1e-14 ? n[0] : n[1];
  const g = arg(ref);
  return { state: vscale(n, expi(-g)), globalPhase: g };
}

/** |⟨ψ|φ⟩| = 1 ⇔ the two states differ only by a global phase. */
export function equalUpToGlobalPhase(a: Vec2, b: Vec2, tol = 1e-9): boolean {
  const ip = inner(normalize(a), normalize(b));
  return Math.abs(Math.sqrt(abs2(ip)) - 1) < tol;
}

/** Fidelity |⟨a|b⟩|² between pure states. */
export const fidelity = (a: Vec2, b: Vec2): number => abs2(inner(normalize(a), normalize(b)));

/** Relative phase arg(β) − arg(α) in [0, 2π) (0 if either amplitude vanishes). */
export function relativePhase(psi: Vec2): number {
  if (abs2(psi[0]) < 1e-14 || abs2(psi[1]) < 1e-14) return 0;
  let p = arg(psi[1]) - arg(psi[0]);
  p = ((p % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return p;
}

export interface Preset {
  id: string;
  /** KaTeX label */
  tex: string;
  theta: number;
  phi: number;
  bloch: Vec3;
  description: string;
}

export const PRESETS: Preset[] = [
  { id: '0', tex: '|0\\rangle', theta: 0, phi: 0, bloch: [0, 0, 1], description: 'Z eigenstate, eigenvalue +1 (spin up)' },
  { id: '1', tex: '|1\\rangle', theta: Math.PI, phi: 0, bloch: [0, 0, -1], description: 'Z eigenstate, eigenvalue −1 (spin down)' },
  { id: '+', tex: '|{+}\\rangle', theta: Math.PI / 2, phi: 0, bloch: [1, 0, 0], description: '(|0⟩+|1⟩)/√2 — X eigenstate, +1' },
  { id: '-', tex: '|{-}\\rangle', theta: Math.PI / 2, phi: Math.PI, bloch: [-1, 0, 0], description: '(|0⟩−|1⟩)/√2 — X eigenstate, −1' },
  { id: '+i', tex: '|{+i}\\rangle', theta: Math.PI / 2, phi: Math.PI / 2, bloch: [0, 1, 0], description: '(|0⟩+i|1⟩)/√2 — Y eigenstate, +1' },
  { id: '-i', tex: '|{-i}\\rangle', theta: Math.PI / 2, phi: (3 * Math.PI) / 2, bloch: [0, -1, 0], description: '(|0⟩−i|1⟩)/√2 — Y eigenstate, −1' },
];

// ---------------------------------------------------------------------------
// plain 3-vector helpers
// ---------------------------------------------------------------------------

export const dot3 = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross3 = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const len3 = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
export const scale3 = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const add3 = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub3 = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export function normalize3(a: Vec3): Vec3 {
  const l = len3(a);
  return l === 0 ? [0, 0, 1] : scale3(a, 1 / l);
}
/** Spherical → Cartesian unit vector. */
export const axisFromAngles = (theta: number, phi: number): Vec3 => [
  Math.sin(theta) * Math.cos(phi),
  Math.sin(theta) * Math.sin(phi),
  Math.cos(theta),
];

/** Rodrigues rotation of v about unit axis n by angle α (right-hand rule). */
export function rotate3(v: Vec3, n: Vec3, alpha: number): Vec3 {
  const k = normalize3(n);
  const cosA = Math.cos(alpha);
  const sinA = Math.sin(alpha);
  const kv = cross3(k, v);
  const kd = dot3(k, v) * (1 - cosA);
  return [
    v[0] * cosA + kv[0] * sinA + k[0] * kd,
    v[1] * cosA + kv[1] * sinA + k[1] * kd,
    v[2] * cosA + kv[2] * sinA + k[2] * kd,
  ];
}

/** Angle between two vectors in [0, π]. */
export function angleBetween(a: Vec3, b: Vec3): number {
  const d = dot3(a, b) / ((len3(a) || 1) * (len3(b) || 1));
  return Math.acos(Math.max(-1, Math.min(1, d)));
}

