/** Seedable PRNG (mulberry32) so simulations are reproducible in tests. */
import type { Vec3, Vec2 } from './linalg';
import { stateAlong } from './linalg';

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const defaultRng: Rng = Math.random;

/** Uniformly random direction on the unit sphere. */
export function randomUnitVector(rng: Rng = defaultRng): Vec3 {
  const z = 2 * rng() - 1;
  const phi = 2 * Math.PI * rng();
  const s = Math.sqrt(1 - z * z);
  return [s * Math.cos(phi), s * Math.sin(phi), z];
}

/** Haar-random pure state (uniform on the Bloch sphere). An ensemble of these is ρ = I/2. */
export const randomState = (rng: Rng = defaultRng): Vec2 => stateAlong(randomUnitVector(rng));
