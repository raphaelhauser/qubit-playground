/** Pure helpers behind Module D's visualizations (unit-tested in src/quantum/__tests__/exponential-module.test.ts). */
import { Mat2, c, mat, ZERO, I2, cexp, matAdd, matScale, matSub, matPow, matProd, dagger, eigHermitian } from '../../quantum';

const FACT: number[] = [1];
export function fact(k: number): number {
  for (let j = FACT.length; j <= k; j++) FACT[j] = FACT[j - 1] * j;
  return FACT[k];
}

/** Truncated Taylor series of cos x and sin x keeping m = 0 … M. */
export function cosSin(x: number, M: number): { cs: number; sn: number } {
  let cs = 0;
  let sn = 0;
  for (let m = 0; m <= M; m++) {
    const sign = m % 2 === 0 ? 1 : -1;
    cs += (sign * x ** (2 * m)) / fact(2 * m);
    sn += (sign * x ** (2 * m + 1)) / fact(2 * m + 1);
  }
  return { cs, sn };
}

/** (I − iH·T/N)^N — N first-order (Euler) steps of the Schrödinger equation. */
export const eulerProduct = (H: Mat2, T: number, N: number): Mat2 => matPow(matAdd(I2, matScale(H, c(0, -T / N))), N);

/** H − iκ|1⟩⟨1| — a non-Hermitian "lossy" Hamiltonian (κ > 0 drains the |1⟩ amplitude). */
export const lossyHamiltonian = (H: Mat2, kappa: number): Mat2 => matSub(H, mat(ZERO, ZERO, ZERO, c(0, kappa)));

/** e^{−iHt} computed in the eigenbasis: V e^{−iΛt} V†. */
export function spectralEvolution(H: Mat2, t: number): { V: Mat2; Lambda: Mat2; expLambda: Mat2; U: Mat2 } {
  const { values, vectors } = eigHermitian(H);
  const [vm, vp] = vectors;
  const V = mat(vm[0], vp[0], vm[1], vp[1]);
  const Lambda = mat(c(values[0]), ZERO, ZERO, c(values[1]));
  const expLambda = mat(cexp(c(0, -values[0] * t)), ZERO, ZERO, cexp(c(0, -values[1] * t)));
  return { V, Lambda, expLambda, U: matProd(V, expLambda, dagger(V)) };
}
