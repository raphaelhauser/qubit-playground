import { describe, it, expect } from 'vitest';
import { H, PX, PY, PZ, Rn, Rz, axisAngle, rotate3, matApproxEq, matProd, matMul, dagger, apply, mulberry32, randomState, vecApproxEq } from '../index';
import { OPS, OP_IDS, relation, pauliName, operatorAxis, conjugate, orderDiscrepancy, groupCommutator, xThenY, yThenX, twoStepState, unitaryPath } from '../../modules/pauli/pauliMath';

const rng = mulberry32(77);

describe('Pauli workspace algebra', () => {
  it('commutation relations of the five matrices', () => {
    expect(relation(PX, PY)).toBe('anticommute');
    expect(relation(PY, PZ)).toBe('anticommute');
    expect(relation(PZ, PX)).toBe('anticommute');
    for (const id of OP_IDS) {
      expect(relation(OPS.I, OPS[id])).toBe('commute');
      expect(relation(OPS[id], OPS[id])).toBe('commute');
    }
    expect(relation(H, PX)).toBe('neither');
    expect(relation(H, PY)).toBe('anticommute');
  });
  it('names of Pauli products', () => {
    expect(pauliName(matMul(PX, PY))).toBe('iZ');
    expect(pauliName(matMul(PY, PX))).toBe('-iZ');
    expect(pauliName(matMul(PY, PZ))).toBe('iX');
    expect(pauliName(matMul(PZ, PX))).toBe('iY');
    expect(pauliName(matMul(PX, PX))).toBe('I');
  });
  it('conjugation rotates the operator axis by A’s Bloch rotation', () => {
    for (const a of OP_IDS) {
      for (const b of OP_IDS) {
        const bAx = operatorAxis(OPS[b]);
        if (!bAx) continue;
        const aa = axisAngle(OPS[a]);
        const want = aa.trivial ? bAx : rotate3(bAx, aa.axis, aa.angle);
        const got = operatorAxis(conjugate(OPS[a], OPS[b]))!;
        for (let i = 0; i < 3; i++) expect(got[i]).toBeCloseTo(want[i], 9);
      }
    }
  });
  it('partial conjugation path ends at A B A†', () => {
    for (const a of OP_IDS) expect(matApproxEq(conjugate(unitaryPath(OPS[a], 1), PY), conjugate(OPS[a], PY), 1e-9)).toBe(true);
  });
  it('rotation-order discrepancy is exactly 2√2 sin(α/2) sin(β/2)', () => {
    for (let k = 0; k < 30; k++) {
      const a = 2 * Math.PI * rng();
      const b = 2 * Math.PI * rng();
      expect(orderDiscrepancy(a, b)).toBeCloseTo(Math.abs(2 * Math.SQRT2 * Math.sin(a / 2) * Math.sin(b / 2)), 10);
    }
  });
  it('small rotations: group commutator ≈ R_z(αβ), U1 U2† ≈ R_z(−αβ)', () => {
    const a = 0.02;
    const b = 0.03;
    const gc = axisAngle(groupCommutator(a, b));
    expect(gc.axis[2]).toBeGreaterThan(0.99);
    expect(gc.angle / (a * b)).toBeCloseTo(1, 2);
    const rel = axisAngle(matMul(xThenY(a, b), dagger(yThenX(a, b))));
    expect(rel.axis[2]).toBeLessThan(-0.99);
    expect(rel.angle / (a * b)).toBeCloseTo(1, 2);
  });
  it('two-step path ends at the matrix products (operators act right to left)', () => {
    const psi = randomState(rng);
    expect(vecApproxEq(twoStepState(psi, [1, 0, 0], 0.7, [0, 1, 0], 1.2, 1), apply(xThenY(0.7, 1.2), psi), 1e-12)).toBe(true);
    expect(vecApproxEq(twoStepState(psi, [0, 1, 0], 1.2, [1, 0, 0], 0.7, 1), apply(yThenX(0.7, 1.2), psi), 1e-12)).toBe(true);
  });
  it('H R_n(θ) H = R_{n′}(θ) with n′ the axis of H σ_n H', () => {
    const axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]] as const;
    const P = [PX, PY, PZ];
    for (let k = 0; k < 3; k++) {
      const th = 6 * rng();
      const nPrime = operatorAxis(matProd(H, P[k], H))!;
      expect(matApproxEq(matProd(H, Rn(axes[k], th), H), Rn(nPrime, th), 1e-10)).toBe(true);
    }
    expect(matApproxEq(matProd(H, Rn([1, 0, 0], 1.1), H), Rz(1.1), 1e-12)).toBe(true);
  });
});
