/** Helpers for the Pauli-algebra workspace. All results are computed from the matrices. */
import {
  Mat2,
  Vec2,
  Vec3,
  I2,
  PX,
  PY,
  PZ,
  H,
  matMul,
  matProd,
  matSub,
  matScale,
  dagger,
  commutator,
  anticommutator,
  frobenius,
  pauliDecompose,
  axisAngle,
  Rn,
  Rx,
  Ry,
  expi,
  apply,
  blochVector,
  texPauliSum,
} from '../../quantum';

export type OpId = 'I' | 'X' | 'Y' | 'Z' | 'H';
export const OPS: Record<OpId, Mat2> = { I: I2, X: PX, Y: PY, Z: PZ, H };
export const OP_IDS: OpId[] = ['I', 'X', 'Y', 'Z', 'H'];
export const PAULI_IDS: OpId[] = ['I', 'X', 'Y', 'Z'];

export type Relation = 'commute' | 'anticommute' | 'neither';

export function relation(A: Mat2, B: Mat2, tol = 1e-9): Relation {
  if (frobenius(commutator(A, B)) < tol) return 'commute';
  if (frobenius(anticommutator(A, B)) < tol) return 'anticommute';
  return 'neither';
}

/** Name of a matrix as a Pauli sum, e.g. "2iZ", "-iX", "0". */
export const pauliName = (M: Mat2): string => texPauliSum(pauliDecompose(M));

/** Real axis b of the traceless part of a Hermitian operator B = b₀I + b·σ (null if b = 0). */
export function operatorAxis(B: Mat2): Vec3 | null {
  const [, x, y, z] = pauliDecompose(B);
  const v: Vec3 = [x.re, y.re, z.re];
  const l = Math.hypot(v[0], v[1], v[2]);
  return l < 1e-9 ? null : [v[0] / l, v[1] / l, v[2] / l];
}

/** Continuous path from I to A (A = e^{iα}R_a(θ)): U(s) = e^{isα}R_a(sθ). */
export function unitaryPath(A: Mat2, s: number): Mat2 {
  const aa = axisAngle(A);
  return matScale(Rn(aa.axis, s * aa.angle), expi(s * aa.globalPhase));
}

/** U B U† */
export const conjugate = (U: Mat2, B: Mat2): Mat2 => matProd(U, B, dagger(U));

// ---------------------------------------------------------------------------
// rotation order experiment
// ---------------------------------------------------------------------------

/** "Rx(α) then Ry(β)" is the matrix Ry(β)·Rx(α) — operators act right to left. */
export const xThenY = (a: number, b: number): Mat2 => matMul(Ry(b), Rx(a));
export const yThenX = (a: number, b: number): Mat2 => matMul(Rx(a), Ry(b));

/** ‖Ry(β)Rx(α) − Rx(α)Ry(β)‖_F, exactly 2√2 sin(α/2) sin(β/2). */
export const orderDiscrepancy = (a: number, b: number): number => frobenius(matSub(xThenY(a, b), yThenX(a, b)));

/** Bloch path when first applying a rotation about n1 by a1, then about n2 by a2, up to progress p ∈ [0,1]. */
export function twoStepPath(psi: Vec2, n1: Vec3, a1: number, n2: Vec3, a2: number, p: number, samples = 48): Vec3[] {
  const pts: Vec3[] = [];
  const p1 = Math.min(1, 2 * p);
  const m1 = Math.max(2, Math.ceil(samples * p1));
  for (let k = 0; k <= m1; k++) pts.push(blochVector(apply(Rn(n1, (a1 * p1 * k) / m1), psi)));
  if (p > 0.5) {
    const mid = apply(Rn(n1, a1), psi);
    const p2 = Math.min(1, 2 * p - 1);
    const m2 = Math.max(2, Math.ceil(samples * p2));
    for (let k = 0; k <= m2; k++) pts.push(blochVector(apply(Rn(n2, (a2 * p2 * k) / m2), mid)));
  }
  return pts;
}

export function twoStepState(psi: Vec2, n1: Vec3, a1: number, n2: Vec3, a2: number, p: number): Vec2 {
  if (p <= 0.5) return apply(Rn(n1, a1 * Math.min(1, 2 * p)), psi);
  return apply(Rn(n2, a2 * Math.min(1, 2 * p - 1)), apply(Rn(n1, a1), psi));
}

/** Group commutator Rx(α)Ry(β)Rx(−α)Ry(−β) ≈ Rz(αβ) for small angles. */
export const groupCommutator = (a: number, b: number): Mat2 => matProd(Rx(a), Ry(b), Rx(-a), Ry(-b));
