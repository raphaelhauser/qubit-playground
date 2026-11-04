/**
 * Projective spin measurements along an arbitrary Bloch axis n.
 *
 *   Observable  n·σ  with eigenvalues ±1 and eigenvectors |±n⟩.
 *   Projectors  P± = (I ± n·σ)/2.
 *   Born rule   p(±) = |⟨±n|ψ⟩|² = ⟨ψ|P±|ψ⟩ = (1 ± n·r)/2   (r = Bloch vector of ψ).
 *   Collapse    |ψ⟩ → P±|ψ⟩ / ‖P±|ψ⟩‖  (= |±n⟩ up to a global phase).
 */
import { abs2 } from './complex';
import {
  Mat2,
  Vec2,
  Vec3,
  I2,
  matAdd,
  matSub,
  matScaleR,
  matMul,
  nDotSigma,
  apply,
  inner,
  normalize,
  stateAlong,
  outer,
  trace,
  dagger,
} from './linalg';
import { blochVector, normalize3 } from './bloch';
import type { Rng } from './random';

export type Outcome = 1 | -1;

export function projector(n: Vec3, outcome: Outcome): Mat2 {
  const ns = nDotSigma(normalize3(n));
  return matScaleR(outcome === 1 ? matAdd(I2, ns) : matSub(I2, ns), 0.5);
}

/** Normalized eigenvectors |+n⟩, |−n⟩ of n·σ. */
export function eigenbasis(n: Vec3): { plus: Vec2; minus: Vec2 } {
  const u = normalize3(n);
  return { plus: stateAlong(u), minus: stateAlong([-u[0], -u[1], -u[2]]) };
}

export function probabilities(psi: Vec2, n: Vec3): { plus: number; minus: number } {
  const { plus, minus } = eigenbasis(n);
  const v = normalize(psi);
  return { plus: abs2(inner(plus, v)), minus: abs2(inner(minus, v)) };
}

/** Same probabilities from geometry alone: (1 ± n·r)/2. */
export function probabilitiesFromBloch(r: Vec3, n: Vec3): { plus: number; minus: number } {
  const u = normalize3(n);
  const d = r[0] * u[0] + r[1] * u[1] + r[2] * u[2];
  return { plus: (1 + d) / 2, minus: (1 - d) / 2 };
}

export function collapse(psi: Vec2, n: Vec3, outcome: Outcome): Vec2 {
  return normalize(apply(projector(n, outcome), psi));
}

export function measure(psi: Vec2, n: Vec3, rng: Rng): { outcome: Outcome; prob: number; post: Vec2 } {
  const p = probabilities(psi, n);
  const outcome: Outcome = rng() < p.plus ? 1 : -1;
  return { outcome, prob: outcome === 1 ? p.plus : p.minus, post: collapse(psi, n, outcome) };
}

/** Expectation value ⟨ψ|n·σ|ψ⟩ = n·r. */
export function expectation(psi: Vec2, n: Vec3): number {
  const r = blochVector(psi);
  const u = normalize3(n);
  return r[0] * u[0] + r[1] * u[1] + r[2] * u[2];
}

// ---------------------------------------------------------------------------
// density matrices (needed for the unpolarized oven)
// ---------------------------------------------------------------------------

export const densityFromState = (psi: Vec2): Mat2 => {
  const v = normalize(psi);
  return outer(v, v);
};
export const MAXIMALLY_MIXED: Mat2 = matScaleR(I2, 0.5);

/** Re tr(P ρ) */
export const probFromDensity = (rho: Mat2, P: Mat2): number => trace(matMul(P, rho)).re;

/** Unnormalized post-selection ρ → P ρ P† */
export const projectDensity = (rho: Mat2, P: Mat2): Mat2 => matMul(matMul(P, rho), dagger(P));

// ---------------------------------------------------------------------------
// Stern–Gerlach chains
// ---------------------------------------------------------------------------

export type BeamSelection = 'plus' | 'minus' | 'both';

export interface SGStage {
  axis: Vec3;
  /** which beam(s) leave this apparatus; for non-final stages only one beam continues */
  pass: BeamSelection;
}

export interface ChainPrediction {
  /** fraction of all emitted particles that enter each stage */
  enter: number[];
  /** per stage, fraction of all emitted particles leaving through + and − (before blocking) */
  outPlus: number[];
  outMinus: number[];
  /** conditional probability of + at each stage, given the particle entered it */
  condPlus: number[];
  /** final screen: fraction of all emitted particles detected in the + and − spots */
  finalPlus: number;
  finalMinus: number;
}

/**
 * Exact prediction for a linear chain of Stern–Gerlach apparatuses using density matrices.
 * The source may be a pure state or the maximally mixed state (unpolarized oven).
 * In every non-final stage, the non-selected beam is blocked.
 */
export function predictChain(source: Mat2, stages: SGStage[]): ChainPrediction {
  let rho = source; // unnormalized: tr ρ = fraction still in the beam
  const enter: number[] = [];
  const outPlus: number[] = [];
  const outMinus: number[] = [];
  const condPlus: number[] = [];
  let finalPlus = 0;
  let finalMinus = 0;
  stages.forEach((st, k) => {
    const total = trace(rho).re;
    enter.push(total);
    const Pp = projector(st.axis, 1);
    const Pm = projector(st.axis, -1);
    const pp = probFromDensity(rho, Pp);
    const pm = probFromDensity(rho, Pm);
    outPlus.push(pp);
    outMinus.push(pm);
    condPlus.push(total > 1e-15 ? pp / total : NaN);
    const last = k === stages.length - 1;
    if (last) {
      finalPlus = st.pass === 'minus' ? 0 : pp;
      finalMinus = st.pass === 'plus' ? 0 : pm;
    } else if (st.pass === 'plus') {
      rho = projectDensity(rho, Pp);
    } else if (st.pass === 'minus') {
      rho = projectDensity(rho, Pm);
    } else {
      // both beams recombined incoherently (which-path information kept): ρ → P₊ρP₊ + P₋ρP₋
      rho = matAdd(projectDensity(rho, Pp), projectDensity(rho, Pm));
    }
  });
  return { enter, outPlus, outMinus, condPlus, finalPlus, finalMinus };
}

