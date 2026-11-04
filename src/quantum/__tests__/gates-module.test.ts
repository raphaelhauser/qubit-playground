import { describe, it, expect } from 'vitest';
import { I2, matApproxEq, isUnitary, apply, blochVector, rotate3, mulberry32, randomState, Rz, matScaleR, matMul } from '../index';
import { buildStep, pathAt, runCircuit, tipPath, GateId } from '../../modules/gates/gateMath';

const rng = mulberry32(2024);
const IDS: GateId[] = ['X', 'Y', 'Z', 'H', 'S', 'T', 'Rx', 'Ry', 'Rz', 'Rn'];

describe('gate explorer paths', () => {
  it('U(s) = e^{isα}R_n(sθ) runs from I to exactly U and stays unitary', () => {
    for (let k = 0; k < 20; k++) {
      const params = { theta: 4 * Math.PI * rng() - 2 * Math.PI, nTheta: Math.PI * rng(), nPhi: 2 * Math.PI * rng() };
      for (const id of IDS) {
        const st = buildStep(id, params);
        expect(matApproxEq(pathAt(st, 0), I2, 1e-12)).toBe(true);
        expect(matApproxEq(pathAt(st, 1), st.U, 1e-9)).toBe(true);
        expect(isUnitary(pathAt(st, rng()), 1e-10)).toBe(true);
      }
    }
  });
  it('the animated tip moves on the rotation circle about the gate axis', () => {
    const psi = randomState(rng);
    for (const id of IDS) {
      const st = buildStep(id, { theta: 1.3, nTheta: 0.7, nPhi: 2.1 });
      for (const s of [0.25, 0.5, 0.8]) {
        const got = blochVector(apply(pathAt(st, s), psi));
        const want = rotate3(blochVector(psi), st.axis, s * st.angle);
        for (let i = 0; i < 3; i++) expect(got[i]).toBeCloseTo(want[i], 9);
      }
    }
  });
  it('R_z(2π) sweeps a full circle and equals −I', () => {
    const st = buildStep('Rz', { theta: 2 * Math.PI, nTheta: 0, nPhi: 0 });
    expect(matApproxEq(st.U, matScaleR(I2, -1), 1e-12)).toBe(true);
    const plus = apply(buildStep('H', { theta: 0, nTheta: 0, nPhi: 0 }).U, [{ re: 1, im: 0 }, { re: 0, im: 0 }]);
    const half = blochVector(apply(pathAt(st, 0.5), plus));
    expect(half[0]).toBeCloseTo(-1, 9);
    expect(tipPath(st, plus, 1).length).toBeGreaterThan(10);
  });
  it('circuit bookkeeping: ψ_k = U_k⋯U_1 ψ_0', () => {
    const psi0 = randomState(rng);
    const steps = IDS.map((id) => buildStep(id, { theta: 0.9, nTheta: 1.1, nPhi: 0.3 }));
    const { states, cums } = runCircuit(psi0, steps);
    expect(states.length).toBe(steps.length + 1);
    for (let k = 0; k < states.length; k++) {
      const v = apply(cums[k], psi0);
      expect(Math.hypot(v[0].re - states[k][0].re, v[0].im - states[k][0].im, v[1].re - states[k][1].re, v[1].im - states[k][1].im)).toBeLessThan(1e-12);
    }
    expect(matApproxEq(matMul(Rz(0.9), I2), buildStep('Rz', { theta: 0.9, nTheta: 0, nPhi: 0 }).U)).toBe(true);
  });
});
