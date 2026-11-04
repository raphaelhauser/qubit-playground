/**
 * 2-dimensional complex linear algebra: state vectors (kets) and 2×2 operators.
 */
import {
  Complex,
  c,
  ZERO,
  ONE,
  I as IU,
  add,
  sub,
  mul,
  conj,
  scale,
  abs2,
  approxEq,
  div,
  csqrt,
  cosh,
  sinh,
  cexp,
  neg,
} from './complex';

export type Vec2 = readonly [Complex, Complex];
export type Mat2 = readonly [readonly [Complex, Complex], readonly [Complex, Complex]];
export type Vec3 = readonly [number, number, number];

// ---------------------------------------------------------------------------
// constructors
// ---------------------------------------------------------------------------

export const vec = (a: Complex, b: Complex): Vec2 => [a, b];
export const mat = (a: Complex, b: Complex, cc: Complex, d: Complex): Mat2 => [
  [a, b],
  [cc, d],
];
/** Build a matrix from real entries. */
export const matR = (a: number, b: number, cc: number, d: number): Mat2 =>
  mat(c(a), c(b), c(cc), c(d));

export const KET0: Vec2 = [ONE, ZERO];
export const KET1: Vec2 = [ZERO, ONE];

export const I2: Mat2 = matR(1, 0, 0, 1);
export const ZERO2: Mat2 = matR(0, 0, 0, 0);
/** Pauli matrices σ₁ = X, σ₂ = Y, σ₃ = Z. */
export const PX: Mat2 = matR(0, 1, 1, 0);
export const PY: Mat2 = mat(ZERO, c(0, -1), c(0, 1), ZERO);
export const PZ: Mat2 = matR(1, 0, 0, -1);
export const PAULIS: readonly [Mat2, Mat2, Mat2] = [PX, PY, PZ];

// ---------------------------------------------------------------------------
// vector operations
// ---------------------------------------------------------------------------

/** ⟨u|v⟩ = Σ conj(uᵢ) vᵢ — note the complex conjugate on the bra. */
export const inner = (u: Vec2, v: Vec2): Complex =>
  add(mul(conj(u[0]), v[0]), mul(conj(u[1]), v[1]));

export const norm2 = (v: Vec2): number => abs2(v[0]) + abs2(v[1]);
export const norm = (v: Vec2): number => Math.sqrt(norm2(v));

export function normalize(v: Vec2): Vec2 {
  const n = norm(v);
  if (n === 0) throw new Error('Cannot normalize the zero vector');
  return [scale(v[0], 1 / n), scale(v[1], 1 / n)];
}

export const vscale = (v: Vec2, s: Complex): Vec2 => [mul(v[0], s), mul(v[1], s)];
export const vadd = (u: Vec2, v: Vec2): Vec2 => [add(u[0], v[0]), add(u[1], v[1])];
export const vsub = (u: Vec2, v: Vec2): Vec2 => [sub(u[0], v[0]), sub(u[1], v[1])];

export const vecApproxEq = (u: Vec2, v: Vec2, tol = 1e-9): boolean =>
  approxEq(u[0], v[0], tol) && approxEq(u[1], v[1], tol);

// ---------------------------------------------------------------------------
// matrix operations
// ---------------------------------------------------------------------------

export const apply = (M: Mat2, v: Vec2): Vec2 => [
  add(mul(M[0][0], v[0]), mul(M[0][1], v[1])),
  add(mul(M[1][0], v[0]), mul(M[1][1], v[1])),
];

export const matMul = (A: Mat2, B: Mat2): Mat2 =>
  mat(
    add(mul(A[0][0], B[0][0]), mul(A[0][1], B[1][0])),
    add(mul(A[0][0], B[0][1]), mul(A[0][1], B[1][1])),
    add(mul(A[1][0], B[0][0]), mul(A[1][1], B[1][0])),
    add(mul(A[1][0], B[0][1]), mul(A[1][1], B[1][1])),
  );

/** Product of several matrices, left to right: matProd(A, B, C) = A·B·C. */
export const matProd = (...Ms: Mat2[]): Mat2 => Ms.reduce((acc, M) => matMul(acc, M), I2);

export const matAdd = (A: Mat2, B: Mat2): Mat2 =>
  mat(add(A[0][0], B[0][0]), add(A[0][1], B[0][1]), add(A[1][0], B[1][0]), add(A[1][1], B[1][1]));
export const matSub = (A: Mat2, B: Mat2): Mat2 =>
  mat(sub(A[0][0], B[0][0]), sub(A[0][1], B[0][1]), sub(A[1][0], B[1][0]), sub(A[1][1], B[1][1]));
/** Multiply by a complex scalar. */
export const matScale = (A: Mat2, s: Complex): Mat2 =>
  mat(mul(A[0][0], s), mul(A[0][1], s), mul(A[1][0], s), mul(A[1][1], s));
export const matScaleR = (A: Mat2, s: number): Mat2 => matScale(A, c(s));
export const matNeg = (A: Mat2): Mat2 => matScaleR(A, -1);

export const transpose = (A: Mat2): Mat2 => mat(A[0][0], A[1][0], A[0][1], A[1][1]);
export const conjugate = (A: Mat2): Mat2 =>
  mat(conj(A[0][0]), conj(A[0][1]), conj(A[1][0]), conj(A[1][1]));
/** Hermitian conjugate A† = conj(Aᵀ). */
export const dagger = (A: Mat2): Mat2 => conjugate(transpose(A));

export const trace = (A: Mat2): Complex => add(A[0][0], A[1][1]);
export const det = (A: Mat2): Complex => sub(mul(A[0][0], A[1][1]), mul(A[0][1], A[1][0]));

export const commutator = (A: Mat2, B: Mat2): Mat2 => matSub(matMul(A, B), matMul(B, A));
export const anticommutator = (A: Mat2, B: Mat2): Mat2 => matAdd(matMul(A, B), matMul(B, A));

export function matPow(A: Mat2, k: number): Mat2 {
  let R = I2;
  for (let i = 0; i < k; i++) R = matMul(R, A);
  return R;
}

/** |u⟩⟨v| */
export const outer = (u: Vec2, v: Vec2): Mat2 =>
  mat(mul(u[0], conj(v[0])), mul(u[0], conj(v[1])), mul(u[1], conj(v[0])), mul(u[1], conj(v[1])));

export function frobenius(A: Mat2): number {
  return Math.sqrt(abs2(A[0][0]) + abs2(A[0][1]) + abs2(A[1][0]) + abs2(A[1][1]));
}

export const matApproxEq = (A: Mat2, B: Mat2, tol = 1e-9): boolean =>
  approxEq(A[0][0], B[0][0], tol) &&
  approxEq(A[0][1], B[0][1], tol) &&
  approxEq(A[1][0], B[1][0], tol) &&
  approxEq(A[1][1], B[1][1], tol);

export const isUnitary = (U: Mat2, tol = 1e-9): boolean => matApproxEq(matMul(dagger(U), U), I2, tol);
export const isHermitian = (A: Mat2, tol = 1e-9): boolean => matApproxEq(A, dagger(A), tol);

// ---------------------------------------------------------------------------
// Pauli decomposition:  A = a₀ I + a₁ X + a₂ Y + a₃ Z,  a_k = tr(σ_k A)/2
// ---------------------------------------------------------------------------

export type PauliCoeffs = readonly [Complex, Complex, Complex, Complex];

export function pauliDecompose(A: Mat2): PauliCoeffs {
  const half = (z: Complex) => scale(z, 0.5);
  return [
    half(trace(A)),
    half(trace(matMul(PX, A))),
    half(trace(matMul(PY, A))),
    half(trace(matMul(PZ, A))),
  ];
}

export function fromPauli(a0: Complex, ax: Complex, ay: Complex, az: Complex): Mat2 {
  return matAdd(
    matAdd(matScale(I2, a0), matScale(PX, ax)),
    matAdd(matScale(PY, ay), matScale(PZ, az)),
  );
}

/** n·σ = n₁X + n₂Y + n₃Z for a real 3-vector n. */
export const nDotSigma = (n: Vec3): Mat2 => fromPauli(ZERO, c(n[0]), c(n[1]), c(n[2]));

// ---------------------------------------------------------------------------
// matrix exponential
// ---------------------------------------------------------------------------

/**
 * Exact closed form for 2×2 matrices.
 * Write A = μI + B with μ = tr(A)/2 and B traceless. Then B² = −det(B)·I =: s²I, so
 *   e^A = e^μ (cosh(s) I + sinh(s)/s · B),
 * with sinh(s)/s → 1 as s → 0 (handled with a series to avoid 0/0).
 */
export function expm(A: Mat2): Mat2 {
  const mu = scale(trace(A), 0.5);
  const B = matSub(A, matScale(I2, mu));
  const s2 = neg(det(B));
  const s = csqrt(s2);
  let sinhc: Complex;
  if (abs2(s) < 1e-8) {
    // sinh(s)/s = 1 + s²/6 + s⁴/120 + …
    sinhc = add(ONE, add(scale(s2, 1 / 6), scale(mul(s2, s2), 1 / 120)));
  } else {
    sinhc = div(sinh(s), s);
  }
  const inner2 = matAdd(matScale(I2, cosh(s)), matScale(B, sinhc));
  return matScale(inner2, cexp(mu));
}

/** Truncated Taylor series. Returns the individual terms Aᵏ/k! and the partial sums. */
export function expmSeries(A: Mat2, nTerms: number): { terms: Mat2[]; partialSums: Mat2[] } {
  const terms: Mat2[] = [];
  const partialSums: Mat2[] = [];
  let term = I2;
  let acc = ZERO2;
  for (let k = 0; k < nTerms; k++) {
    if (k > 0) term = matScaleR(matMul(term, A), 1 / k);
    acc = matAdd(acc, term);
    terms.push(term);
    partialSums.push(acc);
  }
  return { terms, partialSums };
}

/** Independent numerical exponential (scaling and squaring + Taylor) for cross-checks. */
export function expmTaylor(A: Mat2, terms = 30): Mat2 {
  const nrm = frobenius(A);
  const sq = nrm > 0.5 ? Math.ceil(Math.log2(nrm / 0.5)) : 0;
  const As = matScaleR(A, 1 / 2 ** sq);
  const { partialSums } = expmSeries(As, terms);
  let R = partialSums[partialSums.length - 1];
  for (let i = 0; i < sq; i++) R = matMul(R, R);
  return R;
}

// ---------------------------------------------------------------------------
// eigen-decomposition of Hermitian 2×2 matrices
// ---------------------------------------------------------------------------

export interface HermitianEigen {
  /** eigenvalues, ascending: [a₀ − r, a₀ + r] */
  values: [number, number];
  /** normalized eigenvectors, vectors[k] belongs to values[k] */
  vectors: [Vec2, Vec2];
  /** Bloch direction of the eigenvector with the larger eigenvalue (null if degenerate) */
  axis: Vec3 | null;
  degenerate: boolean;
}

/**
 * A Hermitian 2×2 matrix is A = a₀I + r(n·σ) with real a₀, r ≥ 0 and unit n.
 * Its eigenvalues are a₀ ± r and the eigenvectors are the Bloch states ±n.
 */
export function eigHermitian(A: Mat2, tol = 1e-12): HermitianEigen {
  const [a0, ax, ay, az] = pauliDecompose(A);
  const v: Vec3 = [ax.re, ay.re, az.re];
  const r = Math.hypot(v[0], v[1], v[2]);
  if (r < tol) {
    return { values: [a0.re, a0.re], vectors: [KET0, KET1], axis: null, degenerate: true };
  }
  const n: Vec3 = [v[0] / r, v[1] / r, v[2] / r];
  const plus = stateAlong(n);
  const minus = stateAlong([-n[0], -n[1], -n[2]]);
  return { values: [a0.re - r, a0.re + r], vectors: [minus, plus], axis: n, degenerate: false };
}

/** The pure state whose Bloch vector is the unit vector n (cos(θ/2), e^{iφ} sin(θ/2)). */
export function stateAlong(n: Vec3): Vec2 {
  const len = Math.hypot(n[0], n[1], n[2]) || 1;
  const z = Math.max(-1, Math.min(1, n[2] / len));
  const theta = Math.acos(z);
  const phi = Math.atan2(n[1], n[0]);
  const s = Math.sin(theta / 2);
  return [c(Math.cos(theta / 2)), c(s * Math.cos(phi), s * Math.sin(phi))];
}

export { IU as IMAG };
