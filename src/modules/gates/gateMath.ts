/**
 * Gate bookkeeping for the gate explorer.
 *
 * Every gate is stored together with a continuous unitary path from I to U:
 *   U(s) = e^{i s α} R_n(s θ),   s ∈ [0, 1],   U(1) = U exactly.
 * For R_x/R_y/R_z/R_n(θ) we use the user's axis and angle (α = 0), so e.g. R_z(2π) really
 * sweeps a full circle and ends at −I. For fixed gates (X, H, …) we use the axis–angle
 * decomposition U = e^{iα} R_n(θ) with θ ∈ [0, π].
 */
import {
  Mat2,
  Vec2,
  Vec3,
  I2,
  Rn,
  Rx,
  Ry,
  Rz,
  axisAngle,
  axisFromAngles,
  gateById,
  matScale,
  matMul,
  expi,
  apply,
  blochVector,
  texAngle,
} from '../../quantum';

export type GateId = 'X' | 'Y' | 'Z' | 'H' | 'S' | 'T' | 'Rx' | 'Ry' | 'Rz' | 'Rn';

export const FIXED_GATES: GateId[] = ['X', 'Y', 'Z', 'H', 'S', 'T'];
export const ROTATION_GATES: GateId[] = ['Rx', 'Ry', 'Rz', 'Rn'];

export interface Step {
  id: GateId;
  /** KaTeX name including parameters, e.g. R_x(\pi/2) */
  tex: string;
  U: Mat2;
  axis: Vec3;
  angle: number;
  /** global phase α in U = e^{iα} R_axis(angle) */
  alpha: number;
  trivial: boolean;
}

export interface GateParams {
  theta: number;
  nTheta: number;
  nPhi: number;
}

export function buildStep(id: GateId, p: GateParams): Step {
  const th = texAngle(p.theta, { inline: true });
  switch (id) {
    case 'Rx':
      return { id, tex: `R_x(${th})`, U: Rx(p.theta), axis: [1, 0, 0], angle: p.theta, alpha: 0, trivial: Math.abs(p.theta) < 1e-9 };
    case 'Ry':
      return { id, tex: `R_y(${th})`, U: Ry(p.theta), axis: [0, 1, 0], angle: p.theta, alpha: 0, trivial: Math.abs(p.theta) < 1e-9 };
    case 'Rz':
      return { id, tex: `R_z(${th})`, U: Rz(p.theta), axis: [0, 0, 1], angle: p.theta, alpha: 0, trivial: Math.abs(p.theta) < 1e-9 };
    case 'Rn': {
      const axis = axisFromAngles(p.nTheta, p.nPhi);
      return { id, tex: `R_{\\vec n}(${th})`, U: Rn(axis, p.theta), axis, angle: p.theta, alpha: 0, trivial: Math.abs(p.theta) < 1e-9 };
    }
    default: {
      const U = gateById(id)!.build();
      const aa = axisAngle(U);
      return { id, tex: id, U, axis: aa.axis, angle: aa.angle, alpha: aa.globalPhase, trivial: aa.trivial };
    }
  }
}

/** U(s) = e^{isα} R_n(sθ) */
export const pathAt = (st: Step, s: number): Mat2 => matScale(Rn(st.axis, s * st.angle), expi(s * st.alpha));

/** States ψ_0, ψ_1 = U_1ψ_0, … and cumulative operators U_k⋯U_1. */
export function runCircuit(psi0: Vec2, steps: Step[]): { states: Vec2[]; cums: Mat2[] } {
  const states: Vec2[] = [psi0];
  const cums: Mat2[] = [I2];
  for (const st of steps) {
    states.push(apply(st.U, states[states.length - 1]));
    cums.push(matMul(st.U, cums[cums.length - 1]));
  }
  return { states, cums };
}

/** Bloch-sphere path of the tip while the gate acts, sampled from the actual unitary path. */
export function tipPath(st: Step, psi: Vec2, upTo = 1, n = 64): Vec3[] {
  const pts: Vec3[] = [];
  const m = Math.max(2, Math.ceil(n * Math.max(0.05, Math.abs(upTo))));
  for (let k = 0; k <= m; k++) pts.push(blochVector(apply(pathAt(st, (upTo * k) / m), psi)));
  return pts;
}

/** Animation duration scales with the rotation angle. */
export const durationFor = (st: Step, speed: number): number =>
  Math.min(2600, (st.trivial ? 300 : 380 + 700 * (Math.abs(st.angle) / Math.PI)) / speed);
