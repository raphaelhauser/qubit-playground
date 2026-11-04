/**
 * Single-qubit gates and rotation operators.
 *
 *   R_n(θ) = exp(−iθ (n·σ)/2) = cos(θ/2) I − i sin(θ/2) (n·σ)
 *
 * R_n(θ) rotates the Bloch vector by +θ about n (right-hand rule). Note the factor 1/2:
 * a 2π rotation gives R_n(2π) = −I, i.e. the identity up to a global phase.
 */
import { c, ZERO, ONE, expi, arg, csqrt, div } from './complex';
import {
  Mat2,
  Vec3,
  I2,
  PX,
  PY,
  PZ,
  mat,
  matR,
  matAdd,
  matScale,
  nDotSigma,
  det,
  pauliDecompose,
  matScaleR,
} from './linalg';

export const X = PX;
export const Y = PY;
export const Z = PZ;
export const H: Mat2 = matScaleR(matR(1, 1, 1, -1), Math.SQRT1_2);
export const S: Mat2 = mat(ONE, ZERO, ZERO, c(0, 1));
export const T: Mat2 = mat(ONE, ZERO, ZERO, expi(Math.PI / 4));
export const ID = I2;

export function Rn(n: Vec3, theta: number): Mat2 {
  const len = Math.hypot(n[0], n[1], n[2]) || 1;
  const u: Vec3 = [n[0] / len, n[1] / len, n[2] / len];
  return matAdd(matScale(I2, c(Math.cos(theta / 2))), matScale(nDotSigma(u), c(0, -Math.sin(theta / 2))));
}

export const Rx = (theta: number): Mat2 => Rn([1, 0, 0], theta);
export const Ry = (theta: number): Mat2 => Rn([0, 1, 0], theta);
export const Rz = (theta: number): Mat2 => Rn([0, 0, 1], theta);

/** Phase gate P(λ) = diag(1, e^{iλ}). */
export const Phase = (lambda: number): Mat2 => mat(ONE, ZERO, ZERO, expi(lambda));

export interface AxisAngle {
  /** unit rotation axis on the Bloch sphere (defaults to z when the rotation is trivial) */
  axis: Vec3;
  /** rotation angle, representative in [0, π] */
  angle: number;
  /** U = e^{iα} R_axis(angle) */
  globalPhase: number;
  /** true when U is (up to phase) the identity */
  trivial: boolean;
}

/**
 * Decompose a unitary as U = e^{iα} R_n(θ) with θ ∈ [0, π].
 * Every single-qubit unitary is, up to global phase, a rotation of the Bloch sphere.
 */
export function axisAngle(U: Mat2): AxisAngle {
  const d = det(U);
  const sq = csqrt(d); // e^{iα} up to sign
  let alpha = arg(sq);
  let V = matScale(U, div(ONE, sq)); // V ∈ SU(2)
  let [v0, vx, vy, vz] = pauliDecompose(V);
  if (v0.re < 0) {
    V = matScaleR(V, -1);
    alpha += Math.PI;
    [v0, vx, vy, vz] = pauliDecompose(V);
  }
  const cosHalf = Math.max(-1, Math.min(1, v0.re));
  // V = cos(θ/2) I − i sin(θ/2) n·σ  ⇒  n_k sin(θ/2) = −Im(v_k)
  const nx = -vx.im;
  const ny = -vy.im;
  const nz = -vz.im;
  const sinHalf = Math.hypot(nx, ny, nz);
  const angle = 2 * Math.atan2(sinHalf, cosHalf);
  alpha = Math.atan2(Math.sin(alpha), Math.cos(alpha));
  if (sinHalf < 1e-12) {
    return { axis: [0, 0, 1], angle: 0, globalPhase: alpha, trivial: true };
  }
  return { axis: [nx / sinHalf, ny / sinHalf, nz / sinHalf], angle, globalPhase: alpha, trivial: false };
}

/** Multiply by a global phase e^{iα}. */
export const withPhase = (U: Mat2, alpha: number): Mat2 => matScale(U, expi(alpha));

export interface GateInfo {
  id: string;
  label: string;
  /** KaTeX name */
  tex: string;
  /** whether the gate takes an angle parameter */
  parametric: boolean;
  build: (theta?: number) => Mat2;
  description: string;
}

export const GATES: GateInfo[] = [
  { id: 'X', label: 'X', tex: 'X', parametric: false, build: () => X, description: 'Bit flip. π rotation about x (up to the phase i).' },
  { id: 'Y', label: 'Y', tex: 'Y', parametric: false, build: () => Y, description: 'Bit and phase flip. π rotation about y.' },
  { id: 'Z', label: 'Z', tex: 'Z', parametric: false, build: () => Z, description: 'Phase flip. π rotation about z.' },
  { id: 'H', label: 'H', tex: 'H', parametric: false, build: () => H, description: 'Hadamard. π rotation about (x+z)/√2; swaps the X and Z axes.' },
  { id: 'S', label: 'S', tex: 'S', parametric: false, build: () => S, description: 'Phase gate diag(1, i). π/2 rotation about z.' },
  { id: 'T', label: 'T', tex: 'T', parametric: false, build: () => T, description: 'diag(1, e^{iπ/4}). π/4 rotation about z.' },
  { id: 'Rx', label: 'Rx(θ)', tex: 'R_x(\\theta)', parametric: true, build: (t = Math.PI / 2) => Rx(t), description: 'Rotation by θ about the x axis.' },
  { id: 'Ry', label: 'Ry(θ)', tex: 'R_y(\\theta)', parametric: true, build: (t = Math.PI / 2) => Ry(t), description: 'Rotation by θ about the y axis.' },
  { id: 'Rz', label: 'Rz(θ)', tex: 'R_z(\\theta)', parametric: true, build: (t = Math.PI / 2) => Rz(t), description: 'Rotation by θ about the z axis.' },
];

export const gateById = (id: string): GateInfo | undefined => GATES.find((g) => g.id === id);

/** Interpolate a gate as a continuous rotation: the state at fraction s ∈ [0,1] is R_n(sθ)|ψ⟩. */
export function partialRotation(U: Mat2, s: number): Mat2 {
  const { axis, angle } = axisAngle(U);
  return Rn(axis, s * angle);
}

