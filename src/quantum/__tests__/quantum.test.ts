import { describe, it, expect } from 'vitest';
import {
  c,
  ZERO,
  ONE,
  I,
  mul,
  div,
  conj,
  abs2,
  expi,
  approxEq,
  csqrt,
  cexp,
  // linalg
  Mat2,
  Vec2,
  Vec3,
  I2,
  PX,
  PY,
  PZ,
  KET0,
  KET1,
  mat,
  matR,
  matMul,
  matProd,
  matAdd,
  matScale,
  matScaleR,
  matApproxEq,
  vecApproxEq,
  dagger,
  det,
  trace,
  commutator,
  anticommutator,
  apply,
  inner,
  norm,
  normalize,
  vscale,
  expm,
  expmTaylor,
  expmSeries,
  isUnitary,
  isHermitian,
  eigHermitian,
  pauliDecompose,
  fromPauli,
  nDotSigma,
  // bloch
  stateFromAngles,
  blochVector,
  anglesFromBloch,
  stateFromBloch,
  canonicalize,
  equalUpToGlobalPhase,
  PRESETS,
  rotate3,
  len3,
  dot3,
  // gates
  X,
  Y,
  Z,
  H,
  S,
  T,
  Rx,
  Ry,
  Rz,
  Rn,
  axisAngle,
  GATES,
  partialRotation,
  // hamiltonian
  HamiltonianParams,
  hamiltonianMatrix,
  evolutionOperator,
  evolveState,
  transitionAmplitude,
  transitionProbability,
  fromOmegas,
  hamiltonianAxis,
  oscillation,
  // measurement
  probabilities,
  probabilitiesFromBloch,
  collapse,
  projector,
  eigenbasis,
  predictChain,
  MAXIMALLY_MIXED,
  densityFromState,
  measure,
  // random
  mulberry32,
  randomUnitVector,
  randomState,
  // format
  texReal,
  texComplex,
  texAngle,
  texMatrix,
  texKet,
  texPauliSum,
  fmt,
} from '../index';

const rng = mulberry32(12345);
const TOL = 1e-10;

function randomMatrix(r = rng): Mat2 {
  const z = () => c(2 * r() - 1, 2 * r() - 1);
  return mat(z(), z(), z(), z());
}
function randomUnitary(r = rng): Mat2 {
  return matScale(Rn(randomUnitVector(r), 2 * Math.PI * r()), expi(2 * Math.PI * r()));
}
function randomHermitian(r = rng): Mat2 {
  return fromPauli(c(4 * r() - 2), c(4 * r() - 2), c(4 * r() - 2), c(4 * r() - 2));
}
const expectMat = (A: Mat2, B: Mat2, tol = TOL) => expect(matApproxEq(A, B, tol)).toBe(true);
const expectVec3 = (a: Vec3, b: Vec3, tol = 1e-9) => {
  for (let k = 0; k < 3; k++) expect(a[k]).toBeCloseTo(b[k], 8 + 0 * tol);
};

describe('complex arithmetic', () => {
  it('basic identities', () => {
    expect(approxEq(mul(I, I), c(-1))).toBe(true);
    expect(approxEq(div(c(1, 1), c(1, -1)), I)).toBe(true);
    expect(approxEq(mul(c(3, 4), conj(c(3, 4))), c(25))).toBe(true);
    expect(abs2(c(3, 4))).toBe(25);
  });
  it("Euler's formula and complex exp", () => {
    expect(approxEq(cexp(c(0, Math.PI)), c(-1), 1e-12)).toBe(true);
    expect(approxEq(expi(Math.PI / 2), I, 1e-12)).toBe(true);
  });
  it('principal square root', () => {
    for (let k = 0; k < 50; k++) {
      const z = c(4 * rng() - 2, 4 * rng() - 2);
      const s = csqrt(z);
      expect(approxEq(mul(s, s), z, 1e-12)).toBe(true);
      expect(s.re).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('Pauli algebra: anticommutators and commutators', () => {
  it('Pauli matrices are Hermitian, unitary, square to I', () => {
    for (const P of [PX, PY, PZ]) {
      expect(isHermitian(P)).toBe(true);
      expect(isUnitary(P)).toBe(true);
      expectMat(matMul(P, P), I2);
    }
  });
  it('anticommute pairwise', () => {
    expectMat(anticommutator(PX, PY), matR(0, 0, 0, 0));
    expectMat(anticommutator(PY, PZ), matR(0, 0, 0, 0));
    expectMat(anticommutator(PZ, PX), matR(0, 0, 0, 0));
  });
  it('commutators [σ1,σ2] = 2iσ3 cyclically', () => {
    const twoI = c(0, 2);
    expectMat(commutator(PX, PY), matScale(PZ, twoI));
    expectMat(commutator(PY, PZ), matScale(PX, twoI));
    expectMat(commutator(PZ, PX), matScale(PY, twoI));
  });
  it('products XY = iZ, YZ = iX, ZX = iY and reversed order', () => {
    expectMat(matMul(PX, PY), matScale(PZ, I));
    expectMat(matMul(PY, PZ), matScale(PX, I));
    expectMat(matMul(PZ, PX), matScale(PY, I));
    expectMat(matMul(PY, PX), matScale(PZ, c(0, -1)));
    expectMat(matMul(PZ, PY), matScale(PX, c(0, -1)));
    expectMat(matMul(PX, PZ), matScale(PY, c(0, -1)));
  });
  it('(n·σ)² = I for unit n', () => {
    for (let k = 0; k < 20; k++) {
      const n = randomUnitVector(rng);
      expectMat(matMul(nDotSigma(n), nDotSigma(n)), I2);
    }
  });
  it('Pauli decomposition round-trips', () => {
    for (let k = 0; k < 20; k++) {
      const A = randomMatrix();
      const [a0, ax, ay, az] = pauliDecompose(A);
      expectMat(fromPauli(a0, ax, ay, az), A);
    }
  });
});

describe('matrix exponential', () => {
  it('closed form agrees with scaled Taylor series', () => {
    for (let k = 0; k < 40; k++) {
      const A = matScaleR(randomMatrix(), 3);
      expectMat(expm(A), expmTaylor(A), 1e-8);
    }
  });
  it('handles nilpotent and scalar matrices (s → 0 branch)', () => {
    const N = matR(0, 1, 0, 0);
    expectMat(expm(N), matR(1, 1, 0, 1));
    expectMat(expm(matScale(I2, c(0, 1.3))), matScale(I2, expi(1.3)));
  });
  it('diagonal matrices exponentiate entrywise', () => {
    const D = mat(c(0.3, 1), ZERO, ZERO, c(-1, 0.2));
    expectMat(expm(D), mat(cexp(c(0.3, 1)), ZERO, ZERO, cexp(c(-1, 0.2))));
  });
  it('e^{U†AU} = U† e^A U', () => {
    for (let k = 0; k < 30; k++) {
      const A = randomMatrix();
      const U = randomUnitary();
      expectMat(expm(matProd(dagger(U), A, U)), matProd(dagger(U), expm(A), U), 1e-9);
    }
  });
  it('series partial sums converge to e^A', () => {
    const A = matScale(nDotSigma([0, 0.6, 0.8]), c(0, -1.1));
    const { partialSums, terms } = expmSeries(A, 25);
    expect(terms.length).toBe(25);
    expectMat(partialSums[24], expm(A), 1e-12);
  });
  it('e^{−iθ n·σ/2} = cos(θ/2) I − i sin(θ/2) n·σ', () => {
    for (let k = 0; k < 20; k++) {
      const n = randomUnitVector(rng);
      const th = 4 * Math.PI * rng() - 2 * Math.PI;
      const viaExp = expm(matScale(nDotSigma(n), c(0, -th / 2)));
      expectMat(viaExp, Rn(n, th), 1e-10);
    }
  });
  it('e^{−iHt} is unitary for Hermitian H with det = e^{−i tr(H) t}', () => {
    for (let k = 0; k < 20; k++) {
      const Hm = randomHermitian();
      const t = 5 * rng();
      const U = expm(matScale(Hm, c(0, -t)));
      expect(isUnitary(U, 1e-10)).toBe(true);
      expect(approxEq(det(U), expi(-trace(Hm).re * t), 1e-10)).toBe(true);
    }
  });
  it('eigen-decomposition reconstructs Hermitian matrices and e^A = V e^Λ V†', () => {
    for (let k = 0; k < 20; k++) {
      const A = randomHermitian();
      const { values, vectors } = eigHermitian(A);
      for (let j = 0; j < 2; j++) {
        expect(vecApproxEq(apply(A, vectors[j]), vscale(vectors[j], c(values[j])), 1e-9)).toBe(true);
        expect(norm(vectors[j])).toBeCloseTo(1, 12);
      }
      expect(abs2(inner(vectors[0], vectors[1]))).toBeLessThan(1e-20 + 1e-18);
      const V = mat(vectors[0][0], vectors[1][0], vectors[0][1], vectors[1][1]);
      const expL = mat(cexp(c(0, -values[0])), ZERO, ZERO, cexp(c(0, -values[1])));
      expectMat(matProd(V, expL, dagger(V)), expm(matScale(A, c(0, -1))), 1e-9);
    }
  });
});

describe('gates and Bloch-sphere rotations', () => {
  it('all named gates are unitary', () => {
    for (const g of GATES) expect(isUnitary(g.build(1.234))).toBe(true);
    for (let k = 0; k < 20; k++) expect(isUnitary(Rn(randomUnitVector(rng), 7 * rng()))).toBe(true);
  });
  it('H is Hermitian and self-inverse', () => {
    expect(isHermitian(H)).toBe(true);
    expectMat(matMul(H, H), I2);
  });
  it('R_n(θ) rotates the Bloch vector by +θ about n (right-hand rule, factor 1/2)', () => {
    for (let k = 0; k < 100; k++) {
      const n = randomUnitVector(rng);
      const th = 4 * Math.PI * rng() - 2 * Math.PI;
      const psi = randomState(rng);
      const got = blochVector(apply(Rn(n, th), psi));
      const want = rotate3(blochVector(psi), n, th);
      expectVec3(got, want);
    }
    // concrete check: Rz(π/2)|+⟩ = |+i⟩ up to phase
    expectVec3(blochVector(apply(Rz(Math.PI / 2), stateFromAngles(Math.PI / 2, 0))), [0, 1, 0]);
  });
  it('R_n(2π) = −I (spinor sign), R_n(4π) = I', () => {
    const n = randomUnitVector(rng);
    expectMat(Rn(n, 2 * Math.PI), matScaleR(I2, -1));
    expectMat(Rn(n, 4 * Math.PI), I2);
  });
  it('Pauli gates are π rotations up to global phase i', () => {
    expectMat(X, matScale(Rx(Math.PI), I));
    expectMat(Y, matScale(Ry(Math.PI), I));
    expectMat(Z, matScale(Rz(Math.PI), I));
    expectMat(H, matScale(Rn([1, 0, 1], Math.PI), I));
  });
  it('axisAngle decomposes U = e^{iα} R_n(θ)', () => {
    const ax = axisAngle(X);
    expectVec3(ax.axis, [1, 0, 0]);
    expect(ax.angle).toBeCloseTo(Math.PI, 10);
    const ah = axisAngle(H);
    expectVec3(ah.axis, [Math.SQRT1_2, 0, Math.SQRT1_2]);
    for (let k = 0; k < 50; k++) {
      const U = randomUnitary();
      const { axis, angle, globalPhase } = axisAngle(U);
      expect(angle).toBeGreaterThanOrEqual(0);
      expect(angle).toBeLessThanOrEqual(Math.PI + 1e-9);
      expectMat(matScale(Rn(axis, angle), expi(globalPhase)), U, 1e-9);
    }
    expect(axisAngle(matScale(I2, expi(0.7))).trivial).toBe(true);
  });
  it('partialRotation reaches the gate (up to global phase) at s = 1', () => {
    for (const g of GATES) {
      const U = g.build(0.9);
      const psi = randomState(rng);
      expect(equalUpToGlobalPhase(apply(partialRotation(U, 1), psi), apply(U, psi))).toBe(true);
    }
  });
  it('S² = Z, T² = S', () => {
    expectMat(matMul(S, S), Z);
    expectMat(matMul(T, T), S);
  });
});

describe('Hadamard conjugation', () => {
  it('HXH = Z, HZH = X, HYH = −Y', () => {
    expectMat(matProd(H, X, H), Z);
    expectMat(matProd(H, Z, H), X);
    expectMat(matProd(H, Y, H), matScaleR(Y, -1));
  });
  it('H Rx(θ) H = Rz(θ) for all θ', () => {
    for (let k = 0; k < 30; k++) {
      const th = 8 * rng() - 4;
      expectMat(matProd(H, Rx(th), H), Rz(th));
      expectMat(matProd(H, Rz(th), H), Rx(th));
      expectMat(matProd(H, Ry(th), H), Ry(-th));
    }
  });
});

describe('Bloch sphere states', () => {
  it('presets map to the correct Bloch vectors', () => {
    for (const p of PRESETS) expectVec3(blochVector(stateFromAngles(p.theta, p.phi)), p.bloch);
  });
  it('angles ↔ state ↔ Bloch round-trip', () => {
    for (let k = 0; k < 50; k++) {
      const th = Math.PI * rng();
      const ph = 2 * Math.PI * rng();
      const v = blochVector(stateFromAngles(th, ph));
      const a = anglesFromBloch(v);
      expect(a.theta).toBeCloseTo(th, 9);
      expect(a.phi).toBeCloseTo(ph, 9);
      expectVec3(blochVector(stateFromBloch(v)), v);
      expect(len3(v)).toBeCloseTo(1, 12);
    }
  });
  it('global phase changes neither Bloch vector nor probabilities', () => {
    for (let k = 0; k < 30; k++) {
      const psi = randomState(rng);
      const g = 2 * Math.PI * rng();
      const psiG = vscale(psi, expi(g));
      expectVec3(blochVector(psiG), blochVector(psi));
      expect(abs2(psiG[0])).toBeCloseTo(abs2(psi[0]), 12);
      expect(equalUpToGlobalPhase(psi, psiG)).toBe(true);
      const { state, globalPhase } = canonicalize(psiG);
      expect(state[0].im).toBeCloseTo(0, 12);
      expect(state[0].re).toBeGreaterThanOrEqual(0);
      expect(vecApproxEq(vscale(state, expi(globalPhase)), normalize(psiG), 1e-12)).toBe(true);
    }
  });
  it('relative phase does change the state', () => {
    const plus = stateFromAngles(Math.PI / 2, 0);
    const minus = stateFromAngles(Math.PI / 2, Math.PI);
    expect(equalUpToGlobalPhase(plus, minus)).toBe(false);
    expect(abs2(inner(plus, minus))).toBeCloseTo(0, 12);
  });
});

describe('Hamiltonian evolution', () => {
  const cases: HamiltonianParams[] = [
    { omegaBar: 0.7, deltaOmega: 0.4, epsilon: 0 },
    { omegaBar: -0.3, deltaOmega: 0, epsilon: 0.9 },
    { omegaBar: 1.1, deltaOmega: 0.5, epsilon: 0.35 },
    { omegaBar: 0.4, deltaOmega: 0, epsilon: 0 }, // degenerate r = 0
  ];
  it('analytic U_t equals the matrix exponential e^{−iHt}', () => {
    for (const p of cases) {
      for (const t of [0, 0.3, 1.7, 5.2]) {
        const numeric = expm(matScale(hamiltonianMatrix(p), c(0, -t)));
        expectMat(evolutionOperator(p, t), numeric, 1e-10);
        expect(isUnitary(evolutionOperator(p, t))).toBe(true);
      }
    }
  });
  it('U_t solves i dψ/dt = Hψ (finite-difference check)', () => {
    const p = cases[2];
    const psi0 = randomState(rng);
    const t = 0.83;
    const h = 1e-5;
    const a = evolveState(p, psi0, t + h);
    const b = evolveState(p, psi0, t - h);
    const dpsi: Vec2 = [c((a[0].re - b[0].re) / (2 * h), (a[0].im - b[0].im) / (2 * h)), c((a[1].re - b[1].re) / (2 * h), (a[1].im - b[1].im) / (2 * h))];
    const lhs = vscale(dpsi, I);
    const rhs = apply(hamiltonianMatrix(p), evolveState(p, psi0, t));
    expect(vecApproxEq(lhs, rhs, 1e-7)).toBe(true);
  });
  it('diagonal H: ψ(t) for |0⟩ and |+⟩', () => {
    const w1 = 1.3;
    const w2 = -0.4;
    const p = fromOmegas(w1, w2);
    for (const t of [0.2, 1.4, 3.3]) {
      expect(vecApproxEq(evolveState(p, KET0, t), [expi(-w1 * t), ZERO])).toBe(true);
      const plus: Vec2 = [c(Math.SQRT1_2), c(Math.SQRT1_2)];
      expect(vecApproxEq(evolveState(p, plus, t), [mul(c(Math.SQRT1_2), expi(-w1 * t)), mul(c(Math.SQRT1_2), expi(-w2 * t))])).toBe(true);
    }
  });
  it('transition amplitude and probability formulas', () => {
    for (const p of cases) {
      for (const t of [0.1, 0.9, 2.5, 7]) {
        const psi = evolveState(p, KET0, t);
        expect(approxEq(inner(KET1, psi), transitionAmplitude(p, t), 1e-12)).toBe(true);
        expect(abs2(psi[1])).toBeCloseTo(transitionProbability(p, t), 12);
        expect(norm(psi)).toBeCloseTo(1, 12);
      }
    }
  });
  it('identity component only contributes a global phase', () => {
    const base: HamiltonianParams = { omegaBar: 0, deltaOmega: 0.6, epsilon: 0.8 };
    const shifted: HamiltonianParams = { ...base, omegaBar: 2.4 };
    const psi0 = randomState(rng);
    for (const t of [0.4, 1.9, 4.4]) {
      const a = evolveState(base, psi0, t);
      const b = evolveState(shifted, psi0, t);
      expect(equalUpToGlobalPhase(a, b)).toBe(true);
      expectVec3(blochVector(a), blochVector(b));
    }
  });
  it('Bloch vector precesses about v by angle 2rt', () => {
    const p: HamiltonianParams = { omegaBar: 0.3, deltaOmega: 0.5, epsilon: 0.7 };
    const { r, v } = hamiltonianAxis(p);
    const psi0 = randomState(rng);
    for (const t of [0.5, 1.5, 3]) {
      expectVec3(blochVector(evolveState(p, psi0, t)), rotate3(blochVector(psi0), v!, 2 * r * t));
    }
  });
  it('oscillation summary', () => {
    const o = oscillation({ omegaBar: 0, deltaOmega: 0.3, epsilon: 0.4 });
    expect(o.r).toBeCloseTo(0.5, 12);
    expect(o.maxTransition).toBeCloseTo(0.64, 12);
    expect(o.period).toBeCloseTo(Math.PI / 0.5, 12);
    expect(oscillation({ omegaBar: 1, deltaOmega: 0, epsilon: 0 }).maxTransition).toBe(0);
  });
});

describe('measurement and Stern–Gerlach', () => {
  it('eigenvectors of X, Y, Z with eigenvalues ±1', () => {
    for (const [P, n] of [[PX, [1, 0, 0]], [PY, [0, 1, 0]], [PZ, [0, 0, 1]]] as const) {
      const { plus, minus } = eigenbasis(n as Vec3);
      expect(vecApproxEq(apply(P, plus), plus)).toBe(true);
      expect(vecApproxEq(apply(P, minus), vscale(minus, c(-1)))).toBe(true);
      const e = eigHermitian(P);
      expect(e.values[0]).toBeCloseTo(-1, 12);
      expect(e.values[1]).toBeCloseTo(1, 12);
    }
  });
  it('Born rule: probabilities sum to one and match (1 ± n·r)/2', () => {
    for (let k = 0; k < 50; k++) {
      const psi = randomState(rng);
      const n = randomUnitVector(rng);
      const p = probabilities(psi, n);
      const q = probabilitiesFromBloch(blochVector(psi), n);
      expect(p.plus + p.minus).toBeCloseTo(1, 12);
      expect(p.plus).toBeCloseTo(q.plus, 12);
    }
  });
  it('measuring |0⟩ in the X basis gives 1/2, 1/2', () => {
    const p = probabilities(KET0, [1, 0, 0]);
    expect(p.plus).toBeCloseTo(0.5, 12);
    expect(p.minus).toBeCloseTo(0.5, 12);
    // equivalently: apply H, measure in Z
    const viaH = apply(H, KET0);
    expect(abs2(viaH[0])).toBeCloseTo(0.5, 12);
  });
  it('projectors are idempotent, Hermitian, complementary', () => {
    const n = randomUnitVector(rng);
    const Pp = projector(n, 1);
    const Pm = projector(n, -1);
    expectMat(matMul(Pp, Pp), Pp);
    expect(isHermitian(Pp)).toBe(true);
    expectMat(matAdd(Pp, Pm), I2);
    expectMat(matMul(Pp, Pm), matR(0, 0, 0, 0));
  });
  it('collapse produces the eigenstate; repeating the measurement is deterministic', () => {
    for (let k = 0; k < 20; k++) {
      const psi = randomState(rng);
      const n = randomUnitVector(rng);
      const post = collapse(psi, n, 1);
      expectVec3(blochVector(post), n);
      expect(probabilities(post, n).plus).toBeCloseTo(1, 12);
    }
  });
  it('Stern–Gerlach chains from an unpolarized oven', () => {
    const z: Vec3 = [0, 0, 1];
    const x: Vec3 = [1, 0, 0];
    const single = predictChain(MAXIMALLY_MIXED, [{ axis: z, pass: 'both' }]);
    expect(single.finalPlus).toBeCloseTo(0.5, 12);
    const zx = predictChain(MAXIMALLY_MIXED, [{ axis: z, pass: 'plus' }, { axis: x, pass: 'both' }]);
    expect(zx.finalPlus).toBeCloseTo(0.25, 12);
    expect(zx.condPlus[1]).toBeCloseTo(0.5, 12);
    const zxz = predictChain(MAXIMALLY_MIXED, [{ axis: z, pass: 'plus' }, { axis: x, pass: 'plus' }, { axis: z, pass: 'both' }]);
    expect(zxz.condPlus[2]).toBeCloseTo(0.5, 12);
    expect(zxz.finalPlus).toBeCloseTo(0.125, 12);
    expect(zxz.finalMinus).toBeCloseTo(0.125, 12);
    const zxx = predictChain(MAXIMALLY_MIXED, [{ axis: z, pass: 'plus' }, { axis: x, pass: 'plus' }, { axis: x, pass: 'both' }]);
    expect(zxx.condPlus[2]).toBeCloseTo(1, 12);
    const zz = predictChain(MAXIMALLY_MIXED, [{ axis: z, pass: 'plus' }, { axis: z, pass: 'both' }]);
    expect(zz.condPlus[1]).toBeCloseTo(1, 12);
    expect(zz.finalMinus).toBeCloseTo(0, 12);
    // tilted axis: P(+) = cos²(α/2)
    const a = Math.PI / 6;
    const tilt = predictChain(densityFromState(KET0), [{ axis: [Math.sin(a), 0, Math.cos(a)], pass: 'both' }]);
    expect(tilt.finalPlus).toBeCloseTo(Math.cos(a / 2) ** 2, 12);
  });
  it('sampled statistics converge to the Born rule', () => {
    const r = mulberry32(7);
    const psi = stateFromAngles(1.1, 0.4);
    const n: Vec3 = [1, 0, 0];
    const N = 20000;
    let plus = 0;
    for (let k = 0; k < N; k++) if (measure(psi, n, r).outcome === 1) plus++;
    const p = probabilities(psi, n).plus;
    expect(Math.abs(plus / N - p)).toBeLessThan(4 * Math.sqrt((p * (1 - p)) / N));
  });
  it('random states have uniformly distributed Bloch vectors (⟨r⟩ ≈ 0)', () => {
    const r = mulberry32(99);
    let sx = 0, sy = 0, sz = 0;
    const N = 20000;
    for (let k = 0; k < N; k++) {
      const v = blochVector(randomState(r));
      sx += v[0]; sy += v[1]; sz += v[2];
    }
    expect(Math.abs(sx / N)).toBeLessThan(0.03);
    expect(Math.abs(sy / N)).toBeLessThan(0.03);
    expect(Math.abs(sz / N)).toBeLessThan(0.03);
    expect(dot3([sx, sy, sz], [0, 0, 0])).toBe(0);
  });
});

describe('formatting', () => {
  it('recognizes exact values', () => {
    expect(texReal(Math.SQRT1_2)).toBe('\\tfrac{1}{\\sqrt{2}}');
    expect(texReal(-0.5)).toBe('-\\tfrac{1}{2}');
    expect(texReal(0.1234)).toBe('0.123');
    expect(texReal(-1e-9)).toBe('0');
    expect(texComplex(c(0, -1))).toBe('-i');
    expect(texComplex(c(0.5, 0.5))).toBe('\\tfrac{1}{2} + \\tfrac{1}{2}i');
    expect(texAngle(Math.PI / 2)).toBe('\\tfrac{\\pi}{2}');
    expect(texAngle(-3 * Math.PI / 4)).toBe('-\\tfrac{3\\pi}{4}');
    expect(texAngle(2 * Math.PI)).toBe('2\\pi');
    expect(fmt(-0.0001)).toBe('0.000');
    expect(fmt(-0.5)).toBe('−0.500');
  });
  it('factors matrices like H', () => {
    expect(texMatrix(H)).toBe('\\tfrac{1}{\\sqrt{2}}\\begin{pmatrix} 1 & 1 \\\\ 1 & -1 \\end{pmatrix}');
    expect(texMatrix(PY)).toBe('\\begin{pmatrix} 0 & -i \\\\ i & 0 \\end{pmatrix}');
  });
  it('kets and Pauli sums', () => {
    expect(texKet([c(Math.SQRT1_2), c(0, -Math.SQRT1_2)])).toBe('\\tfrac{1}{\\sqrt{2}}|0\\rangle - \\tfrac{1}{\\sqrt{2}}i|1\\rangle');
    expect(texPauliSum(pauliDecompose(commutator(PX, PY)))).toBe('2iZ');
    expect(texPauliSum(pauliDecompose(matR(0, 0, 0, 0)))).toBe('0');
    expect(texKet([ONE, ZERO])).toBe('|0\\rangle');
  });
});

describe('angle formatting (inline)', () => {
  it('uses slashes when inline', () => {
    expect(texAngle(Math.PI / 3, { inline: true })).toBe('\\pi/3');
    expect(texAngle((5 * Math.PI) / 6, { inline: true })).toBe('5\\pi/6');
  });
});
