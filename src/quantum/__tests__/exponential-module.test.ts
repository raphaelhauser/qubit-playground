/** Invariants behind Module D (matrix exponentials). */
import { describe, it, expect } from 'vitest';
import {
  c,
  I2,
  KET0,
  mat,
  ZERO,
  matR,
  matMul,
  matProd,
  dagger,
  matPow,
  matScale,
  matSub,
  matAdd,
  matApproxEq,
  nDotSigma,
  expm,
  expmSeries,
  frobenius,
  hamiltonianMatrix,
  isUnitary,
  det,
  trace,
  cexp,
  approxEq,
  apply,
  norm,
  Rn,
  mulberry32,
  randomUnitVector,
  fromPauli,
} from '../index';
import { cosSin, eulerProduct, lossyHamiltonian, spectralEvolution } from '../../modules/exponential/math';

const rng = mulberry32(31);
const rnd = (a: number, b: number) => a + (b - a) * rng();
const randH = () => fromPauli(c(rnd(-2, 2)), c(rnd(-2, 2)), c(rnd(-2, 2)), c(rnd(-2, 2)));

describe('Module D: matrix exponentials', () => {
  it('truncated even/odd series converge to cos and sin', () => {
    for (const x of [0.1, 1, 2.5, 2 * Math.PI]) {
      const r = cosSin(x, 20);
      expect(r.cs).toBeCloseTo(Math.cos(x), 10);
      expect(r.sn).toBeCloseTo(Math.sin(x), 10);
    }
  });

  it('even/odd split of the matrix series reproduces cos(θ/2)I − i sin(θ/2) n·σ term by term', () => {
    for (let k = 0; k < 10; k++) {
      const n = randomUnitVector(rng);
      const th = rnd(0, 4 * Math.PI);
      const NS = nDotSigma(n);
      const A = matScale(NS, c(0, -th / 2));
      // partial sum with 2M+2 terms of the matrix series = truncated cos/sin with m ≤ M
      for (const M of [0, 2, 5]) {
        const S = expmSeries(A, 2 * M + 2).partialSums[2 * M + 1];
        const r = cosSin(th / 2, M);
        const viaTrig = matAdd(matScale(I2, c(r.cs)), matScale(NS, c(0, -r.sn)));
        expect(matApproxEq(S, viaTrig, 1e-9)).toBe(true);
      }
      // powers alternate between I and n·σ
      for (let p = 0; p < 8; p++) expect(matApproxEq(matPow(NS, p), p % 2 === 0 ? I2 : NS, 1e-10)).toBe(true);
    }
  });

  it('series terminates for the nilpotent preset: e^A = I + A', () => {
    const A = matR(0, 1.5, 0, 0);
    expect(matApproxEq(expm(A), matAdd(I2, A))).toBe(true);
    const { partialSums } = expmSeries(A, 5);
    expect(frobenius(matSub(partialSums[1], expm(A)))).toBeLessThan(1e-15);
  });

  it('imaginary diagonal ⇒ unitary phases, real diagonal ⇒ not unitary', () => {
    expect(isUnitary(expm(mat(c(0, 1.2), ZERO, ZERO, c(0, -0.7))))).toBe(true);
    expect(isUnitary(expm(matR(1, 0, 0, -0.5)))).toBe(false);
  });

  it('spectral evolution V e^{−iΛt} V† equals expm(−iHt) (also degenerate H)', () => {
    const hs = [randH(), randH(), hamiltonianMatrix({ omegaBar: 0.4, deltaOmega: 0, epsilon: 0 })];
    for (const H of hs) {
      for (const t of [0.3, 2.1]) {
        const { U, V, Lambda } = spectralEvolution(H, t);
        expect(matApproxEq(U, expm(matScale(H, c(0, -t))), 1e-9)).toBe(true);
        expect(isUnitary(V)).toBe(true);
        expect(matApproxEq(matProd(V, Lambda, dagger(V)), H, 1e-9)).toBe(true);
      }
    }
  });

  it('det e^A = e^{tr A}; |det e^{−iHt}| = 1', () => {
    for (let k = 0; k < 20; k++) {
      const H = randH();
      const t = rnd(0, 5);
      const A = matScale(H, c(0, -t));
      expect(approxEq(det(expm(A)), cexp(trace(A)), 1e-9)).toBe(true);
    }
  });

  it('group law U(s)U(t) = U(s+t) and U(−t) = U(t)†-inverse', () => {
    const H = randH();
    const U = (x: number) => expm(matScale(H, c(0, -x)));
    for (let k = 0; k < 10; k++) {
      const s = rnd(-3, 3);
      const t = rnd(-3, 3);
      expect(matApproxEq(matMul(U(t), U(s)), U(s + t), 1e-9)).toBe(true);
      expect(matApproxEq(matMul(U(-t), U(t)), I2, 1e-9)).toBe(true);
    }
  });

  it('Euler product (I − iHT/N)^N converges like 1/N and inflates the norm', () => {
    const H = hamiltonianMatrix({ omegaBar: 0.2, deltaOmega: 0.5, epsilon: 0.7 });
    const T = 2;
    const UT = expm(matScale(H, c(0, -T)));
    const e10 = frobenius(matSub(eulerProduct(H, T, 10), UT));
    const e100 = frobenius(matSub(eulerProduct(H, T, 100), UT));
    expect(e100).toBeLessThan(e10);
    expect(e10 / e100).toBeGreaterThan(7); // ≈ 10 for a first-order method
    expect(norm(apply(eulerProduct(H, T, 10), KET0))).toBeGreaterThan(1);
  });

  it('lossy Hamiltonian H − iκ|1⟩⟨1| is not unitary and drains the norm', () => {
    const H = hamiltonianMatrix({ omegaBar: 0, deltaOmega: 0.3, epsilon: 0.6 });
    const Hk = lossyHamiltonian(H, 0.3);
    const U = expm(matScale(Hk, c(0, -3)));
    expect(isUnitary(U)).toBe(false);
    expect(norm(apply(U, KET0))).toBeLessThan(1);
    expect(isUnitary(expm(matScale(lossyHamiltonian(H, 0), c(0, -3))))).toBe(true);
  });

  it('R_n(2π) = −I, R_n(4π) = I (shown at θ = 2π)', () => {
    const n = randomUnitVector(rng);
    expect(matApproxEq(Rn(n, 2 * Math.PI), matScale(I2, c(-1)))).toBe(true);
  });
});
