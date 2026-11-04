import { describe, it, expect } from 'vitest';
import { predictChain, MAXIMALLY_MIXED } from '../index';
import { SGEngine, PRESETS_SG, chainTheory, toCoreStages, sourceDensity, computeLayout, pointAt, stage, axisOf } from '../../modules/sterngerlach/sim';

const unpol = { kind: 'unpolarized' as const, theta: 0, phi: 0 };
const preset = (id: string) => PRESETS_SG.find((p) => p.id === id)!.stages;
const sigma = (p: number, n: number) => Math.sqrt((p * (1 - p)) / n);

describe('Stern–Gerlach engine', () => {
  it('chainTheory agrees with predictChain and tracks the state', () => {
    for (const p of PRESETS_SG) {
      const core = toCoreStages(p.stages);
      const th = chainTheory(MAXIMALLY_MIXED, core);
      const pr = predictChain(MAXIMALLY_MIXED, core);
      th.forEach((t, k) => {
        expect(t.enter).toBeCloseTo(pr.enter[k], 12);
        if (!Number.isNaN(pr.condPlus[k])) expect(t.condPlus).toBeCloseTo(pr.condPlus[k], 12);
      });
      // unpolarized oven: zero Bloch vector entering the first magnet
      expect(Math.hypot(...th[0].blochIn!)).toBeLessThan(1e-12);
    }
    const zx = chainTheory(MAXIMALLY_MIXED, toCoreStages(preset('ZX')));
    expect(zx[1].blochIn![2]).toBeCloseTo(1, 12); // |↑⟩ enters X
    const zxz = chainTheory(MAXIMALLY_MIXED, toCoreStages(preset('ZXZ')));
    expect(zxz[2].blochIn![0]).toBeCloseTo(1, 12); // |+⟩ enters the last Z
  });

  it('instant simulation reproduces the Born-rule predictions', () => {
    const N = 40000;
    for (const p of PRESETS_SG) {
      const eng = new SGEngine(p.stages, unpol, 1234);
      eng.fireInstant(N);
      const pr = predictChain(sourceDensity(unpol), toCoreStages(p.stages));
      const s = eng.stats;
      expect(s.emitted).toBe(N);
      expect(s.blocked + s.detPlus + s.detMinus).toBe(N);
      expect(Math.abs(s.detPlus / N - pr.finalPlus)).toBeLessThan(5 * sigma(pr.finalPlus, N) + 1e-12);
      expect(Math.abs(s.detMinus / N - pr.finalMinus)).toBeLessThan(5 * sigma(pr.finalMinus, N) + 1e-12);
      const last = p.stages.length - 1;
      const cp = s.plus[last] / s.entered[last];
      expect(Math.abs(cp - pr.condPlus[last])).toBeLessThan(5 * sigma(pr.condPlus[last], s.entered[last]) + 1e-12);
    }
  });

  it('deterministic sequences are exactly deterministic', () => {
    const zz = new SGEngine(preset('ZZ'), unpol, 7);
    zz.fireInstant(5000);
    expect(zz.stats.minus[1]).toBe(0);
    const zxx = new SGEngine(preset('ZXX'), unpol, 8);
    zxx.fireInstant(5000);
    expect(zxx.stats.minus[2]).toBe(0);
    expect(zxx.stats.plus[2]).toBe(zxx.stats.entered[2]);
  });

  it('30° tilt: P(+) = cos²(15°)', () => {
    const pr = predictChain(MAXIMALLY_MIXED, toCoreStages(preset('Z30')));
    expect(pr.condPlus[1]).toBeCloseTo(Math.cos(Math.PI / 12) ** 2, 12);
    expect(axisOf(stage('tilt', 'both', 90))[0]).toBeCloseTo(1, 12);
  });

  it('animated run conserves atoms and lands them on the screen', () => {
    const eng = new SGEngine(preset('ZXZ'), unpol, 99);
    eng.fire(600);
    for (let i = 0; i < 60 * 30 && (eng.queue > 0 || eng.particles.length > 0); i++) eng.step(1 / 60);
    const s = eng.stats;
    expect(eng.particles.length).toBe(0);
    expect(s.emitted).toBe(600);
    expect(s.blocked + s.detPlus + s.detMinus).toBe(600);
    expect(eng.spots.length).toBe(s.detPlus + s.detMinus);
    // every spot lies on the screen near one of the two impact points
    for (const sp of eng.spots) expect(Math.min(Math.abs(sp.y - eng.layout.hitY.plus), Math.abs(sp.y - eng.layout.hitY.minus))).toBeLessThan(60);
  });

  it('prepared source |0⟩ through Z gives only ↑', () => {
    const eng = new SGEngine(preset('Z'), { kind: 'prepared', theta: 0, phi: 0 }, 3);
    eng.fireInstant(2000);
    expect(eng.stats.detMinus).toBe(0);
  });

  it('layout paths connect consecutive magnets', () => {
    const L = computeLayout(preset('ZXZ'));
    const route = L.out[0][0]; // + beam of the first Z magnet passes
    expect(route.end).toBe('stage');
    const end = pointAt(route.path, route.path.len);
    expect(end[0]).toBeCloseTo(L.boxes[1].xc, 9);
    expect(L.out[0][1].end).toBe('stop');
    expect(L.out[2][0].end).toBe('screen');
  });
});
