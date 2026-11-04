/**
 * Observables for the eigenvector explorer: X, Y, Z, H and n·σ.
 * All of them are Hermitian, square to I, and therefore have eigenvalues ±1.
 * Eigenvectors are given in a canonical phase (first non-zero component real ≥ 0)
 * together with exact KaTeX forms.
 */
import {
  Mat2,
  Vec2,
  Vec3,
  c,
  expi,
  scale,
  PX,
  PY,
  PZ,
  H,
  nDotSigma,
  axisFromAngles,
  stateFromAngles,
  texComplex,
  texColumn,
} from '../../quantum';

export type OpId = 'X' | 'Y' | 'Z' | 'H' | 'n';

export interface OpSpec {
  id: OpId;
  /** KaTeX name of the operator */
  tex: string;
  matrix: Mat2;
  /** Bloch direction of the +1 eigenvector */
  axis: Vec3;
  plus: Vec2;
  minus: Vec2;
  /** exact column-vector KaTeX */
  plusCol: string;
  minusCol: string;
  /** ket names */
  plusKet: string;
  minusKet: string;
  /** short outcome labels */
  plusShort: string;
  minusShort: string;
}

const r = Math.SQRT1_2;
const c8 = Math.cos(Math.PI / 8);
const s8 = Math.sin(Math.PI / 8);

export function opSpec(id: OpId, nTheta = Math.PI / 3, nPhi = 0): OpSpec {
  switch (id) {
    case 'X':
      return {
        id,
        tex: 'X',
        matrix: PX,
        axis: [1, 0, 0],
        plus: [c(r), c(r)],
        minus: [c(r), c(-r)],
        plusCol: '\\tfrac{1}{\\sqrt2}\\begin{pmatrix}1\\\\1\\end{pmatrix}',
        minusCol: '\\tfrac{1}{\\sqrt2}\\begin{pmatrix}1\\\\-1\\end{pmatrix}',
        plusKet: '\\ket{+}',
        minusKet: '\\ket{-}',
        plusShort: '+',
        minusShort: '-',
      };
    case 'Y':
      return {
        id,
        tex: 'Y',
        matrix: PY,
        axis: [0, 1, 0],
        plus: [c(r), c(0, r)],
        minus: [c(r), c(0, -r)],
        plusCol: '\\tfrac{1}{\\sqrt2}\\begin{pmatrix}1\\\\i\\end{pmatrix}',
        minusCol: '\\tfrac{1}{\\sqrt2}\\begin{pmatrix}1\\\\-i\\end{pmatrix}',
        plusKet: '\\ket{{+i}}',
        minusKet: '\\ket{{-i}}',
        plusShort: '+i',
        minusShort: '-i',
      };
    case 'Z':
      return {
        id,
        tex: 'Z',
        matrix: PZ,
        axis: [0, 0, 1],
        plus: [c(1), c(0)],
        minus: [c(0), c(1)],
        plusCol: '\\begin{pmatrix}1\\\\0\\end{pmatrix}',
        minusCol: '\\begin{pmatrix}0\\\\1\\end{pmatrix}',
        plusKet: '\\ket{0}',
        minusKet: '\\ket{1}',
        plusShort: '0',
        minusShort: '1',
      };
    case 'H':
      return {
        id,
        tex: 'H',
        matrix: H,
        axis: [r, 0, r],
        plus: [c(c8), c(s8)],
        minus: [c(s8), c(-c8)],
        plusCol: '\\begin{pmatrix}\\cos\\frac{\\pi}{8}\\\\ \\sin\\frac{\\pi}{8}\\end{pmatrix}',
        minusCol: '\\begin{pmatrix}\\sin\\frac{\\pi}{8}\\\\ -\\cos\\frac{\\pi}{8}\\end{pmatrix}',
        plusKet: '\\ket{h_+}',
        minusKet: '\\ket{h_-}',
        plusShort: 'h_+',
        minusShort: 'h_-',
      };
    case 'n': {
      const axis = axisFromAngles(nTheta, nPhi);
      // |+n⟩ = (cos θ/2, e^{iφ} sin θ/2),  |−n⟩ = (sin θ/2, −e^{iφ} cos θ/2)
      const plus = stateFromAngles(nTheta, nPhi);
      const minus: Vec2 = [c(Math.sin(nTheta / 2)), scale(expi(nPhi), -Math.cos(nTheta / 2))];
      return {
        id,
        tex: '\\vec n\\cdot\\vec\\sigma',
        matrix: nDotSigma(axis),
        axis,
        plus,
        minus,
        plusCol: `\\begin{pmatrix}\\cos\\frac{\\theta_n}{2}\\\\ e^{i\\varphi_n}\\sin\\frac{\\theta_n}{2}\\end{pmatrix} = ${texColumn(plus)}`,
        minusCol: `\\begin{pmatrix}\\sin\\frac{\\theta_n}{2}\\\\ -e^{i\\varphi_n}\\cos\\frac{\\theta_n}{2}\\end{pmatrix} = ${texColumn(minus)}`,
        plusKet: '\\ket{{+}_n}',
        minusKet: '\\ket{{-}_n}',
        plusShort: '+n',
        minusShort: '-n',
      };
    }
  }
}

/** KaTeX for "a − λ" given the complex entry a. */
export function texMinusLambda(a: { re: number; im: number }): string {
  const s = texComplex(a);
  return s === '0' ? '-\\lambda' : `${s} - \\lambda`;
}

/** det(A − λI) written out for a 2×2 matrix: the determinant and its expansion. */
export function texCharPoly(A: Mat2): { det: string; product: string } {
  const b = texComplex(A[0][1]);
  const cc = texComplex(A[1][0]);
  const wrap = (s: string) => (/[+\-]/.test(s.slice(1)) || s.startsWith('-') ? `(${s})` : s);
  return {
    det: `\\det\\begin{pmatrix} ${texMinusLambda(A[0][0])} & ${b} \\\\ ${cc} & ${texMinusLambda(A[1][1])} \\end{pmatrix}`,
    product: `(${texMinusLambda(A[0][0])})(${texMinusLambda(A[1][1])}) - ${wrap(b)}\\cdot ${wrap(cc)}`,
  };
}
