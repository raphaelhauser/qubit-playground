/** Invariants behind every number Module C (Hamiltonian playground) displays. */
import { describe, it, expect } from 'vitest';
import {
  HamiltonianParams,
  hamiltonianMatrix,
  hamiltonianAxis,
  evolutionOperator,
  evolutionAngle,
  evolveState,
  transitionProbability,
  transitionAmplitude,
  oscillation,
  energies,
  fromOmegas,
  toOmegas,
  sampleTrajectory,
  pauliDecompose,
  eigHermitian,
  isHermitian,
  isUnitary,
  matApproxEq,
  matScale,
  expi,
  expm,
  c,
  Rn,
  KET0,
  inner,
  abs2,
  norm,
  blochVector,
  stateFromAngles,
  mulberry32,
  randomState,
  apply,
} from '../index';

const rng = mulberry32(2024);
const rnd = (a: number, b: number) => a + (b - a) * rng();
const randomParams = (): HamiltonianParams => ({ omegaBar: rnd(-2, 2), deltaOmega: rnd(-2, 2), epsilon: rnd(-2, 2) });

describe('Module C: Hamiltonian playground', () => {
  it('H is Hermitian and its Pauli decomposition is (ω̄, ε, 0, Δω)', () => {
    for (let k = 0; k < 30; k++) {
      const p = randomParams();
      const H = hamiltonianMatrix(p);
      expect(isHermitian(H)).toBe(true);
      const [a0, ax, ay, az] = pauliDecompose(H);
      expect(a0.re).toBeCloseTo(p.omegaBar, 12);
      expect(ax.re).toBeCloseTo(p.epsilon, 12);
      expect(ay.re).toBeCloseTo(0, 12);
      expect(az.re).toBeCloseTo(p.deltaOmega, 12);
      for (const z of [a0, ax, ay, az]) expect(z.im).toBeCloseTo(0, 12);
    }
  });

  it('ω₁/ω₂ parametrization round-trips (level form: H = diag(ω₁, ω₂) + εX)', () => {
    const p = fromOmegas(1.3, -0.4, 0.25);
    const H = hamiltonianMatrix(p);
    expect(H[0][0].re).toBeCloseTo(1.3, 12);
    expect(H[1][1].re).toBeCloseTo(-0.4, 12);
    expect(H[0][1].re).toBeCloseTo(0.25, 12);
    const w = toOmegas(p);
    expect(w.omega1).toBeCloseTo(1.3, 12);
    expect(w.omega2).toBeCloseTo(-0.4, 12);
  });

  it('energy-level diagram: E± = ω̄ ± r are the eigenvalues, eigenvectors are ±v', () => {
    for (let k = 0; k < 30; k++) {
      const p = randomParams();
      const [Em, Ep] = energies(p);
      const e = eigHermitian(hamiltonianMatrix(p));
      expect(e.values[0]).toBeCloseTo(Em, 10);
      expect(e.values[1]).toBeCloseTo(Ep, 10);
      const { v } = hamiltonianAxis(p);
      const b = blochVector(e.vectors[1]);
      for (let j = 0; j < 3; j++) expect(b[j]).toBeCloseTo(v![j], 9);
      // level repulsion: the gap never shrinks when ε is switched on
      expect(Ep - Em).toBeGreaterThanOrEqual(2 * Math.abs(p.deltaOmega) - 1e-12);
    }
  });

  it('U_t = e^{−iω̄t} R_v(2rt) and agrees with expm(−iHt)', () => {
    for (let k = 0; k < 30; k++) {
      const p = randomParams();
      const t = rnd(0, 4 * Math.PI);
      const { v } = hamiltonianAxis(p);
      const U = evolutionOperator(p, t);
      expect(isUnitary(U)).toBe(true);
      expect(matApproxEq(U, matScale(Rn(v!, evolutionAngle(p, t)), expi(-p.omegaBar * t)), 1e-10)).toBe(true);
      expect(matApproxEq(U, expm(matScale(hamiltonianMatrix(p), c(0, -t))), 1e-9)).toBe(true);
    }
  });

  it('degenerate r = 0: no axis, stationary states, finite numbers everywhere', () => {
    const p: HamiltonianParams = { omegaBar: 0.7, deltaOmega: 0, epsilon: 0 };
    expect(hamiltonianAxis(p).v).toBeNull();
    const o = oscillation(p);
    expect(o.period).toBe(Infinity);
    expect(o.maxTransition).toBe(0);
    const psi0 = randomState(rng);
    for (const t of [0.5, 3, 9]) {
      expect(Number.isFinite(transitionProbability(p, t))).toBe(true);
      expect(abs2(transitionAmplitude(p, t))).toBe(0);
      const b0 = blochVector(psi0);
      const b = blochVector(evolveState(p, psi0, t));
      for (let j = 0; j < 3; j++) expect(b[j]).toBeCloseTo(b0[j], 12);
    }
    for (const pt of sampleTrajectory(p, psi0, 4 * Math.PI, 50)) expect(Number.isFinite(pt.p1)).toBe(true);
  });

  it('plot: P(0)+P(1) = 1, P(1) ≤ ε²/r², maximum reached at t = π/(2r), period π/r', () => {
    for (let k = 0; k < 20; k++) {
      const p = randomParams();
      const o = oscillation(p);
      for (const pt of sampleTrajectory(p, KET0, 4 * Math.PI, 200)) {
        expect(pt.p0 + pt.p1).toBeCloseTo(1, 12);
        expect(pt.p1).toBeLessThanOrEqual(o.maxTransition + 1e-12);
        expect(pt.p1).toBeCloseTo(transitionProbability(p, pt.t), 12);
      }
      expect(transitionProbability(p, Math.PI / (2 * o.r))).toBeCloseTo(o.maxTransition, 12);
      const t = rnd(0, 5);
      expect(transitionProbability(p, t + o.period)).toBeCloseTo(transitionProbability(p, t), 10);
    }
  });

  it('pure X (Δω = 0) gives complete transfer; strongly detuned gives ≈ 0.038 (prediction card)', () => {
    expect(transitionProbability({ omegaBar: 0, deltaOmega: 0, epsilon: 0.6 }, Math.PI / 1.2)).toBeCloseTo(1, 12);
    expect(oscillation({ omegaBar: 0, deltaOmega: 1.5, epsilon: 0.3 }).maxTransition).toBeCloseTo(0.09 / 2.34, 12);
  });

  it('identity offset: H and H + cI give overlap 1 at all times (comparison mode)', () => {
    const p: HamiltonianParams = { omegaBar: 0, deltaOmega: 0.5, epsilon: 0.6 };
    const q = { ...p, omegaBar: 1.5 };
    const psi0 = stateFromAngles(0.4, 1.1);
    for (const t of [0.3, 2.2, 7.7]) {
      const a = evolveState(p, psi0, t);
      const b = evolveState(q, psi0, t);
      expect(abs2(inner(a, b))).toBeCloseTo(1, 12);
      // removing e^{−iω̄t} (the "global phase" toggle) changes no probability
      const dephased = apply(matScale(evolutionOperator(q, t), expi(q.omegaBar * t)), psi0);
      expect(abs2(dephased[1])).toBeCloseTo(abs2(b[1]), 12);
      expect(norm(dephased)).toBeCloseTo(1, 12);
    }
  });
});
