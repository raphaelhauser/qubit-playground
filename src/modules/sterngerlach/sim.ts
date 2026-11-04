/**
 * Stern–Gerlach simulation engine.
 *
 * Every atom carries a genuine spin state |ψ⟩ ∈ C². At each magnet the outcome ±1 is drawn with the
 * Born rule p(±) = |⟨±n|ψ⟩|², and the state collapses to P±|ψ⟩/‖P±|ψ⟩‖ (measure() from the core
 * library). An unpolarized oven emits Haar-random pure states, an exact unravelling of ρ = I/2.
 */
import {
  Mat2,
  Vec2,
  Vec3,
  Outcome,
  SGStage,
  BeamSelection,
  Rng,
  mulberry32,
  measure,
  randomState,
  projector,
  projectDensity,
  matAdd,
  trace,
  pauliDecompose,
  matScaleR,
  densityFromState,
  MAXIMALLY_MIXED,
  blochVector,
  axisFromAngles,
} from '../../quantum';

// ---------------------------------------------------------------------------
// configuration
// ---------------------------------------------------------------------------

export type AxisKind = 'Z' | 'X' | 'Y' | 'tilt' | 'n';

export interface StageCfg {
  kind: AxisKind;
  /** tilt angle from +z toward +x, radians (kind = 'tilt') */
  tilt: number;
  /** spherical angles of n (kind = 'n') */
  theta: number;
  phi: number;
  pass: BeamSelection;
}

export interface SourceCfg {
  kind: 'unpolarized' | 'prepared';
  theta: number;
  phi: number;
}

export const stage = (kind: AxisKind, pass: BeamSelection, tiltDeg = 30): StageCfg => ({
  kind,
  pass,
  tilt: (tiltDeg * Math.PI) / 180,
  theta: Math.PI / 3,
  phi: Math.PI / 4,
});

export function axisOf(s: StageCfg): Vec3 {
  switch (s.kind) {
    case 'Z':
      return [0, 0, 1];
    case 'X':
      return [1, 0, 0];
    case 'Y':
      return [0, 1, 0];
    case 'tilt':
      return [Math.sin(s.tilt), 0, Math.cos(s.tilt)];
    case 'n':
      return axisFromAngles(s.theta, s.phi);
  }
}

/** Outcome labels: KaTeX and plain text for the SVG schematic. */
export function outcomeLabels(s: StageCfg): { plusTex: string; minusTex: string; plus: string; minus: string } {
  switch (s.kind) {
    case 'Z':
      return { plusTex: '\\uparrow', minusTex: '\\downarrow', plus: '↑', minus: '↓' };
    case 'X':
      return { plusTex: '+', minusTex: '-', plus: '+', minus: '−' };
    case 'Y':
      return { plusTex: '{+i}', minusTex: '{-i}', plus: '+i', minus: '−i' };
    default:
      return { plusTex: '+_n', minusTex: '-_n', plus: '+n', minus: '−n' };
  }
}

export function axisName(s: StageCfg): { main: string; sub?: string; tex: string } {
  if (s.kind === 'tilt') {
    const deg = Math.round((s.tilt * 180) / Math.PI);
    return { main: 'n', sub: `${deg}° z→x`, tex: `\\vec n_{${deg}^\\circ}` };
  }
  if (s.kind === 'n') {
    return {
      main: 'n',
      sub: `θ ${Math.round((s.theta * 180) / Math.PI)}° φ ${Math.round((s.phi * 180) / Math.PI)}°`,
      tex: '\\vec n',
    };
  }
  return { main: s.kind, tex: s.kind };
}

export const toCoreStages = (stages: StageCfg[]): SGStage[] => stages.map((s) => ({ axis: axisOf(s), pass: s.pass }));

export function sourceDensity(src: SourceCfg): Mat2 {
  if (src.kind === 'unpolarized') return MAXIMALLY_MIXED;
  return densityFromState(sourceState(src));
}

export function sourceState(src: SourceCfg): Vec2 {
  const t = src.theta;
  const p = src.phi;
  return [
    { re: Math.cos(t / 2), im: 0 },
    { re: Math.sin(t / 2) * Math.cos(p), im: Math.sin(t / 2) * Math.sin(p) },
  ];
}

// ---------------------------------------------------------------------------
// theory: states along the chain (density matrices)
// ---------------------------------------------------------------------------

/** Bloch vector of a (possibly unnormalized) density matrix: r_k = tr(σ_k ρ)/tr ρ. |r| < 1 ⇔ mixed. */
export function blochOfDensity(rho: Mat2): Vec3 {
  const tr = trace(rho).re;
  if (tr < 1e-15) return [0, 0, 0];
  const [, ax, ay, az] = pauliDecompose(rho);
  return [(2 * ax.re) / tr, (2 * ay.re) / tr, (2 * az.re) / tr];
}

export interface StageTheory {
  /** normalized state entering the stage (null if no atom can arrive) */
  rhoIn: Mat2 | null;
  blochIn: Vec3 | null;
  /** fraction of emitted atoms entering */
  enter: number;
  /** P(+ | entered) */
  condPlus: number;
}

export function chainTheory(source: Mat2, stages: SGStage[]): StageTheory[] {
  let rho = source;
  const out: StageTheory[] = [];
  stages.forEach((st, k) => {
    const tr = trace(rho).re;
    const normalized = tr > 1e-15 ? matScaleR(rho, 1 / tr) : null;
    const Pp = projector(st.axis, 1);
    const Pm = projector(st.axis, -1);
    const pp = trace(projectDensity(rho, Pp)).re;
    out.push({
      rhoIn: normalized,
      blochIn: normalized ? blochOfDensity(normalized) : null,
      enter: tr,
      condPlus: tr > 1e-15 ? pp / tr : NaN,
    });
    if (k < stages.length - 1) {
      if (st.pass === 'plus') rho = projectDensity(rho, Pp);
      else if (st.pass === 'minus') rho = projectDensity(rho, Pm);
      else rho = matAdd(projectDensity(rho, Pp), projectDensity(rho, Pm));
    }
  });
  return out;
}

// ---------------------------------------------------------------------------
// geometry of the schematic (SVG viewBox units)
// ---------------------------------------------------------------------------

export const VW = 900;
export const VH = 372;
export const CY = 186;
export const OVEN = { x: 6, y: CY - 32, w: 76, h: 64 };
export const SCREEN = { x: 800, y0: 40, y1: 332, w: 12 };
const REGION = { x0: 108, x1: 770 };
export const BOX = { w: 66, h: 104 };
const SPLIT = 14; // exit offset from the axis at the box edge
const D_MID = 46; // beam separation between stages
const D_FINAL = 108; // spot separation on the screen

export type PathEnd = 'stage' | 'stop' | 'screen';

export interface Path {
  pts: [number, number][];
  cum: number[];
  len: number;
}

export interface BoxGeom {
  xc: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface Layout {
  boxes: BoxGeom[];
  inPath: Path;
  /** out[k][0] = + beam, out[k][1] = − beam */
  out: { path: Path; end: PathEnd; stop: [number, number] | null; labelAt: [number, number] }[][];
  hitY: { plus: number; minus: number };
}

function makePath(pts: [number, number][]): Path {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, len: cum[cum.length - 1] };
}

export function pointAt(p: Path, s: number): [number, number] {
  if (s <= 0) return p.pts[0];
  if (s >= p.len) return p.pts[p.pts.length - 1];
  let lo = 0;
  let hi = p.cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (p.cum[mid] < s) lo = mid;
    else hi = mid;
  }
  const f = (s - p.cum[lo]) / (p.cum[hi] - p.cum[lo] || 1);
  return [p.pts[lo][0] + f * (p.pts[hi][0] - p.pts[lo][0]), p.pts[lo][1] + f * (p.pts[hi][1] - p.pts[lo][1])];
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function computeLayout(stages: StageCfg[]): Layout {
  const n = stages.length;
  const spacing = (REGION.x1 - REGION.x0) / n;
  const boxes: BoxGeom[] = stages.map((_, k) => {
    const xc = REGION.x0 + spacing * (k + 0.5);
    return { xc, x0: xc - BOX.w / 2, x1: xc + BOX.w / 2, y0: CY - BOX.h / 2, y1: CY + BOX.h / 2 };
  });
  const inPath = makePath([
    [OVEN.x + OVEN.w, CY],
    [boxes[0].xc, CY],
  ]);
  const out = stages.map((st, k) => {
    const b = boxes[k];
    const last = k === n - 1;
    return ([1, -1] as const).map((s) => {
      const passes = st.pass === 'both' || (st.pass === 'plus' ? s === 1 : s === -1);
      const head: [number, number][] = [
        [b.xc, CY],
        [b.x1, CY - s * SPLIT],
      ];
      const pts: [number, number][] = [...head];
      let end: PathEnd;
      let stop: [number, number] | null = null;
      let labelAt: [number, number];
      if (last) {
        const g = SCREEN.x - b.x1;
        if (passes) {
          end = 'screen';
          for (let i = 1; i <= 48; i++) {
            const f = i / 48;
            pts.push([b.x1 + f * g, CY - s * (SPLIT + (D_FINAL - SPLIT) * smooth(0, 0.7, f))]);
          }
          labelAt = [b.x1 + Math.min(70, g * 0.35), CY - s * (SPLIT + (D_FINAL - SPLIT) * smooth(0, 0.7, Math.min(70, g * 0.35) / g)) - s * 14];
        } else {
          end = 'stop';
          const gx = Math.min(64, g * 0.3);
          for (let i = 1; i <= 24; i++) {
            const f = (i / 24) * (gx / g);
            pts.push([b.x1 + f * g, CY - s * (SPLIT + (D_FINAL - SPLIT) * smooth(0, 0.7, f))]);
          }
          stop = pts[pts.length - 1];
          labelAt = [stop[0] - 18, stop[1] - s * 16];
        }
      } else {
        const next = boxes[k + 1];
        const g = next.x0 - b.x1;
        if (passes) {
          end = 'stage';
          for (let i = 1; i <= 48; i++) {
            const f = i / 48;
            const y = (SPLIT + (D_MID - SPLIT) * smooth(0, 0.38, f)) * (1 - smooth(0.58, 1, f));
            pts.push([b.x1 + f * g, CY - s * y]);
          }
          pts.push([next.xc, CY]);
          labelAt = [b.x1 + g * 0.3, CY - s * (D_MID + 14)];
        } else {
          end = 'stop';
          const fs = 0.36;
          for (let i = 1; i <= 20; i++) {
            const f = (i / 20) * fs;
            pts.push([b.x1 + f * g, CY - s * (SPLIT + (D_MID - SPLIT) * smooth(0, 0.38, f))]);
          }
          stop = pts[pts.length - 1];
          labelAt = [stop[0] + 2, stop[1] - s * 22];
        }
      }
      return { path: makePath(pts), end, stop, labelAt };
    });
  });
  return { boxes, inPath, out, hitY: { plus: CY - D_FINAL, minus: CY + D_FINAL } };
}

// ---------------------------------------------------------------------------
// engine
// ---------------------------------------------------------------------------

interface Particle {
  psi: Vec2;
  path: Path;
  s: number;
  /** stage index whose box the current path ends in (for 'stage' ends) or came from */
  stage: number;
  end: PathEnd;
  /** last recorded outcome (0 = not yet measured) */
  last: 0 | Outcome;
  jitter: number;
}

export interface Spot {
  x: number;
  y: number;
  plus: boolean;
}

export interface StageEvent {
  pre: Vec3;
  post: Vec3;
  outcome: Outcome;
}

export interface Stats {
  emitted: number;
  entered: number[];
  plus: number[];
  minus: number[];
  blocked: number;
  detPlus: number;
  detMinus: number;
  inFlight: number;
  queued: number;
  last: (StageEvent | null)[];
  version: number;
}

const emptyStats = (n: number): Stats => ({
  emitted: 0,
  entered: Array(n).fill(0),
  plus: Array(n).fill(0),
  minus: Array(n).fill(0),
  blocked: 0,
  detPlus: 0,
  detMinus: 0,
  inFlight: 0,
  queued: 0,
  last: Array(n).fill(null),
  version: 0,
});

export const MAX_SPOTS = 2600;

export class SGEngine {
  stages: StageCfg[] = [];
  axes: Vec3[] = [];
  source: SourceCfg = { kind: 'unpolarized', theta: 0, phi: 0 };
  layout: Layout;
  particles: Particle[] = [];
  spots: Spot[] = [];
  stats: Stats;
  rng: Rng;
  queue = 0;
  burstRate = 0;
  streaming = false;
  speed = 1;
  private emitAcc = 0;
  private streamAcc = 0;

  constructor(stages: StageCfg[], source: SourceCfg, seed = (Math.random() * 2 ** 31) | 0) {
    this.rng = mulberry32(seed);
    this.layout = computeLayout(stages);
    this.stats = emptyStats(stages.length);
    this.configure(stages, source);
  }

  /** Change the apparatus; clears all atoms and statistics (they belong to the old setup). */
  configure(stages: StageCfg[], source: SourceCfg) {
    this.stages = stages;
    this.axes = stages.map(axisOf);
    this.source = source;
    this.layout = computeLayout(stages);
    this.reset();
  }

  reset() {
    this.particles = [];
    this.spots = [];
    this.queue = 0;
    this.emitAcc = 0;
    this.stats = emptyStats(this.stages.length);
  }

  private sample(): Vec2 {
    return this.source.kind === 'unpolarized' ? randomState(this.rng) : sourceState(this.source);
  }

  fire(n: number) {
    this.queue += n;
    this.burstRate = Math.max(24, this.queue / 2.2);
  }

  private emit() {
    this.particles.push({
      psi: this.sample(),
      path: this.layout.inPath,
      s: 0,
      stage: 0,
      end: 'stage',
      last: 0,
      jitter: (this.rng() - 0.5) * 5,
    });
    this.stats.emitted++;
  }

  /** Measurement inside box k. Returns the outcome and the route that follows. */
  private measureAt(k: number, psi: Vec2): { outcome: Outcome; post: Vec2; route: Layout['out'][number][number] } {
    const res = measure(psi, this.axes[k], this.rng);
    this.stats.entered[k]++;
    if (res.outcome === 1) this.stats.plus[k]++;
    else this.stats.minus[k]++;
    this.stats.last[k] = { pre: blochVector(psi), post: blochVector(res.post), outcome: res.outcome };
    const route = this.layout.out[k][res.outcome === 1 ? 0 : 1];
    return { outcome: res.outcome, post: res.post, route };
  }

  private addSpot(plus: boolean) {
    const y0 = plus ? this.layout.hitY.plus : this.layout.hitY.minus;
    // Gaussian beam profile on the screen (Box–Muller)
    const u = Math.max(1e-9, this.rng());
    const v = this.rng();
    const g = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    this.spots.push({ x: SCREEN.x + 2 + this.rng() * (SCREEN.w - 4), y: y0 + g * 7, plus });
    if (this.spots.length > MAX_SPOTS) this.spots.splice(0, this.spots.length - MAX_SPOTS);
  }

  step(dt: number) {
    const v = 320 * this.speed;
    // emission
    if (this.queue > 0) {
      this.emitAcc += this.burstRate * dt * Math.max(0.5, this.speed);
      while (this.emitAcc >= 1 && this.queue > 0) {
        this.emitAcc -= 1;
        this.queue--;
        this.emit();
      }
      if (this.queue === 0) this.emitAcc = 0;
    }
    if (this.streaming) {
      this.streamAcc += 22 * this.speed * dt;
      while (this.streamAcc >= 1) {
        this.streamAcc -= 1;
        this.emit();
      }
    }
    // motion
    const alive: Particle[] = [];
    for (const p of this.particles) {
      p.s += v * dt;
      let keep = true;
      while (p.s >= p.path.len) {
        const over = p.s - p.path.len;
        if (p.end === 'stage') {
          const k = p.stage;
          const { outcome, post, route } = this.measureAt(k, p.psi);
          p.psi = post;
          p.last = outcome;
          p.path = route.path;
          p.end = route.end;
          p.stage = route.end === 'stage' ? k + 1 : k;
          p.s = over;
        } else if (p.end === 'screen') {
          if (p.last === 1) this.stats.detPlus++;
          else this.stats.detMinus++;
          this.addSpot(p.last === 1);
          keep = false;
          break;
        } else {
          this.stats.blocked++;
          keep = false;
          break;
        }
      }
      if (keep) alive.push(p);
    }
    this.particles = alive;
    this.stats.inFlight = alive.length;
    this.stats.queued = this.queue;
  }

  /** Run N atoms through the apparatus without animation (statistics only). */
  fireInstant(N: number) {
    const n = this.stages.length;
    for (let i = 0; i < N; i++) {
      this.stats.emitted++;
      let psi = this.sample();
      for (let k = 0; k < n; k++) {
        const { outcome, post, route } = this.measureAt(k, psi);
        psi = post;
        if (route.end === 'stop') {
          this.stats.blocked++;
          break;
        }
        if (route.end === 'screen') {
          if (outcome === 1) this.stats.detPlus++;
          else this.stats.detMinus++;
          if (this.rng() < 0.25) this.addSpot(outcome === 1);
          break;
        }
      }
    }
  }

  /** Current drawable positions. */
  positions(): { x: number; y: number; last: 0 | Outcome }[] {
    return this.particles.map((p) => {
      const [x, y] = pointAt(p.path, p.s);
      return { x, y: y + p.jitter, last: p.last };
    });
  }

  snapshot(): Stats {
    const s = this.stats;
    return { ...s, entered: [...s.entered], plus: [...s.plus], minus: [...s.minus], last: [...s.last], version: s.version + 1 };
  }
}

// ---------------------------------------------------------------------------
// presets
// ---------------------------------------------------------------------------

export interface Preset {
  id: string;
  label: string;
  stages: StageCfg[];
}

export const PRESETS_SG: Preset[] = [
  { id: 'Z', label: 'Z', stages: [stage('Z', 'both')] },
  { id: 'ZX', label: 'Z → X', stages: [stage('Z', 'plus'), stage('X', 'both')] },
  { id: 'ZXZ', label: 'Z → X → Z', stages: [stage('Z', 'plus'), stage('X', 'plus'), stage('Z', 'both')] },
  { id: 'ZXX', label: 'Z → X → X', stages: [stage('Z', 'plus'), stage('X', 'plus'), stage('X', 'both')] },
  { id: 'ZZ', label: 'Z → Z', stages: [stage('Z', 'plus'), stage('Z', 'both')] },
  { id: 'Z30', label: 'Z → 30°', stages: [stage('Z', 'plus'), stage('tilt', 'both', 30)] },
];

export type { Outcome };
