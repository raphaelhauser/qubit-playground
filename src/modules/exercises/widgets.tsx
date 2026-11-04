/**
 * Small, self-contained interactive visualizations used by the guided exercises and the
 * concept challenges. Everything shown is computed from src/quantum.
 */
import { ReactNode, useMemo, useRef, useState } from 'react';
import { BlochCanvas, StateArrow, AxisLine, Trail, OrbitCircle, PointMarker, RotationArc, ProjectionOnAxis, DragHandle, Arrow } from '../../components/bloch';
import { ComplexPlane } from '../../components/ComplexPlane';
import { LinePlot, ProbabilityBars, Histogram } from '../../components/charts';
import { Tex } from '../../components/Tex';
import { Card, Slider, Segmented, Button, KV, Label, Toggle, Swatch, Icon } from '../../components/ui';
import { PlaybackBar } from '../../components/Playback';
import { useRaf } from '../../hooks/animation';
import { COLORS } from '../../theme';
import {
  Vec2,
  Vec3,
  Mat2,
  c,
  conj,
  mul,
  abs2,
  I2,
  PX,
  PY,
  PZ,
  KET0,
  apply,
  matAdd,
  matMul,
  matSub,
  matScale,
  matProd,
  dagger,
  expm,
  expmSeries,
  frobenius,
  matApproxEq,
  commutator,
  anticommutator,
  pauliDecompose,
  nDotSigma,
  stateFromAngles,
  blochVector,
  anglesFromBloch,
  fromOmegas,
  hamiltonianMatrix,
  hamiltonianAxis,
  evolveState,
  transitionProbability,
  oscillation,
  HamiltonianParams,
  H as HAD,
  Rx,
  Ry,
  Rz,
  Rn,
  axisAngle,
  partialRotation,
  rotate3,
  axisFromAngles,
  eigenbasis,
  probabilities,
  measure,
  predictChain,
  MAXIMALLY_MIXED,
  SGStage,
  randomState,
  randomUnitVector,
  mulberry32,
  fidelity,
  texMatrix,
  texKet,
  texColumn,
  texPauliSum,
  texAngle,
  fmt,
  fmtAngle,
  relativePhase,
} from '../../quantum';

const PI = Math.PI;

// ---------------------------------------------------------------------------
// frame
// ---------------------------------------------------------------------------

export function VizCard({ title, kicker = 'interactive', children, right }: { title: ReactNode; kicker?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <Card title={title} kicker={kicker} right={right} bodyClassName="space-y-3">
      {children}
    </Card>
  );
}

export function Frame({ height = 320, children }: { height?: number; children: ReactNode }) {
  return (
    <div className="bg-grid relative overflow-hidden rounded-xl border border-ink-700/80" style={{ height }}>
      {children}
    </div>
  );
}

function Overlay({ children, pos = 'tl' }: { children: ReactNode; pos?: 'tl' | 'tr' | 'bl' | 'br' }) {
  const p = { tl: 'left-2.5 top-2.5', tr: 'right-2.5 top-2.5', bl: 'left-2.5 bottom-2.5', br: 'right-2.5 bottom-9' }[pos];
  return <div className={`pointer-events-none absolute ${p} rounded-lg bg-ink-900/75 px-2.5 py-1.5 text-[12px] text-ink-200 ring-1 ring-ink-700 backdrop-blur`}>{children}</div>;
}

/** ⟨ψ|σ|ψ⟩ without normalizing: its length is ‖ψ‖², so non-unitary evolution visibly leaves the sphere. */
function rawBloch(psi: Vec2): Vec3 {
  const [a, b] = psi;
  const ab = mul(conj(a), b);
  return [2 * ab.re, 2 * ab.im, abs2(a) - abs2(b)];
}

function useClock(tMax: number, speed = 1, loop = true) {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  useRaf((dt) => {
    setT((x) => {
      const n = x + dt * speed;
      if (n > tMax) {
        if (!loop) setPlaying(false);
        return loop ? 0 : tMax;
      }
      return n;
    });
  }, playing);
  return { t, setT, playing, setPlaying };
}

// ---------------------------------------------------------------------------
// unitarity
// ---------------------------------------------------------------------------

export function UnitarityViz() {
  const [eps, setEps] = useState(0.5);
  const [dw, setDw] = useState(0.3);
  const [kappa, setKappa] = useState(0);
  const TMAX = 8;
  const { t, setT, playing, setPlaying } = useClock(TMAX, 0.8);
  const Hm = useMemo(() => matAdd(hamiltonianMatrix({ omegaBar: 0, deltaOmega: dw, epsilon: eps }), matScale(PZ, c(0, -kappa))), [eps, dw, kappa]);
  const psi0 = useMemo(() => stateFromAngles(PI / 2, 0), []);
  const U = useMemo(() => expm(matScale(Hm, c(0, -t))), [Hm, t]);
  const psi = apply(U, psi0);
  const r = rawBloch(psi);
  const len = Math.hypot(...r);
  const shown: Vec3 = len > 1.7 ? (r.map((x) => (x * 1.7) / len) as unknown as Vec3) : r;
  const UdU = matMul(dagger(U), U);
  const unitary = matApproxEq(UdU, I2, 1e-9);
  const curve = useMemo(() => {
    const pts: [number, number][] = [];
    for (let k = 0; k <= 160; k++) {
      const tt = (TMAX * k) / 160;
      const v = apply(expm(matScale(Hm, c(0, -tt))), psi0);
      pts.push([tt, Math.min(3, abs2(v[0]) + abs2(v[1]))]);
    }
    return pts;
  }, [Hm, psi0]);
  const trail = useMemo(() => {
    const pts: Vec3[] = [];
    for (let k = 0; k <= 80; k++) {
      const v = rawBloch(apply(expm(matScale(Hm, c(0, -(t * k) / 80))), psi0));
      const l = Math.hypot(...v);
      pts.push(l > 1.7 ? (v.map((x) => (x * 1.7) / l) as unknown as Vec3) : v);
    }
    return pts;
  }, [Hm, psi0, t]);
  return (
    <VizCard title="Does the evolution preserve probability?">
      <Frame>
        <BlochCanvas labels="kets">
          <Trail points={trail} />
          <StateArrow v={shown} color={unitary ? COLORS.state : COLORS.p1} />
        </BlochCanvas>
        <Overlay>
          <Tex>{`\\|\\psi(t)\\|^2 = ${fmt(len, 3)}`}</Tex>
          <span className={`ml-2 ${unitary ? 'text-good' : 'text-p1'}`}>{unitary ? 'stays on the sphere' : 'leaves the sphere'}</span>
        </Overlay>
      </Frame>
      <LinePlot
        series={[{ points: curve, color: unitary ? COLORS.state : COLORS.p1, label: '\\|e^{-iHt}\\psi_0\\|^2' }]}
        xMin={0}
        xMax={TMAX}
        yMin={0}
        yMax={2}
        height={120}
        cursorX={t}
        onScrub={(x) => {
          setPlaying(false);
          setT(x);
        }}
        hlines={[{ y: 1, color: COLORS.good }]}
        yTicks={[0, 1, 2].map((v) => ({ value: v, label: String(v) }))}
        xLabel="t"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Slider tex="\varepsilon" value={eps} min={-1} max={1} onChange={setEps} format={(v) => fmt(v, 2)} />
        <Slider tex="\Delta\omega" value={dw} min={-1} max={1} onChange={setDw} format={(v) => fmt(v, 2)} />
        <Slider tex="\kappa" label="non-Hermitian part −iκZ" value={kappa} min={-0.25} max={0.25} onChange={setKappa} format={(v) => fmt(v, 2)} color={COLORS.p1} marks={[{ value: 0, tex: '\\kappa = 0' }]} />
        <Slider tex="t" value={t} min={0} max={TMAX} onChange={(v) => { setPlaying(false); setT(v); }} format={(v) => fmt(v, 2)} />
      </div>
      <PlaybackBar playing={playing} onToggle={() => setPlaying(!playing)} onReset={() => { setPlaying(false); setT(0); }} />
      <div className="rounded-lg bg-ink-800/70 p-2.5 text-[12.5px]">
        <Tex display>{`H = ${texMatrix(Hm, { digits: 2 })},\\quad U_t^\\dagger U_t = ${texMatrix(UdU, { digits: 3 })}`}</Tex>
        <p className="text-ink-400">
          With <Tex>{'\\kappa = 0'}</Tex> the matrix <Tex>{'H'}</Tex> is Hermitian and <Tex>{'U_t^\\dagger U_t = I'}</Tex> at every time. Turn on <Tex>{'\\kappa'}</Tex> to see what a
          non-Hermitian generator would do: the norm — total probability — drifts.
        </p>
      </div>
    </VizCard>
  );
}

// ---------------------------------------------------------------------------
// diagonal Hamiltonian
// ---------------------------------------------------------------------------

export function DiagonalViz() {
  const [w1, setW1] = useState(1);
  const [w2, setW2] = useState(-0.5);
  const [init, setInit] = useState<'0' | '+'>('+');
  const TMAX = 4 * PI;
  const { t, setT, playing, setPlaying } = useClock(TMAX, 0.8);
  const p = fromOmegas(w1, w2, 0);
  const psi0: Vec2 = init === '0' ? KET0 : [c(Math.SQRT1_2), c(Math.SQRT1_2)];
  const psi = evolveState(p, psi0, t);
  const r = blochVector(psi);
  const trail = useMemo(() => {
    const pts: Vec3[] = [];
    for (let k = 0; k <= 120; k++) pts.push(blochVector(evolveState(p, psi0, (t * k) / 120)));
    return pts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w1, w2, init, t]);
  const rel = relativePhase(psi);
  return (
    <VizCard title="Diagonal Hamiltonian: phases only">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_200px]">
        <Frame>
          <BlochCanvas labels="kets">
            <AxisLine n={[0, 0, 1]} color={COLORS.axis} dashed opacity={0.7} />
            <Trail points={trail} />
            <StateArrow v={r} />
          </BlochCanvas>
          <Overlay>
            <Tex>{`\\ket{\\psi(t)} = ${texKet(psi, { digits: 2, exact: false })}`}</Tex>
          </Overlay>
        </Frame>
        <div className="space-y-2">
          <Label>amplitudes</Label>
          <ComplexPlane
            amplitudes={[
              { z: psi[0], color: COLORS.p0, label: '\\alpha' },
              { z: psi[1], color: COLORS.p1, label: '\\beta' },
            ]}
          />
          <KV k="global phase of α" v={fmtAngle(((-w1 * t) % (2 * PI) + 2 * PI) % (2 * PI))} />
          {init === '+' && <KV k="relative phase φ" v={<span className="text-phase">{fmtAngle(rel)}</span>} />}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Slider tex="\omega_1" value={w1} min={-2} max={2} onChange={setW1} format={(v) => fmt(v, 2)} />
        <Slider tex="\omega_2" value={w2} min={-2} max={2} onChange={setW2} format={(v) => fmt(v, 2)} />
        <Slider tex="t" value={t} min={0} max={TMAX} onChange={(v) => { setPlaying(false); setT(v); }} format={(v) => fmt(v, 2)} />
        <div>
          <Label className="mb-1">initial state</Label>
          <Segmented value={init} onChange={(v) => { setInit(v); setT(0); }} options={[{ value: '0', label: '', tex: '\\ket0' }, { value: '+', label: '', tex: '\\ket{+}' }]} />
        </div>
      </div>
      <PlaybackBar playing={playing} onToggle={() => setPlaying(!playing)} onReset={() => { setPlaying(false); setT(0); }} />
      <p className="text-[12.5px] text-ink-400">
        Both amplitudes only rotate in the complex plane (at rates <Tex>{'\\omega_1'}</Tex> and <Tex>{'\\omega_2'}</Tex>). For <Tex>{'\\ket0'}</Tex> that is a pure global phase — the arrow never moves. For{' '}
        <Tex>{'\\ket+'}</Tex> the <em>difference</em> of the rates turns the relative phase, and the arrow precesses about z with angular frequency <Tex>{'\\omega_1-\\omega_2'}</Tex>.
      </p>
    </VizCard>
  );
}

// ---------------------------------------------------------------------------
// Hamiltonian with perturbation (also used by the concept challenges)
// ---------------------------------------------------------------------------

export function PerturbationViz({
  mode = 'omegas',
  initial = { omegaBar: 0.8, deltaOmega: 0.4, epsilon: 0.3 },
  title = 'Perturbed Hamiltonian: rotation about a tilted axis',
  note,
  compareShift,
}: {
  mode?: 'omegas' | 'pauli';
  initial?: HamiltonianParams;
  title?: string;
  note?: ReactNode;
  /** draw a second evolution with ω̄ shifted by this amount (same Pauli part) */
  compareShift?: number;
}) {
  const [p, setP] = useState<HamiltonianParams>(initial);
  const TMAX = 4 * PI;
  const { t, setT, playing, setPlaying } = useClock(TMAX, 0.9);
  const { r, v } = hamiltonianAxis(p);
  const o = oscillation(p);
  const psi = evolveState(p, KET0, t);
  const b = blochVector(psi);
  const w = { omega1: p.omegaBar + p.deltaOmega, omega2: p.omegaBar - p.deltaOmega };
  const Hm = hamiltonianMatrix(p);
  const trail = useMemo(() => {
    const pts: Vec3[] = [];
    for (let k = 0; k <= 140; k++) pts.push(blochVector(evolveState(p, KET0, (t * k) / 140)));
    return pts;
  }, [p, t]);
  // numerical (matrix exponential of −iHt) vs. closed-form P(1,t)
  const curves = useMemo(() => {
    const num: [number, number][] = [];
    const ana: [number, number][] = [];
    for (let k = 0; k <= 240; k++) {
      const tt = (TMAX * k) / 240;
      const s = apply(expm(matScale(Hm, c(0, -tt))), KET0);
      num.push([tt, abs2(s[1])]);
      ana.push([tt, transitionProbability(p, tt)]);
    }
    return { num, ana };
  }, [Hm, p]);
  const shifted = compareShift ? evolveState({ ...p, omegaBar: p.omegaBar + compareShift }, KET0, t) : null;
  const set = (patch: Partial<HamiltonianParams>) => setP((q) => ({ ...q, ...patch }));
  return (
    <VizCard title={title}>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_200px]">
        <Frame>
          <BlochCanvas labels="kets">
            {v && <AxisLine n={v} color={COLORS.axis} label="\vec v" />}
            {v && <OrbitCircle n={v} through={[0, 0, 1]} />}
            <PointMarker v={[0, 0, 1]} color={COLORS.faint} size={0.03} />
            <Trail points={trail} />
            {shifted && <StateArrow v={blochVector(shifted)} color={COLORS.phase} opacity={0.55} />}
            <StateArrow v={b} />
          </BlochCanvas>
          <Overlay>
            <Tex>{`P(1,t) = ${fmt(abs2(psi[1]), 3)}`}</Tex>
          </Overlay>
          {!v && (
            <Overlay pos="bl">
              <span className="text-phase">r = 0: H ∝ I — no rotation axis, only a global phase</span>
            </Overlay>
          )}
        </Frame>
        <div className="space-y-2">
          <Label>amplitudes (with global phase)</Label>
          <ComplexPlane
            amplitudes={[
              { z: psi[0], color: COLORS.p0, label: '\\alpha' },
              { z: psi[1], color: COLORS.p1, label: '\\beta' },
            ]}
            ghosts={shifted ? [{ z: shifted[0], color: COLORS.phase, label: '' }, { z: shifted[1], color: COLORS.phase, label: '' }] : []}
          />
          <div className="space-y-0.5">
            <KV k={<Tex>{'\\bar\\omega'}</Tex>} v={fmt(p.omegaBar, 3)} />
            <KV k={<Tex>{'\\Delta\\omega'}</Tex>} v={fmt(p.deltaOmega, 3)} />
            <KV k={<Tex>{'r'}</Tex>} v={fmt(r, 3)} />
            <KV k={<Tex>{'\\vec v'}</Tex>} v={v ? `(${fmt(v[0], 2)}, 0, ${fmt(v[2], 2)})` : 'undefined'} />
            <KV k={<Tex>{'P_{\\max} = \\varepsilon^2/r^2'}</Tex>} v={fmt(o.maxTransition, 3)} />
            <KV k={<Tex>{'\\text{period } \\pi/r'}</Tex>} v={Number.isFinite(o.period) ? fmt(o.period, 3) : '∞'} />
          </div>
        </div>
      </div>
      <LinePlot
        series={[
          { points: curves.num, color: COLORS.p1, label: '|\\langle 1|e^{-iHt}|0\\rangle|^2 \\text{ (numerical)}' },
          { points: curves.ana, color: COLORS.text, dashed: true, width: 1.3, label: '\\tfrac{\\varepsilon^2}{r^2}\\sin^2(rt)' },
        ]}
        xMin={0}
        xMax={TMAX}
        height={130}
        cursorX={t}
        onScrub={(x) => {
          setPlaying(false);
          setT(x);
        }}
        hlines={o.maxTransition > 0.01 ? [{ y: o.maxTransition, color: COLORS.axis, label: 'ε²/r²' }] : []}
        xTicks={[PI, 2 * PI, 3 * PI].map((x) => ({ value: x, label: fmtAngle(x) }))}
        xLabel="t"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {mode === 'omegas' ? (
          <>
            <Slider tex="\omega_1" value={w.omega1} min={-2} max={2} onChange={(x) => set({ omegaBar: (x + w.omega2) / 2, deltaOmega: (x - w.omega2) / 2 })} format={(x) => fmt(x, 2)} />
            <Slider tex="\omega_2" value={w.omega2} min={-2} max={2} onChange={(x) => set({ omegaBar: (w.omega1 + x) / 2, deltaOmega: (w.omega1 - x) / 2 })} format={(x) => fmt(x, 2)} />
          </>
        ) : (
          <>
            <Slider tex="\bar\omega" label="identity part" value={p.omegaBar} min={-3} max={3} onChange={(x) => set({ omegaBar: x })} format={(x) => fmt(x, 2)} />
            <Slider tex="\Delta\omega" value={p.deltaOmega} min={-2} max={2} onChange={(x) => set({ deltaOmega: x })} format={(x) => fmt(x, 2)} />
          </>
        )}
        <Slider tex="\varepsilon" value={p.epsilon} min={-1.5} max={1.5} onChange={(x) => set({ epsilon: x })} format={(x) => fmt(x, 2)} />
        <Slider tex="t" value={t} min={0} max={TMAX} onChange={(x) => { setPlaying(false); setT(x); }} format={(x) => fmt(x, 2)} />
      </div>
      <PlaybackBar playing={playing} onToggle={() => setPlaying(!playing)} onReset={() => { setPlaying(false); setT(0); }} />
      {note && <div className="text-[12.5px] text-ink-400">{note}</div>}
    </VizCard>
  );
}

// ---------------------------------------------------------------------------
// Pauli products
// ---------------------------------------------------------------------------

type PName = 'I' | 'X' | 'Y' | 'Z';
const PMAT: Record<PName, Mat2> = { I: I2, X: PX, Y: PY, Z: PZ };
const PAXIS: Record<PName, Vec3 | null> = { I: null, X: [1, 0, 0], Y: [0, 1, 0], Z: [0, 0, 1] };
const name = (M: Mat2) => texPauliSum(pauliDecompose(M));

export function PauliProductViz({ initial = ['X', 'Y'] as [PName, PName] }: { initial?: [PName, PName] }) {
  const [A, setA] = useState<PName>(initial[0]);
  const [B, setB] = useState<PName>(initial[1]);
  const MA = PMAT[A];
  const MB = PMAT[B];
  const AB = matMul(MA, MB);
  const BA = matMul(MB, MA);
  const anti = anticommutator(MA, MB);
  const comm = commutator(MA, MB);
  const a = PAXIS[A];
  const bb = PAXIS[B];
  const cross: Vec3 | null = a && bb ? [a[1] * bb[2] - a[2] * bb[1], a[2] * bb[0] - a[0] * bb[2], a[0] * bb[1] - a[1] * bb[0]] : null;
  const opts = (['I', 'X', 'Y', 'Z'] as PName[]).map((p) => ({ value: p, label: p, tex: p }));
  const cell = (M: Mat2, label: string, zeroGood = false) => {
    const n = name(M);
    return (
      <div className={`rounded-lg p-2 ring-1 ring-inset ${zeroGood && n === '0' ? 'bg-good/[0.07] ring-good/30' : 'bg-ink-800/70 ring-ink-700'}`}>
        <div className="text-[11px] text-ink-400">
          <Tex>{label}</Tex>
        </div>
        <Tex display>{`${texMatrix(M)} = ${n}`}</Tex>
      </div>
    );
  };
  return (
    <VizCard title="Pauli products, commutators and anticommutators">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[13px] text-ink-300">
          <Tex>{'A ='}</Tex>
        </span>
        <Segmented value={A} onChange={setA} options={opts} />
        <span className="text-[13px] text-ink-300">
          <Tex>{'B ='}</Tex>
        </span>
        <Segmented value={B} onChange={setB} options={opts} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {cell(AB, `AB = ${A}${B}`)}
        {cell(BA, `BA = ${B}${A}`)}
        {cell(anti, `\\{A,B\\} = AB + BA`, true)}
        {cell(comm, `[A,B] = AB - BA`, true)}
      </div>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Frame height={250}>
          <BlochCanvas labels="xyz" zoom={1.1}>
            {a && <AxisLine n={a} color={COLORS.axis} label={A} />}
            {bb && <AxisLine n={bb} color={COLORS.phase} label={B} />}
            {cross && Math.hypot(...cross) > 0.5 && <Arrow v={cross} color={COLORS.good} label="\vec a\times\vec b" />}
          </BlochCanvas>
        </Frame>
        <div>
          <Label className="mb-1.5">multiplication table (row × column) — click a cell</Label>
          <table className="w-full text-center text-[13px]">
            <thead>
              <tr>
                <th />
                {(['X', 'Y', 'Z'] as PName[]).map((q) => (
                  <th key={q} className="pb-1 font-normal text-ink-400">
                    <Tex>{q}</Tex>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(['X', 'Y', 'Z'] as PName[]).map((rw) => (
                <tr key={rw}>
                  <td className="pr-2 text-ink-400">
                    <Tex>{rw}</Tex>
                  </td>
                  {(['X', 'Y', 'Z'] as PName[]).map((cl) => {
                    const on = rw === A && cl === B;
                    return (
                      <td key={cl} className="p-0.5">
                        <button
                          onClick={() => {
                            setA(rw);
                            setB(cl);
                          }}
                          className={`w-full rounded-md py-1.5 ring-1 ring-inset ${on ? 'bg-ink-600 ring-state/50' : 'bg-ink-800/70 ring-ink-700 hover:bg-ink-750'}`}
                        >
                          <Tex>{name(matMul(PMAT[rw], PMAT[cl]))}</Tex>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-400">
            For distinct Paulis the product is <Tex>{'i'}</Tex> times the third one, with axis along <Tex>{'\\vec a\\times\\vec b'}</Tex> (green):{' '}
            <Tex>{'(\\vec a\\cdot\\vec\\sigma)(\\vec b\\cdot\\vec\\sigma) = (\\vec a\\cdot\\vec b)I + i(\\vec a\\times\\vec b)\\cdot\\vec\\sigma'}</Tex>. Swapping the order flips the cross product, hence the sign.
          </p>
        </div>
      </div>
    </VizCard>
  );
}

// ---------------------------------------------------------------------------
// rotation order and the commutator
// ---------------------------------------------------------------------------

export function CommutatorViz() {
  const [alpha, setAlpha] = useState(0.8);
  const [s0, setS0] = useState<Vec3>(() => blochVector(stateFromAngles(1.15, 0.55)));
  const psi0 = useMemo(() => {
    const a = anglesFromBloch(s0);
    return stateFromAngles(a.theta, a.phi);
  }, [s0]);
  const U1 = matMul(Ry(alpha), Rx(alpha)); // x first, then y
  const U2 = matMul(Rx(alpha), Ry(alpha)); // y first, then x
  const mid1 = blochVector(apply(Rx(alpha), psi0));
  const mid2 = blochVector(apply(Ry(alpha), psi0));
  const end1 = blochVector(apply(U1, psi0));
  const end2 = blochVector(apply(U2, psi0));
  const rel = axisAngle(matMul(dagger(U2), U1));
  const curve = useMemo(() => {
    const pts: [number, number][] = [];
    const sq: [number, number][] = [];
    for (let k = 0; k <= 60; k++) {
      const a = (PI / 2) * (k / 60);
      pts.push([a, axisAngle(matMul(dagger(matMul(Rx(a), Ry(a))), matMul(Ry(a), Rx(a)))).angle]);
      sq.push([a, a * a]);
    }
    return { pts, sq };
  }, []);
  return (
    <VizCard title="Order matters: x then y vs. y then x">
      <Frame height={300}>
        <BlochCanvas labels="both">
          <StateArrow v={s0} color={COLORS.faint} />
          <DragHandle v={s0} onChange={setS0} color={COLORS.muted} />
          <RotationArc n={[1, 0, 0]} from={s0} angle={alpha} color={COLORS.p0} lineWidth={1.6} />
          <RotationArc n={[0, 1, 0]} from={mid1} angle={alpha} color={COLORS.p0} lineWidth={1.6} />
          <RotationArc n={[0, 1, 0]} from={s0} angle={alpha} color={COLORS.p1} lineWidth={1.6} />
          <RotationArc n={[1, 0, 0]} from={mid2} angle={alpha} color={COLORS.p1} lineWidth={1.6} />
          <StateArrow v={end1} color={COLORS.p0} />
          <StateArrow v={end2} color={COLORS.p1} />
          {!rel.trivial && <AxisLine n={rel.axis} color={COLORS.axis} dashed opacity={0.8} length={1.3} />}
        </BlochCanvas>
        <Overlay>
          <div className="flex flex-col gap-0.5">
            <Swatch color={COLORS.p0}>
              <Tex>{'R_y(\\alpha)R_x(\\alpha)\\ket\\psi'}</Tex> (x first)
            </Swatch>
            <Swatch color={COLORS.p1}>
              <Tex>{'R_x(\\alpha)R_y(\\alpha)\\ket\\psi'}</Tex> (y first)
            </Swatch>
          </div>
        </Overlay>
      </Frame>
      <Slider tex="\alpha" label="rotation angle (both)" value={alpha} min={0} max={PI / 2} onChange={setAlpha} format={(v) => texAngle(v, { inline: true })} />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-0.5 text-[12.5px]">
          <KV k="relative rotation angle" v={fmt(rel.angle, 4)} />
          <KV k={<Tex>{'\\alpha^2'}</Tex>} v={fmt(alpha * alpha, 4)} />
          <KV k="relative rotation axis" v={`(${rel.axis.map((x) => fmt(x, 2)).join(', ')})`} />
          <p className="pt-1 text-[12px] leading-relaxed text-ink-400">
            The two orders differ by a small rotation of angle ≈ <Tex>{'\\alpha^2'}</Tex> about the z axis (violet, dashed) — generated by the commutator{' '}
            <Tex>{'[X,Y] = 2iZ'}</Tex>. Drag the grey starting state to see that this does not depend on it.
          </p>
        </div>
        <LinePlot
          series={[
            { points: curve.pts, color: COLORS.axis, label: '\\text{angle of } R_2^\\dagger R_1' },
            { points: curve.sq, color: COLORS.text, dashed: true, width: 1.2, label: '\\alpha^2' },
          ]}
          xMin={0}
          xMax={PI / 2}
          yMin={0}
          yMax={2.5}
          height={140}
          cursorX={alpha}
          onScrub={setAlpha}
          yTicks={[0, 1, 2].map((v) => ({ value: v, label: String(v) }))}
          xLabel="α"
        />
      </div>
    </VizCard>
  );
}

// ---------------------------------------------------------------------------
// e^{U†AU} = U† e^A U, term by term
// ---------------------------------------------------------------------------

type APreset = 'iZ' | 'X' | 'gen';
type UPreset = 'H' | 'Ry' | 'rand';

export function SeriesConjugationViz() {
  const [ap, setAp] = useState<APreset>('iZ');
  const [up, setUp] = useState<UPreset>('H');
  const [theta, setTheta] = useState(1.2);
  const [N, setN] = useState(4);
  const [seed, setSeed] = useState(3);
  const A: Mat2 = useMemo(() => {
    if (ap === 'iZ') return matScale(PZ, c(0, theta));
    if (ap === 'X') return matScale(PX, c(0, -theta / 2));
    return matScale(matAdd(matScale(PX, c(0.4, -0.3)), matAdd(matScale(PZ, c(0.6)), matScale(I2, c(0.1, 0.2)))), c(theta));
  }, [ap, theta]);
  const U: Mat2 = useMemo(() => {
    if (up === 'H') return HAD;
    if (up === 'Ry') return Ry(PI / 3);
    const rng = mulberry32(seed);
    return Rn(randomUnitVector(rng), 2 * PI * rng());
  }, [up, seed]);
  const B = matProd(dagger(U), A, U);
  const seriesB = useMemo(() => expmSeries(B, 22), [B]);
  const seriesA = useMemo(() => expmSeries(A, 22), [A]);
  const lhs = seriesB.partialSums[N - 1];
  const rhs = matProd(dagger(U), seriesA.partialSums[N - 1], U);
  const exact = expm(B);
  const errs = useMemo(() => {
    const l: [number, number][] = [];
    const rr: [number, number][] = [];
    for (let k = 1; k <= 20; k++) {
      l.push([k, Math.max(1e-16, frobenius(matSub(seriesB.partialSums[k - 1], exact)))]);
      rr.push([k, Math.max(1e-16, frobenius(matSub(matProd(dagger(U), seriesA.partialSums[k - 1], U), exact)))]);
    }
    return { l, rr };
  }, [seriesA, seriesB, exact, U]);
  const termDiffs = [0, 1, 2, 3, 4, 5].map((k) => frobenius(matSub(seriesB.terms[k], matProd(dagger(U), seriesA.terms[k], U))));
  const sci = (x: number) => (x < 1e-15 ? '< 10⁻¹⁵' : x.toExponential(1));
  return (
    <VizCard title="Conjugation passes through every term of the series">
      <div className="flex flex-wrap gap-3">
        <div>
          <Label className="mb-1">A</Label>
          <Segmented value={ap} onChange={setAp} options={[{ value: 'iZ', label: '', tex: 'i\\theta Z' }, { value: 'X', label: '', tex: '-i\\theta X/2' }, { value: 'gen', label: 'generic' }]} />
        </div>
        <div>
          <Label className="mb-1">U</Label>
          <div className="flex gap-1.5">
            <Segmented value={up} onChange={setUp} options={[{ value: 'H', label: '', tex: 'H' }, { value: 'Ry', label: '', tex: 'R_y(\\pi/3)' }, { value: 'rand', label: 'random' }]} />
            {up === 'rand' && (
              <Button size="sm" variant="ghost" onClick={() => setSeed((s) => s + 1)}>
                {Icon.reset} new
              </Button>
            )}
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Slider tex="\theta" value={theta} min={0} max={3} onChange={setTheta} format={(v) => fmt(v, 2)} />
        <Slider tex="N" label="terms kept" value={N} min={1} max={20} step={1} onChange={(v) => setN(Math.round(v))} format={(v) => String(Math.round(v))} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg bg-ink-800/70 p-2 ring-1 ring-inset ring-ink-700">
          <div className="text-[11px] text-ink-400">
            <Tex>{`\\sum_{k<${N}} \\frac{(U^\\dagger A U)^k}{k!}`}</Tex>
          </div>
          <Tex display>{texMatrix(lhs, { digits: 3, factor: false })}</Tex>
        </div>
        <div className="rounded-lg bg-ink-800/70 p-2 ring-1 ring-inset ring-ink-700">
          <div className="text-[11px] text-ink-400">
            <Tex>{`U^\\dagger\\Big(\\sum_{k<${N}} \\frac{A^k}{k!}\\Big)U`}</Tex>
          </div>
          <Tex display>{texMatrix(rhs, { digits: 3, factor: false })}</Tex>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label className="mb-1">term-by-term difference</Label>
          <table className="w-full text-[12px]">
            <tbody className="font-mono tabular-nums">
              {termDiffs.map((d, k) => (
                <tr key={k} className="border-t border-ink-800">
                  <td className="py-0.5 font-sans text-ink-400">
                    <Tex>{`\\|(U^\\dagger AU)^{${k}} - U^\\dagger A^{${k}}U\\|`}</Tex>
                  </td>
                  <td className="py-0.5 text-right text-good">{sci(d)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <LinePlot
          series={[
            { points: errs.l, color: COLORS.state, label: '\\text{left side}' },
            { points: errs.rr, color: COLORS.phase, dashed: true, label: '\\text{right side}' },
          ]}
          xMin={1}
          xMax={20}
          yMin={-16}
          yMax={2}
          logY
          yTicks={[1e-15, 1e-10, 1e-5, 1].map((v) => ({ value: v, label: v === 1 ? '1' : `1e${Math.round(Math.log10(v))}` }))}
          height={150}
          cursorX={N}
          onScrub={(x) => setN(Math.max(1, Math.round(x)))}
          xLabel="N  (error vs. exact e^{U†AU})"
        />
      </div>
    </VizCard>
  );
}

// ---------------------------------------------------------------------------
// H swaps the x and z axes
// ---------------------------------------------------------------------------

const H_AXIS: Vec3 = [Math.SQRT1_2, 0, Math.SQRT1_2];

export function HadamardFrameViz() {
  const [s, setS] = useState(0);
  const [carry, setCarry] = useState(true);
  const dir = useRef(1);
  const [anim, setAnim] = useState(false);
  useRaf((dt) => {
    setS((x) => {
      let n = x + dir.current * dt * 0.45;
      if (n > 1) {
        n = 1;
        dir.current = -1;
      } else if (n < 0) {
        n = 0;
        dir.current = 1;
      }
      return n;
    });
  }, anim);
  const img = (v: Vec3) => rotate3(v, H_AXIS, s * PI);
  const plus = blochVector(apply(partialRotation(HAD, s), stateFromAngles(PI / 2, 0)));
  return (
    <VizCard title="H as a half-turn about (x̂ + ẑ)/√2">
      <Frame height={320}>
        <BlochCanvas labels="none">
          <AxisLine n={H_AXIS} color={COLORS.axis} dashed label="\hat h" bothArrows />
          <Arrow v={img([1, 0, 0])} color={COLORS.x} radius={0.016} label="X" />
          <Arrow v={img([0, 1, 0])} color={COLORS.y} radius={0.016} label="Y" />
          <Arrow v={img([0, 0, 1])} color={COLORS.z} radius={0.016} label="Z" />
          <PointMarker v={[1, 0, 0]} color={COLORS.faint} size={0.025} label="\hat x" />
          <PointMarker v={[0, 0, 1]} color={COLORS.faint} size={0.025} label="\hat z" />
          <PointMarker v={[0, 1, 0]} color={COLORS.faint} size={0.025} label="\hat y" />
          {carry && <StateArrow v={plus} label="H^{s}\ket{+}" />}
        </BlochCanvas>
        <Overlay>
          <Tex>{`s = ${fmt(s, 2)}\\ \\Rightarrow\\ \\text{rotated by } ${fmt(s * 180, 0)}^\\circ`}</Tex>
        </Overlay>
      </Frame>
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[220px] flex-1">
          <Slider tex="s" label="fraction of the half-turn" value={s} min={0} max={1} onChange={(v) => { setAnim(false); setS(v); }} format={(v) => fmt(v, 2)} />
        </div>
        <Button size="sm" variant="primary" onClick={() => setAnim(!anim)}>
          {anim ? Icon.pause : Icon.play} {anim ? 'pause' : 'animate'}
        </Button>
        <Toggle checked={carry} onChange={setCarry} label={<>carry the state <Tex>{'\\ket+'}</Tex></>} />
      </div>
      <p className="text-[12.5px] leading-relaxed text-ink-400">
        The coloured arrows are the axes of <Tex>{'X, Y, Z'}</Tex> after conjugation by the partial rotation. At <Tex>{'s = 1'}</Tex>: the X axis lands on <Tex>{'\\hat z'}</Tex>, Z lands on{' '}
        <Tex>{'\\hat x'}</Tex>, and Y is flipped — exactly <Tex>{'HXH = Z,\\ HZH = X,\\ HYH = -Y'}</Tex>. The state <Tex>{'\\ket+'}</Tex> is carried to <Tex>{'\\ket0'}</Tex>.
      </p>
    </VizCard>
  );
}

// ---------------------------------------------------------------------------
// H Rx(θ) H = Rz(θ)
// ---------------------------------------------------------------------------

export function ConjugationSequenceViz() {
  const [theta, setTheta] = useState(PI / 2);
  const [start, setStart] = useState<Vec3>(() => blochVector(stateFromAngles(PI / 2, 0)));
  const [prog, setProg] = useState(0); // 0..3
  const [playing, setPlaying] = useState(false);
  useRaf((dt) => {
    setProg((p) => {
      const n = p + dt * 0.7;
      if (n >= 3) {
        setPlaying(false);
        return 3;
      }
      return n;
    });
  }, playing);
  const psi0 = useMemo(() => {
    const a = anglesFromBloch(start);
    return stateFromAngles(a.theta, a.phi);
  }, [start]);
  const gates: Mat2[] = [HAD, Rx(theta), HAD];
  const axes: Vec3[] = [H_AXIS, [1, 0, 0], H_AXIS];
  const stateAt = (p: number): Vec2 => {
    let psi = psi0;
    const k = Math.min(2, Math.floor(p));
    for (let j = 0; j < k; j++) psi = apply(gates[j], psi);
    return apply(partialRotation(gates[k], p - k), psi);
  };
  const cur = blochVector(stateAt(prog));
  const trail = useMemo(() => {
    const pts: Vec3[] = [];
    const n = Math.max(2, Math.ceil(prog * 60));
    for (let i = 0; i <= n; i++) pts.push(blochVector(stateAt((prog * i) / n)));
    return pts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prog, theta, psi0]);
  const target = apply(Rz(theta), psi0);
  const final = apply(matProd(HAD, Rx(theta), HAD), psi0);
  const stage = Math.min(2, Math.floor(prog));
  const labels = ['H', 'R_x(\\theta)', 'H'];
  return (
    <VizCard title="Conjugation changes the rotation axis">
      <Frame height={320}>
        <BlochCanvas labels="kets">
          <AxisLine n={axes[stage]} color={COLORS.axis} dashed opacity={0.85} label={labels[stage]} />
          <OrbitCircle n={[0, 0, 1]} through={start} color={COLORS.phase} opacity={0.35} />
          <PointMarker v={blochVector(target)} color={COLORS.phase} ring label="R_z(\theta)\ket\psi" />
          <Trail points={trail} fade={false} />
          <StateArrow v={start} color={COLORS.faint} opacity={0.7} />
          <DragHandle v={start} onChange={(v) => { setStart(v); setProg(0); }} color={COLORS.muted} />
          <StateArrow v={cur} />
        </BlochCanvas>
        <Overlay>
          {(['H', 'R_x(\\theta)', 'H'] as const).map((g, i) => (
            <span key={i} className={`mr-2 ${i === stage && prog < 3 ? 'text-state' : prog >= i + 1 ? 'text-ink-200' : 'text-ink-500'}`}>
              {i + 1}. <Tex>{g}</Tex>
            </span>
          ))}
        </Overlay>
      </Frame>
      <div className="grid gap-3 sm:grid-cols-2">
        <Slider tex="\theta" value={theta} min={0} max={2 * PI} onChange={(v) => { setTheta(v); setProg(0); }} format={(v) => texAngle(v, { inline: true })} />
        <Slider label="progress through H · Rx(θ) · H" value={prog} min={0} max={3} onChange={(v) => { setPlaying(false); setProg(v); }} format={(v) => fmt(v, 2)} />
      </div>
      <PlaybackBar
        playing={playing}
        onToggle={() => {
          if (prog >= 3) setProg(0);
          setPlaying(!playing);
        }}
        onReset={() => { setPlaying(false); setProg(0); }}
        onStepBack={() => { setPlaying(false); setProg((p) => Math.max(0, Math.ceil(p) - 1)); }}
        onStepForward={() => { setPlaying(false); setProg((p) => Math.min(3, Math.floor(p) + 1)); }}
      />
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12.5px]">
        <KV k={<Tex>{'|\\langle R_z(\\theta)\\psi\\,|\\,HR_x(\\theta)H\\psi\\rangle|^2'}</Tex>} v={<span className="text-good">{fmt(fidelity(target, final), 6)}</span>} />
      </div>
      <p className="text-[12.5px] leading-relaxed text-ink-400">
        The first <Tex>{'H'}</Tex> carries the z axis to x, <Tex>{'R_x(\\theta)'}</Tex> rotates about x, and the second <Tex>{'H'}</Tex> carries everything back. Net effect: a rotation by{' '}
        <Tex>{'\\theta'}</Tex> about z (gold ring). Drag the grey start state and try any <Tex>{'\\theta'}</Tex>.
      </p>
    </VizCard>
  );
}

// ---------------------------------------------------------------------------
// eigenvectors and Born rule geometry
// ---------------------------------------------------------------------------

type EOp = 'X' | 'Y' | 'Z' | 'n';
const EIG_LABELS: Record<'X' | 'Y' | 'Z' | 'n', [string, string]> = {
  X: ['+', '-'],
  Y: ['+i', '-i'],
  Z: ['0', '1'],
  n: ['+\\vec n', '-\\vec n'],
};

export function EigenViz({ initialOp = 'X' as EOp }: { initialOp?: EOp }) {
  const [op, setOp] = useState<EOp>(initialOp);
  const [nt, setNt] = useState(PI / 6);
  const [np, setNp] = useState(0);
  const [s, setS] = useState<Vec3>(() => blochVector(stateFromAngles(0.9, 0.6)));
  const n: Vec3 = op === 'X' ? [1, 0, 0] : op === 'Y' ? [0, 1, 0] : op === 'Z' ? [0, 0, 1] : axisFromAngles(nt, np);
  const M = op === 'X' ? PX : op === 'Y' ? PY : op === 'Z' ? PZ : nDotSigma(n);
  const { plus, minus } = eigenbasis(n);
  const psi = useMemo(() => {
    const a = anglesFromBloch(s);
    return stateFromAngles(a.theta, a.phi);
  }, [s]);
  const pr = probabilities(psi, n);
  const lab = EIG_LABELS[op];
  const kets = [`\\ket{${lab[0]}}`, `\\ket{${lab[1]}}`];
  return (
    <VizCard title="Eigenstates sit at opposite ends of the measurement axis">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented value={op} onChange={setOp} options={[{ value: 'X', label: '', tex: 'X' }, { value: 'Y', label: '', tex: 'Y' }, { value: 'Z', label: '', tex: 'Z' }, { value: 'n', label: '', tex: '\\vec n\\cdot\\vec\\sigma' }]} />
      </div>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <Frame height={300}>
          <BlochCanvas labels={op === 'n' ? 'both' : 'xyz'}>
            <AxisLine n={n} color={COLORS.axis} dashed opacity={0.8} />
            <PointMarker v={n} color={COLORS.p0} ring label={`${kets[0]}\\ (+1)`} />
            <PointMarker v={[-n[0], -n[1], -n[2]]} color={COLORS.p1} ring label={`${kets[1]}\\ (-1)`} />
            <ProjectionOnAxis v={s} n={n} />
            <StateArrow v={s} />
            <DragHandle v={s} onChange={setS} />
          </BlochCanvas>
          <Overlay pos="bl">drag the state</Overlay>
        </Frame>
        <div className="space-y-2 text-[13px]">
          <Tex display>{`${op === 'n' ? '\\vec n\\cdot\\vec\\sigma' : op} = ${texMatrix(M, { digits: 2 })}`}</Tex>
          <Tex display>{`\\lambda_+ = +1:\\ ${kets[0]} = ${texColumn(plus, { digits: 3 })},\\quad \\lambda_- = -1:\\ ${kets[1]} = ${texColumn(minus, { digits: 3 })}`}</Tex>
          <ProbabilityBars
            items={[
              { label: `|\\langle ${lab[0]}|\\psi\\rangle|^2`, p: pr.plus, color: COLORS.p0 },
              { label: `|\\langle ${lab[1]}|\\psi\\rangle|^2`, p: pr.minus, color: COLORS.p1 },
            ]}
          />
          <KV k={<Tex>{'\\langle\\psi|A|\\psi\\rangle = P_+ - P_-'}</Tex>} v={fmt(pr.plus - pr.minus, 3)} />
          <p className="text-[12px] leading-relaxed text-ink-400">
            The dashed foot point of the state on the axis splits the diameter in the ratio <Tex>{'P_-:P_+'}</Tex> — the Born rule as geometry: <Tex>{'P_\\pm = (1 \\pm \\vec n\\cdot\\vec r)/2'}</Tex>.
          </p>
        </div>
      </div>
      {op === 'n' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Slider tex="\theta_n" value={nt} min={0} max={PI} onChange={setNt} format={(v) => texAngle(v, { inline: true })} color={COLORS.axis} />
          <Slider tex="\varphi_n" value={np} min={0} max={2 * PI} onChange={setNp} format={(v) => texAngle(v, { inline: true })} color={COLORS.axis} />
        </div>
      )}
    </VizCard>
  );
}

// ---------------------------------------------------------------------------
// measuring |0⟩ in the X basis
// ---------------------------------------------------------------------------

export function XMeasureViz({ axisTiltControl = false, initialTilt = PI / 2 }: { axisTiltControl?: boolean; initialTilt?: number }) {
  const [theta, setTheta] = useState(0);
  const [tilt, setTilt] = useState(initialTilt); // angle of the measurement axis from z (π/2 = x)
  const [counts, setCounts] = useState({ plus: 0, minus: 0 });
  const [last, setLast] = useState<1 | -1 | null>(null);
  const rng = useMemo(() => mulberry32((Date.now() & 0xffff) + 17), []);
  const psi = stateFromAngles(theta, 0);
  const n: Vec3 = [Math.sin(tilt), 0, Math.cos(tilt)];
  const pr = probabilities(psi, n);
  const viaH = abs2(apply(HAD, psi)[0]);
  const fire = (k: number) => {
    let p = 0;
    let m = 0;
    let lo: 1 | -1 = 1;
    for (let i = 0; i < k; i++) {
      const r = measure(psi, n, rng);
      if (r.outcome === 1) p++;
      else m++;
      lo = r.outcome;
    }
    setCounts((cc) => ({ plus: cc.plus + p, minus: cc.minus + m }));
    setLast(lo);
  };
  const isX = Math.abs(tilt - PI / 2) < 1e-9;
  const post = last === null ? null : last === 1 ? n : ([-n[0], -n[1], -n[2]] as Vec3);
  return (
    <VizCard title={isX ? 'Measuring in the X basis' : 'Measuring along a tilted axis'}>
      <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-lg bg-ink-800/60 px-3 py-2 text-[13px]">
        <span className="rounded bg-ink-700 px-2 py-1">
          <Tex>{theta === 0 ? '\\ket0' : '\\ket\\psi'}</Tex>
        </span>
        <span className="text-ink-500">→</span>
        <span className="rounded bg-axis/20 px-2 py-1 text-axis">
          <Tex>{'H'}</Tex>
        </span>
        <span className="text-ink-500">→</span>
        <span className="rounded bg-ink-700 px-2 py-1">measure Z</span>
        <span className="text-ink-500">→</span>
        <span className="rounded bg-axis/20 px-2 py-1 text-axis">
          <Tex>{'H'}</Tex>
        </span>
        <span className="text-ink-500">→</span>
        <span className="rounded bg-ink-700 px-2 py-1">
          {last === null ? 'outcome ±' : last === 1 ? <Tex>{'+ \\Rightarrow \\ket{+}'}</Tex> : <Tex>{'- \\Rightarrow \\ket{-}'}</Tex>}
        </span>
        {!isX && <span className="ml-2 text-[11.5px] text-ink-400">(equivalent for the tilted axis: rotate, measure Z, rotate back)</span>}
      </div>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <Frame height={280}>
          <BlochCanvas labels="kets">
            <AxisLine n={n} color={COLORS.axis} dashed opacity={0.8} />
            <PointMarker v={n} color={COLORS.p0} ring />
            <PointMarker v={[-n[0], -n[1], -n[2]]} color={COLORS.p1} ring />
            <ProjectionOnAxis v={blochVector(psi)} n={n} />
            <StateArrow v={blochVector(psi)} />
            {post && <StateArrow v={post} color={last === 1 ? COLORS.p0 : COLORS.p1} opacity={0.6} />}
          </BlochCanvas>
          <Overlay>
            <Tex>{`P(+) = |\\langle +|\\psi\\rangle|^2 = ${fmt(pr.plus, 3)}`}</Tex>
          </Overlay>
        </Frame>
        <div className="space-y-2">
          <Histogram
            height={130}
            bins={[
              { label: '+', count: counts.plus, expected: pr.plus, color: COLORS.p0 },
              { label: '-', count: counts.minus, expected: pr.minus, color: COLORS.p1 },
            ]}
          />
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="primary" onClick={() => fire(1)}>
              measure 1
            </Button>
            <Button size="sm" onClick={() => fire(100)}>
              ×100
            </Button>
            <Button size="sm" onClick={() => fire(1000)}>
              ×1000
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setCounts({ plus: 0, minus: 0 }); setLast(null); }}>
              {Icon.reset}
            </Button>
          </div>
          {isX && <KV k={<Tex>{'|\\langle 0|H\\psi\\rangle|^2'}</Tex>} v={fmt(viaH, 3)} />}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Slider tex="\theta_\psi" label="input state (xz-plane)" value={theta} min={0} max={PI} onChange={(v) => { setTheta(v); setCounts({ plus: 0, minus: 0 }); setLast(null); }} format={(v) => texAngle(v, { inline: true })} marks={[{ value: 0, tex: '\\ket0' }]} />
        {axisTiltControl && (
          <Slider tex="\alpha" label="axis angle from z" value={tilt} min={0} max={PI} onChange={(v) => { setTilt(v); setCounts({ plus: 0, minus: 0 }); setLast(null); }} format={(v) => `${fmt((v * 180) / PI, 0)}^\\circ`} color={COLORS.axis} marks={[{ value: PI / 6, tex: '30^\\circ' }, { value: PI / 2, tex: 'x' }]} />
        )}
      </div>
    </VizCard>
  );
}

// ---------------------------------------------------------------------------
// Stern–Gerlach chains
// ---------------------------------------------------------------------------

const AX: Record<'x' | 'z', Vec3> = { x: [1, 0, 0], z: [0, 0, 1] };

export function SGChainViz({ initialLast = 'z' as 'z' | 'x', allowRemoveX = true }: { initialLast?: 'z' | 'x'; allowRemoveX?: boolean }) {
  const [last, setLast] = useState<'z' | 'x'>(initialLast);
  const [withX, setWithX] = useState(true);
  const [counts, setCounts] = useState({ emitted: 0, block1: 0, block2: 0, plus: 0, minus: 0 });
  const rng = useMemo(() => mulberry32((Date.now() & 0xffff) + 5), []);
  const stages: SGStage[] = useMemo(
    () => [{ axis: AX.z, pass: 'plus' }, ...(withX ? [{ axis: AX.x, pass: 'plus' as const }] : []), { axis: AX[last], pass: 'both' }],
    [withX, last],
  );
  const pred = predictChain(MAXIMALLY_MIXED, stages);
  const enterLast = pred.enter[pred.enter.length - 1];
  const reset = () => setCounts({ emitted: 0, block1: 0, block2: 0, plus: 0, minus: 0 });
  const fire = (k: number) => {
    const cc = { ...counts };
    for (let i = 0; i < k; i++) {
      cc.emitted++;
      let psi = randomState(rng);
      for (let j = 0; j < stages.length; j++) {
        const r = measure(psi, stages[j].axis, rng);
        psi = r.post;
        const isLast = j === stages.length - 1;
        if (isLast) {
          if (r.outcome === 1) cc.plus++;
          else cc.minus++;
        } else if (r.outcome !== 1) {
          if (j === 0) cc.block1++;
          else cc.block2++;
          break;
        }
      }
    }
    setCounts(cc);
  };
  const lastLabel = last === 'z' ? ['\\uparrow', '\\downarrow'] : ['+', '-'];
  const boxes = [{ label: 'Z', up: true }, ...(withX ? [{ label: 'X', up: false }] : []), { label: last === 'z' ? 'Z' : 'X', up: last === 'z' }];
  const stateAfter: { v: Vec3; tex: string }[] = [{ v: AX.z, tex: '\\ket0' }, ...(withX ? [{ v: AX.x, tex: '\\ket+' }] : [])];
  const W = 120 + boxes.length * 130 + 60;
  return (
    <VizCard title="Sequential Stern–Gerlach magnets">
      <div className="overflow-x-auto rounded-xl border border-ink-700/80 bg-ink-900/60 p-2">
        <svg viewBox={`0 0 ${W} 130`} className="h-[130px] min-w-[520px] w-full">
          <rect x={8} y={45} width={70} height={40} rx={6} fill={COLORS.panel} stroke={COLORS.gridStrong} />
          <text x={43} y={70} fill={COLORS.muted} fontSize={13} textAnchor="middle">oven</text>
          <line x1={78} y1={65} x2={110} y2={65} stroke={COLORS.state} strokeWidth={2} />
          {boxes.map((b, i) => {
            const x = 110 + i * 130;
            const isLast = i === boxes.length - 1;
            return (
              <g key={i}>
                <rect x={x} y={35} width={60} height={60} rx={6} fill={COLORS.panel} stroke={COLORS.axis} strokeOpacity={0.7} />
                <text x={x + 30} y={71} fill={COLORS.text} fontSize={17} textAnchor="middle" fontStyle="italic">{b.label}</text>
                {!isLast ? (
                  <>
                    <line x1={x + 60} y1={50} x2={x + 130} y2={65} stroke={COLORS.p0} strokeWidth={2} />
                    <line x1={x + 60} y1={82} x2={x + 92} y2={100} stroke={COLORS.p1} strokeWidth={2} />
                    <rect x={x + 90} y={96} width={9} height={9} fill={COLORS.text} />
                    <text x={x + 76} y={40} fill={COLORS.p0} fontSize={12}>{b.up ? '↑' : '+'}</text>
                    <text x={x + 102} y={118} fill={COLORS.faint} fontSize={10.5}>{i === 0 ? counts.block1 : counts.block2} blocked</text>
                  </>
                ) : (
                  <>
                    <line x1={x + 60} y1={50} x2={x + 120} y2={25} stroke={COLORS.p0} strokeWidth={2} />
                    <line x1={x + 60} y1={82} x2={x + 120} y2={105} stroke={COLORS.p1} strokeWidth={2} />
                    <text x={x + 124} y={29} fill={COLORS.p0} fontSize={12}>{last === 'z' ? '↑' : '+'} {counts.plus}</text>
                    <text x={x + 124} y={110} fill={COLORS.p1} fontSize={12}>{last === 'z' ? '↓' : '−'} {counts.minus}</text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-[12.5px] text-ink-300">
          last magnet
          <Segmented value={last} onChange={(v) => { setLast(v); reset(); }} options={[{ value: 'z', label: '', tex: 'Z' }, { value: 'x', label: '', tex: 'X' }]} />
        </div>
        {allowRemoveX && <Toggle checked={withX} onChange={(v) => { setWithX(v); reset(); }} label="middle X magnet present" />}
        <div className="flex gap-1.5">
          <Button size="sm" variant="primary" onClick={() => fire(1)}>
            fire 1
          </Button>
          <Button size="sm" onClick={() => fire(200)}>
            ×200
          </Button>
          <Button size="sm" onClick={() => fire(2000)}>
            ×2000
          </Button>
          <Button size="sm" variant="ghost" onClick={reset}>
            {Icon.reset}
          </Button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <Label className="mb-1">final screen (given the atom reached the last magnet)</Label>
          <Histogram
            height={120}
            bins={[
              { label: lastLabel[0], count: counts.plus, expected: enterLast > 0 ? pred.finalPlus / enterLast : 0, color: COLORS.p0 },
              { label: lastLabel[1], count: counts.minus, expected: enterLast > 0 ? pred.finalMinus / enterLast : 0, color: COLORS.p1 },
            ]}
          />
          <div className="mt-1 space-y-0.5 text-[12px]">
            <KV k="emitted" v={counts.emitted} />
            <KV k="reach last magnet (theory)" v={`${fmt(100 * enterLast, 1)}%`} />
            <KV k={`final ${last === 'z' ? '↑' : '+'} / all emitted (theory)`} v={`${fmt(100 * pred.finalPlus, 1)}%`} />
          </div>
        </div>
        <Frame height={220}>
          <BlochCanvas labels="kets" zoom={1.1}>
            <AxisLine n={AX[last]} color={COLORS.axis} dashed opacity={0.75} />
            {stateAfter.map((s, i) => (
              <StateArrow key={i} v={s.v} opacity={i === stateAfter.length - 1 ? 1 : 0.35} />
            ))}
            <PointMarker v={AX[last]} color={COLORS.p0} ring />
            <PointMarker v={[-AX[last][0], -AX[last][1], -AX[last][2]]} color={COLORS.p1} ring />
          </BlochCanvas>
          <Overlay>
            state entering the last magnet: <Tex>{stateAfter[stateAfter.length - 1].tex}</Tex>
          </Overlay>
        </Frame>
      </div>
    </VizCard>
  );
}
