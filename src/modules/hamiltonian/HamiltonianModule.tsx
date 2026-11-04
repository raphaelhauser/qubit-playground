import { useEffect, useMemo, useState } from 'react';
import { ModuleShell } from '../../layout/ModuleShell';
import { BlochCanvas, StateArrow, AxisLine, OrbitCircle, Trail, PointMarker, DragHandle, AngleAroundAxis, Arrow } from '../../components/bloch';
import { ComplexPlane } from '../../components/ComplexPlane';
import { LinePlot, ProbabilityBars, Series } from '../../components/charts';
import { Tex } from '../../components/Tex';
import { Card, Slider, Button, KV, Callout, Label, Segmented, Toggle, Swatch } from '../../components/ui';
import { PlaybackBar } from '../../components/Playback';
import { PredictionCard } from '../../components/Prediction';
import { HighlightProvider, useHighlight } from '../../components/Highlight';
import { useRaf } from '../../hooks/animation';
import { COLORS } from '../../theme';
import {
  HamiltonianParams,
  hamiltonianMatrix,
  hamiltonianAxis,
  evolutionOperator,
  evolutionAngle,
  sampleTrajectory,
  transitionProbability,
  transitionAmplitude,
  oscillation,
  energies,
  fromOmegas,
  toOmegas,
  stateFromAngles,
  anglesFromBloch,
  blochVector,
  apply,
  vscale,
  expi,
  expm,
  matScale,
  matSub,
  frobenius,
  isUnitary,
  isHermitian,
  pauliDecompose,
  abs2,
  inner,
  c,
  PRESETS,
  texMatrix,
  texComplex,
  texKet,
  texReal,
  texPauliSum,
  fmt,
  fmtAngle,
  Vec3,
} from '../../quantum';
import { EnergyDiagram, HlRing, PauliBars, texSci } from './widgets';
import { HoverFix } from './hoverFix';

const TMAX = 4 * Math.PI;
const TWO_PI = 2 * Math.PI;

const TIPS: Record<string, string> = {
  gphase: 'e^{−iω̄t} — the global phase produced by the identity part of H. It multiplies both amplitudes equally and is invisible on the Bloch sphere.',
  angle: '2rt — angle by which the Bloch vector has rotated about v after time t.',
  omega1: 'ω₁ — energy of |0⟩ when ε = 0 (first diagonal entry).',
  omega2: 'ω₂ — energy of |1⟩ when ε = 0 (second diagonal entry).',
  pmax: 'Maximum transition probability ε²/(Δω² + ε²) — the cone around v only reaches |1⟩ if v lies on the equator.',
  period: 'P(1,t) = (ε/r)² sin²(rt) repeats every π/r (the Bloch vector itself needs 2π/(2r) = π/r for a full turn).',
  energy: 'Eigenvalues E± = ω̄ ± r of H. Their difference 2r sets the precession frequency.',
  overlap: '⟨1|ψ(t)⟩ — the transition amplitude. Its squared magnitude is the probability of finding the qubit in |1⟩.',
};

interface Experiment {
  id: string;
  label: string;
  params: HamiltonianParams;
  theta0: number;
  phi0: number;
  offset?: number;
  desc: string;
}

const EXPERIMENTS: Experiment[] = [
  {
    id: 'diag',
    label: '1 · Diagonal (ε = 0)',
    params: { omegaBar: 0.5, deltaOmega: 0.8, epsilon: 0 },
    theta0: Math.PI / 2,
    phi0: 0,
    desc: 'H is diagonal, so v = z. |+⟩ precesses around the z axis at angular frequency 2Δω = ω₁ − ω₂; the populations P(0), P(1) never change. (Try |0⟩: it only acquires the phase e^{−iω₁t}.)',
  },
  {
    id: 'x',
    label: '2 · Pure X (Δω = 0)',
    params: { omegaBar: 0, deltaOmega: 0, epsilon: 0.6 },
    theta0: 0,
    phi0: 0,
    desc: 'v = x: the state rotates through the poles. Complete population transfer |0⟩ → |1⟩ happens at t = π/(2ε) — a Rabi oscillation with P(1) = sin²(εt).',
  },
  {
    id: 'pert',
    label: '3 · Perturbed',
    params: { omegaBar: 0.3, deltaOmega: 0.8, epsilon: 0.5 },
    theta0: 0,
    phi0: 0,
    desc: 'Both nonzero: rotation about the tilted axis v = (ε, 0, Δω)/r. The cone around v never reaches |1⟩, so P(1) ≤ ε²/r² < 1.',
  },
  {
    id: 'degen',
    label: 'Degenerate (r = 0)',
    params: { omegaBar: 0.7, deltaOmega: 0, epsilon: 0 },
    theta0: Math.PI / 2,
    phi0: Math.PI / 4,
    desc: 'H = ω̄I has no rotation axis: U_t = e^{−iω̄t} I. Every state is stationary; only the global phase turns (watch the amplitudes spin).',
  },
  {
    id: 'offset',
    label: 'Identity offset',
    params: { omegaBar: 0, deltaOmega: 0.5, epsilon: 0.6 },
    theta0: 0,
    phi0: 0,
    offset: 1.5,
    desc: 'Compare H with H + 1.5·I (dashed ghost). Different eigenvalues, identical Bloch trajectories and probabilities — they differ only by the global phase e^{−i·1.5·t}.',
  },
];

export default function HamiltonianModule(_props: { subpath: string }) {
  return (
    <HighlightProvider tips={TIPS}>
      <HoverFix>
        <HamiltonianPlayground />
      </HoverFix>
    </HighlightProvider>
  );
}

function HamiltonianPlayground() {
  const [p, setP] = useState<HamiltonianParams>(EXPERIMENTS[2].params);
  const [mode, setMode] = useState<'pauli' | 'omegas'>('pauli');
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [init, setInit] = useState({ theta: 0, phi: 0 });
  const [showGlobal, setShowGlobal] = useState(true);
  const [offset, setOffset] = useState<number | null>(null);
  const [expId, setExpId] = useState<string | null>('pert');
  const { active } = useHighlight();

  useRaf((dt) => setT((prev) => Math.min(TMAX, prev + dt * speed)), playing);
  useEffect(() => {
    if (playing && t >= TMAX) setPlaying(false);
  }, [t, playing]);

  // ---------------------------------------------------------------- physics
  const H = useMemo(() => hamiltonianMatrix(p), [p]);
  const { r, v } = hamiltonianAxis(p);
  const psi0 = useMemo(() => stateFromAngles(init.theta, init.phi), [init]);
  const b0 = useMemo(() => blochVector(psi0), [psi0]);
  const U = useMemo(() => evolutionOperator(p, t), [p, t]);
  const psi = useMemo(() => apply(U, psi0), [U, psi0]);
  const b = useMemo(() => blochVector(psi), [psi]);
  const isKet0 = init.theta < 1e-9;
  const osc = oscillation(p);
  const [Em, Ep] = energies(p);
  const coeffs = useMemo(() => pauliDecompose(H), [H]);
  const angle = evolutionAngle(p, t);
  const omegas = toOmegas(p);
  const gphase = expi(-p.omegaBar * t);
  // independent numerical check: closed form vs. the general 2×2 matrix exponential
  const numErr = useMemo(() => frobenius(matSub(U, expm(matScale(H, c(0, -t))))), [U, H, t]);
  const unitary = isUnitary(U);

  const full = useMemo(() => sampleTrajectory(p, psi0, TMAX, 480), [p, psi0]);
  const trail = useMemo(() => {
    const n = Math.max(2, Math.ceil((t / TMAX) * 480));
    return sampleTrajectory(p, psi0, t, n).map((x) => x.bloch);
  }, [p, psi0, t]);

  const pc = useMemo(() => (offset === null ? null : { ...p, omegaBar: p.omegaBar + offset }), [p, offset]);
  const psiC = useMemo(() => (pc ? apply(evolutionOperator(pc, t), psi0) : null), [pc, t, psi0]);
  const trailC = useMemo(() => {
    if (!pc) return null;
    const n = Math.max(2, Math.ceil((t / TMAX) * 240));
    return sampleTrajectory(pc, psi0, t, n).map((x) => x.bloch);
  }, [pc, psi0, t]);

  const shown = showGlobal ? psi : vscale(psi, expi(p.omegaBar * t));
  const shownC = psiC ? (showGlobal ? psiC : vscale(psiC, expi(p.omegaBar * t))) : null;
  const p0 = abs2(psi[0]);
  const p1 = abs2(psi[1]);

  // ---------------------------------------------------------------- actions
  const runExperiment = (e: Experiment) => {
    setP(e.params);
    setInit({ theta: e.theta0, phi: e.phi0 });
    setOffset(e.offset ?? null);
    setExpId(e.id);
    setT(0);
    setPlaying(true);
  };
  const changeParams = (q: Partial<HamiltonianParams>) => {
    setP((old) => ({ ...old, ...q }));
    setExpId(null);
  };
  const changeOmegas = (w1: number, w2: number) => {
    setP((old) => fromOmegas(w1, w2, old.epsilon));
    setExpId(null);
  };
  const setInitFromBloch = (nv: Vec3) => {
    setPlaying(false);
    setT(0);
    const a = anglesFromBloch(nv);
    setInit((old) => ({ theta: a.theta, phi: Math.hypot(nv[0], nv[1]) > 1e-3 ? a.phi : old.phi }));
  };
  const step = TMAX / 160;

  // ---------------------------------------------------------------- plot data
  const series: Series[] = useMemo(() => {
    const s: Series[] = [
      { points: full.map((x) => [x.t, x.p0] as [number, number]), color: COLORS.p0, label: 'P(0,t)', hl: 'p0' },
      { points: full.map((x) => [x.t, x.p1] as [number, number]), color: COLORS.p1, label: 'P(1,t)', hl: 'p1' },
    ];
    if (isKet0) {
      s.push({
        points: full.map((x) => [x.t, transitionProbability(p, x.t)] as [number, number]),
        color: COLORS.text,
        dashed: true,
        width: 1.2,
        opacity: 0.75,
        label: '\\tfrac{\\epsilon^2}{r^2}\\sin^2(rt)',
      });
    }
    return s;
  }, [full, isKet0, p]);
  const xTicks = useMemo(() => {
    if (r > 1e-9 && TMAX / osc.period <= 8) {
      const ticks = [];
      for (let k = 1; k * osc.period <= TMAX + 1e-9; k++) ticks.push({ value: k * osc.period, label: k === 1 ? 'π/r' : `${k}π/r` });
      return ticks;
    }
    return [1, 2, 3, 4].map((k) => ({ value: k * Math.PI, label: k === 1 ? 'π' : `${k}π` }));
  }, [r, osc.period]);

  // ---------------------------------------------------------------- views
  const axisHot = active === 'v' || active === 'r' || active === 'axis';
  const viz = (
    <BlochCanvas
      overlay={
        <>
          <div className="absolute left-3 top-3 max-w-[calc(100%-24px)] rounded-lg bg-ink-900/75 px-3 py-2 ring-1 ring-ink-700 backdrop-blur">
            <Label className="mb-0.5">
              t = <span className="font-mono normal-case tracking-normal text-ink-100">{t.toFixed(2)}</span>
            </Label>
            <div className="text-[14px]">
              <Tex>{`\\ket{\\psi(t)} = ${texKet(psi, { digits: 2, exact: false })}`}</Tex>
            </div>
          </div>
          <div className="absolute bottom-2 left-3 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px]">
            <Swatch color={COLORS.axis}>axis v</Swatch>
            <Swatch color={COLORS.state}>trajectory 0 → t</Swatch>
            <Swatch color={COLORS.muted}>ψ(0)</Swatch>
            {pc && <Swatch color={COLORS.phase}>H + {fmt(offset!, 1)}·I (ghost)</Swatch>}
          </div>
          {!v && (
            <div className="absolute right-3 top-3 animate-fadein rounded-lg bg-p1/10 px-3 py-1.5 text-[12px] text-p1 ring-1 ring-p1/30">
              r = 0 · H ∝ I · no rotation axis
            </div>
          )}
          {(active === 'omegabar' || active === 'gphase') && (
            <div className="absolute right-3 top-12 max-w-[260px] animate-fadein rounded-lg bg-phase/10 px-3 py-1.5 text-[12px] text-phase ring-1 ring-phase/30">
              ω̄ only multiplies the state by e^{'{'}−iω̄t{'}'} — the arrow is unaffected.
            </div>
          )}
        </>
      }
    >
      {v && <AxisLine n={v} color={COLORS.axis} label="\vec v" lineWidth={axisHot ? 3.2 : 2} dashed={!axisHot} />}
      {v && <OrbitCircle n={v} through={b0} opacity={0.4} />}
      {v && angle > 1e-3 && (
        <AngleAroundAxis n={v} angle={angle % TWO_PI} color={active === 'angle' ? COLORS.text : COLORS.axis} label={active === 'angle' ? '2rt' : undefined} />
      )}
      {v && active === 'epsilon' && <Arrow v={[v[0], 0, 0]} color={COLORS.x} radius={0.014} headRadius={0.04} label="\epsilon/r" />}
      {v && active === 'deltaomega' && <Arrow v={[0, 0, v[2]]} color={COLORS.z} radius={0.014} headRadius={0.04} label="\Delta\omega/r" />}
      {trailC && <Trail points={trailC} color={COLORS.phase} lineWidth={2} fade={false} dashed opacity={0.9} />}
      <Trail points={trail} lineWidth={active === 't' ? 3.4 : 2.2} />
      <PointMarker v={b0} color={COLORS.muted} label={t > 0.05 ? '\\psi(0)' : undefined} size={0.035} />
      <StateArrow v={b} emphasized={active === 'psi'} />
      {active === 'p1' && <PointMarker v={[0, 0, -1]} color={COLORS.p1} ring />}
      {active === 'p0' && <PointMarker v={[0, 0, 1]} color={COLORS.p0} ring />}
      {active === 'energy' && v && (
        <>
          <PointMarker v={v} color={COLORS.axis} label="E_+" ring />
          <PointMarker v={[-v[0], -v[1], -v[2]]} color={COLORS.axis} label="E_-" ring />
        </>
      )}
      <DragHandle v={b} onChange={setInitFromBloch} />
    </BlochCanvas>
  );

  const controls = (
    <>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <Card title="Time evolution" kicker="measurement probabilities vs. time">
          <div className="mb-2">
              <PlaybackBar
                playing={playing}
                onToggle={() => {
                  if (t >= TMAX) setT(0);
                  setPlaying(!playing);
                }}
                onReset={() => {
                  setPlaying(false);
                  setT(0);
                }}
                onStepBack={() => {
                  setPlaying(false);
                  setT((x) => Math.max(0, x - step));
                }}
                onStepForward={() => {
                  setPlaying(false);
                  setT((x) => Math.min(TMAX, x + step));
                }}
                onReplay={() => {
                  setT(0);
                  setPlaying(true);
                }}
                speed={speed}
                onSpeed={setSpeed}
              />
          </div>
          <HlRing hl="t">
            <Slider tex="t" label="evolution time" value={t} min={0} max={TMAX} step={0.001} onChange={(x) => { setPlaying(false); setT(x); }} format={(x) => x.toFixed(2)} hl="t" color={COLORS.state} />
          </HlRing>
          <div className="mt-2">
            <LinePlot
              series={series}
              xMin={0}
              xMax={TMAX}
              height={190}
              cursorX={t}
              onScrub={(x) => {
                setPlaying(false);
                setT(x);
              }}
              xLabel="time t  (drag to scrub)"
              xTicks={xTicks}
              hlines={isKet0 && r > 1e-9 && osc.maxTransition < 0.999 ? [{ y: osc.maxTransition, color: COLORS.p1, label: `max P(1) = ε²/r² = ${osc.maxTransition.toFixed(3)}` }] : []}
            />
          </div>
          {!isKet0 && (
            <p className="mt-1 text-[11.5px] text-ink-400">The dashed analytic curve is shown for ψ(0) = |0⟩ — pick that preset to compare with the formula.</p>
          )}
        </Card>
        <Card
          title="Evolving amplitudes"
          kicker="complex plane"
          right={<Toggle checked={showGlobal} onChange={setShowGlobal} label={<span className="text-[11.5px]">global phase</span>} />}
        >
          <div className="mx-auto max-w-[250px]">
            <ComplexPlane
              amplitudes={[
                { z: shown[0], color: COLORS.p0, label: '\\alpha(t)', hl: 'p0' },
                { z: shown[1], color: COLORS.p1, label: '\\beta(t)', hl: 'p1' },
              ]}
              ghosts={
                shownC
                  ? [
                      { z: shownC[0], color: COLORS.phase, label: '' },
                      { z: shownC[1], color: COLORS.phase, label: '' },
                    ]
                  : []
              }
            />
          </div>
          <div className="mt-1 space-y-0.5">
            <KV k={<Tex>{'\\hl{gphase}{e^{-i\\bar\\omega t}}'}</Tex>} v={<Tex>{texComplex(gphase, { digits: 2, exact: false })}</Tex>} />
            <KV k="relative phase arg β − arg α" v={p0 > 1e-6 && p1 > 1e-6 ? fmtAngle(((Math.atan2(psi[1].im, psi[1].re) - Math.atan2(psi[0].im, psi[0].re)) % TWO_PI + TWO_PI) % TWO_PI) : '—'} />
          </div>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-400">
            {showGlobal
              ? 'With ω̄ ≠ 0 both arrows spin together at rate ω̄ — that motion is the global phase. Switch it off to see only what the Bloch sphere sees.'
              : 'Global phase removed: the amplitudes now move exactly as the Bloch vector does.'}
          </p>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card
          title="Hamiltonian parameters"
          kicker="drive the Hamiltonian"
          right={
            <Segmented
              size="sm"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'pauli', label: 'ω̄, Δω' },
                { value: 'omegas', label: 'ω₁, ω₂' },
              ]}
            />
          }
        >
          <div className="space-y-2.5">
            {mode === 'pauli' ? (
              <>
                <HlRing hl={['omegabar', 'gphase']}>
                  <Slider tex="\bar\omega" label="mean energy" value={p.omegaBar} min={-2} max={2} step={0.01} onChange={(x) => changeParams({ omegaBar: x })} format={(x) => x.toFixed(2)} hl="omegabar" color={COLORS.phase} />
                </HlRing>
                <HlRing hl="deltaomega">
                  <Slider tex="\Delta\omega" label="energy difference" value={p.deltaOmega} min={-2} max={2} step={0.01} onChange={(x) => changeParams({ deltaOmega: x })} format={(x) => x.toFixed(2)} hl="deltaomega" color={COLORS.axis} />
                </HlRing>
              </>
            ) : (
              <>
                <HlRing hl="omega1">
                  <Slider tex="\omega_1" label="energy of |0⟩" value={omegas.omega1} min={-3} max={3} step={0.01} onChange={(x) => changeOmegas(x, omegas.omega2)} format={(x) => x.toFixed(2)} hl="omega1" color={COLORS.p0} />
                </HlRing>
                <HlRing hl="omega2">
                  <Slider tex="\omega_2" label="energy of |1⟩" value={omegas.omega2} min={-3} max={3} step={0.01} onChange={(x) => changeOmegas(omegas.omega1, x)} format={(x) => x.toFixed(2)} hl="omega2" color={COLORS.p1} />
                </HlRing>
              </>
            )}
            <HlRing hl="epsilon">
              <Slider tex="\epsilon" label="perturbation" value={p.epsilon} min={-2} max={2} step={0.01} onChange={(x) => changeParams({ epsilon: x })} format={(x) => x.toFixed(2)} hl="epsilon" color={COLORS.axis} />
            </HlRing>
            <div className="text-[11.5px] text-ink-400">
              {mode === 'pauli' ? (
                <>
                  ω₁ = ω̄ + Δω = <span className="font-mono text-ink-200">{fmt(omegas.omega1, 2)}</span>, ω₂ = ω̄ − Δω ={' '}
                  <span className="font-mono text-ink-200">{fmt(omegas.omega2, 2)}</span>
                </>
              ) : (
                <>
                  ω̄ = (ω₁ + ω₂)/2 = <span className="font-mono text-ink-200">{fmt(p.omegaBar, 2)}</span>, Δω = (ω₁ − ω₂)/2 ={' '}
                  <span className="font-mono text-ink-200">{fmt(p.deltaOmega, 2)}</span>
                </>
              )}
            </div>
            <div className="border-t border-ink-800 pt-2.5">
              <Toggle
                checked={offset !== null}
                onChange={(on) => setOffset(on ? 1 : null)}
                label="Compare with H + c·I (identity offset)"
              />
              {offset !== null && (
                <div className="mt-2">
                  <Slider tex="c" label="extra identity component" value={offset} min={-2} max={2} step={0.01} onChange={setOffset} format={(x) => x.toFixed(2)} color={COLORS.phase} />
                </div>
              )}
            </div>
          </div>
        </Card>

        <Card title="Initial state & experiments" kicker="start here — or drag the arrow">
          <Label className="mb-1.5">initial state</Label>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((q) => (
              <Button
                key={q.id}
                size="sm"
                active={Math.abs(init.theta - q.theta) < 1e-6 && (Math.abs(init.phi - q.phi) < 1e-6 || Math.sin(q.theta) < 1e-9)}
                onClick={() => {
                  setPlaying(false);
                  setT(0);
                  setInit({ theta: q.theta, phi: q.phi });
                }}
              >
                <Tex>{q.tex}</Tex>
              </Button>
            ))}
          </div>
          <Label className="mb-1.5 mt-3">guided experiments</Label>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {EXPERIMENTS.map((e) => (
              <Button key={e.id} size="sm" active={expId === e.id} onClick={() => runExperiment(e)} className="justify-start">
                {e.label}
              </Button>
            ))}
          </div>
          {expId && <p className="mt-2.5 animate-fadein text-[12.5px] leading-relaxed text-ink-300">{EXPERIMENTS.find((e) => e.id === expId)!.desc}</p>}
          {pc && psiC && (
            <div className="mt-2 rounded-md bg-ink-800 px-2.5 py-1.5 text-[12px] text-ink-300">
              Overlap <Tex>{"|\\langle\\psi(t)|\\psi'(t)\\rangle|^2"}</Tex> ={' '}
              <span className="font-mono text-good">{abs2(inner(psi, psiC)).toFixed(6)}</span>{' '}
              — the same physical state at every t.
            </div>
          )}
        </Card>
      </div>

      <div className="grid items-start gap-4 md:grid-cols-2">
          <PredictionCard
            question={
              <>
                Keep <Tex>{'\\epsilon'}</Tex> and <Tex>{'\\Delta\\omega'}</Tex> fixed and add <Tex>{'1.5\\,I'}</Tex> to the Hamiltonian. Both energies shift by 1.5. How does the Bloch trajectory change?
              </>
            }
            options={[
              { id: 'faster', label: 'The precession becomes faster.' },
              { id: 'tilt', label: 'The rotation axis tilts towards z.' },
              { id: 'same', label: 'It does not change at all.' },
              { id: 'spiral', label: 'The state spirals towards an eigenstate.' },
            ]}
            answer="same"
            onRun={() => {
              setOffset(1.5);
              setT(0);
              setPlaying(true);
            }}
            onReset={() => setOffset(null)}
            explanation={
              <>
                <p>
                  The dashed gold ghost (evolved with <Tex>{'H + 1.5I'}</Tex>) sits exactly on the blue trajectory. Since <Tex>{'I'}</Tex> commutes with everything,{' '}
                  <Tex>{'e^{-i(H+cI)t} = e^{-ict}\\,e^{-iHt}'}</Tex>: only a global phase is added.
                </p>
                <p>Observable dynamics depend on energy <em>differences</em> (here 2r), never on the absolute zero of energy.</p>
              </>
            }
          />

          <PredictionCard
            question={
              <>
                Set <Tex>{'\\Delta\\omega = 1.5'}</Tex>, <Tex>{'\\epsilon = 0.3'}</Tex> and start in <Tex>{'\\ket0'}</Tex>. What is the largest <Tex>{'P(1,t)'}</Tex> ever reached?
              </>
            }
            options={[
              { id: 'one', label: '1 — given enough time the qubit always flips.' },
              { id: 'half', label: 'About 0.5.' },
              { id: 'small', label: 'About 0.04.' },
              { id: 'zero', label: '0 — the perturbation is too weak to do anything.' },
            ]}
            answer="small"
            onRun={() => {
              setP({ omegaBar: 0, deltaOmega: 1.5, epsilon: 0.3 });
              setInit({ theta: 0, phi: 0 });
              setOffset(null);
              setExpId(null);
              setT(0);
              setPlaying(true);
            }}
            explanation={
              <>
                <p>
                  <Tex>{'\\max_t P(1,t) = \\epsilon^2/(\\Delta\\omega^2+\\epsilon^2) = 0.09/2.34 \\approx 0.038'}</Tex>. The axis <Tex>{'\\vec v'}</Tex> is almost parallel to z, so{' '}
                  <Tex>{'\\ket0'}</Tex> just circles on a narrow cone around it — quickly (period <Tex>{'\\pi/r \\approx 2.05'}</Tex>) but never far.
                </p>
                <p>A weak coupling between strongly detuned levels causes fast, small oscillations — the essence of off-resonant driving.</p>
              </>
            }
          />

        <div className="md:col-span-2">
          <Callout tone="insight" title="Two numbers govern everything you can see">
            Only the Pauli part <Tex>{'r(\\vec v\\cdot\\vec\\sigma)'}</Tex> moves the Bloch vector: <Tex>{'\\vec v'}</Tex> is the axis and <Tex>{'2r'}</Tex> the angular speed. The identity part{' '}
            <Tex>{'\\bar\\omega I'}</Tex> is a clock that nobody can read.
          </Callout>
        </div>
      </div>
    </>
  );

  const panel = (
    <>
      <Card title="The Schrödinger equation" kicker="the law of motion">
        <Tex display>{'i\\frac{d}{dt}\\ket{\\psi(t)} = \\hl{H}{H}\\ket{\\psi(t)} \\quad\\Longrightarrow\\quad \\ket{\\psi(t)} = \\hl{U}{e^{-iHt}}\\ket{\\psi(0)}'}</Tex>
        <p className="text-[12.5px] leading-relaxed text-ink-400">
          For time-independent <Tex>{'H'}</Tex>, differentiating <Tex>{'e^{-iHt}\\ket{\\psi(0)}'}</Tex> brings down <Tex>{'-iH'}</Tex>, which solves the equation. Because{' '}
          <Tex>{'H = H^\\dagger'}</Tex>, <Tex>{'U_t^\\dagger U_t = e^{iHt}e^{-iHt} = I'}</Tex>: probabilities are conserved.
        </p>
      </Card>

      <Card title="Hamiltonian" kicker={isHermitian(H) ? 'Hermitian ✓' : 'not Hermitian'}>
        {mode === 'pauli' ? (
          <Tex display>
            {`\\hl{H}{H} = \\begin{pmatrix} \\hl{omegabar}{\\bar\\omega} + \\hl{deltaomega}{\\Delta\\omega} & \\hl{epsilon}{\\epsilon} \\\\ \\hl{epsilon}{\\epsilon} & \\hl{omegabar}{\\bar\\omega} - \\hl{deltaomega}{\\Delta\\omega} \\end{pmatrix} = ${texMatrix(H, { digits: 2, exact: false, factor: false })}`}
          </Tex>
        ) : (
          <Tex display>
            {`\\hl{H}{H} = \\begin{pmatrix} \\hl{omega1}{\\omega_1} & 0 \\\\ 0 & \\hl{omega2}{\\omega_2} \\end{pmatrix} + \\hl{epsilon}{\\epsilon}\\begin{pmatrix} 0 & 1 \\\\ 1 & 0\\end{pmatrix} = ${texMatrix(H, { digits: 2, exact: false, factor: false })}`}
          </Tex>
        )}
        <Label className="mb-1 mt-2">Pauli decomposition</Label>
        <Tex display>
          {`H = \\hl{omegabar}{\\bar\\omega}\\,I + \\hl{epsilon}{\\epsilon}\\,X + \\hl{deltaomega}{\\Delta\\omega}\\,Z = \\hl{omegabar}{\\bar\\omega}\\,I + \\hl{r}{r}\\,(\\hl{v}{\\vec v}\\cdot\\vec\\sigma)`}
        </Tex>
        <div className="text-center text-[13px]">
          <Tex>{`H = ${texPauliSum(coeffs, ['I', 'X', 'Y', 'Z'], { digits: 2, exact: false })}`}</Tex>
        </div>
        <div className="mt-2.5">
          <PauliBars coeffs={coeffs} />
        </div>
        <div className="mt-3 space-y-0.5">
          <KV hl="r" k={<Tex>{'r = \\sqrt{\\epsilon^2 + \\Delta\\omega^2}'}</Tex>} v={fmt(r, 3)} />
          <KV
            hl="v"
            k={<Tex>{'\\vec v = (\\epsilon, 0, \\Delta\\omega)/r'}</Tex>}
            v={v ? `(${fmt(v[0], 3)}, 0, ${fmt(v[2], 3)})` : 'undefined (r = 0)'}
          />
        </div>
        {!v && (
          <Callout tone="warn" title="Degenerate case r = 0">
            <p>
              Then <Tex>{'H = \\bar\\omega I'}</Tex> and the axis <Tex>{'\\vec v'}</Tex> is undefined — but nothing needs it: <Tex>{'U_t = e^{-i\\bar\\omega t} I'}</Tex>, so every state is an
              eigenstate and stays put on the sphere.
            </p>
          </Callout>
        )}
      </Card>

      <Card title="Energy levels" kicker="eigenvalues of H">
        <EnergyDiagram p={p} />
        <div className="space-y-0.5">
          <KV hl="energy" k={<Tex>{'E_\\pm = \\bar\\omega \\pm r'}</Tex>} v={`${fmt(Ep, 3)}, ${fmt(Em, 3)}`} />
          <KV k="gap E₊ − E₋ = 2r" v={fmt(Ep - Em, 3)} />
        </div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-ink-400">
          The coupling ε pushes the levels apart (<Tex>{'r \\ge |\\Delta\\omega|'}</Tex>). Eigenvectors are the Bloch states <Tex>{'\\pm\\vec v'}</Tex>: states on the axis only pick up a phase.
        </p>
      </Card>

      <Card title="Time-evolution operator" kicker={unitary ? 'unitary ✓' : 'not unitary'}>
        <Tex display>
          {`\\hl{U}{U_t} = \\hl{gphase}{e^{-i\\bar\\omega t}}\\big(\\cos(\\hl{r}{r}\\hl{t}{t})\\,I - i\\sin(rt)\\,\\hl{v}{\\vec v}\\cdot\\vec\\sigma\\big) = e^{-i\\bar\\omega t}\\,R_{\\vec v}(\\hl{angle}{2rt})`}
        </Tex>
        <div className="grid grid-cols-3 gap-1.5 text-center text-[12px]">
          <div className="rounded-md bg-ink-800 py-1">
            <Tex>{`\\cos(rt) = ${texReal(Math.cos(r * t), { digits: 2, exact: false })}`}</Tex>
          </div>
          <div className="rounded-md bg-ink-800 py-1">
            <Tex>{`\\sin(rt) = ${texReal(Math.sin(r * t), { digits: 2, exact: false })}`}</Tex>
          </div>
          <div className="rounded-md bg-ink-800 py-1">
            <Tex>{`\\hl{angle}{2rt} = ${texReal(angle, { digits: 2, exact: false })}`}</Tex>
          </div>
        </div>
        <Tex display>{`U_t = ${texMatrix(U, { digits: 3, exact: false })}`}</Tex>
        <div className="space-y-0.5">
          <KV hl="angle" k="rotation angle 2rt (mod 2π)" v={fmtAngle(angle % TWO_PI)} />
          <KV k={<Tex>{'\\|U_t - \\mathrm{expm}(-iHt)\\|'}</Tex>} v={<Tex>{texSci(numErr)}</Tex>} />
        </div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-ink-400">
          The closed form is checked every frame against a general-purpose matrix exponential of <Tex>{'-iHt'}</Tex>.
        </p>
      </Card>

      <Card title="Transition amplitude" kicker="starting from |0⟩">
        <Tex display>{'\\hl{overlap}{\\langle 1|\\psi(t)\\rangle} = -i\\,\\hl{gphase}{e^{-i\\bar\\omega t}}\\,\\frac{\\hl{epsilon}{\\epsilon}}{\\hl{r}{r}}\\sin(\\hl{r}{r}\\hl{t}{t})'}</Tex>
        <Tex display>
          {'\\hl{p1}{P(1,t)} = \\frac{\\hl{epsilon}{\\epsilon}^2}{\\hl{deltaomega}{\\Delta\\omega}^2 + \\hl{epsilon}{\\epsilon}^2}\\,\\sin^2\\!\\Big(\\hl{t}{t}\\sqrt{\\Delta\\omega^2+\\epsilon^2}\\Big)'}
        </Tex>
        {isKet0 ? (
          <div className="space-y-0.5">
            <KV hl="overlap" k="formula ⟨1|ψ(t)⟩" v={<Tex>{texComplex(transitionAmplitude(p, t), { digits: 3, exact: false })}</Tex>} />
            <KV hl="overlap" k="simulated ⟨1|ψ(t)⟩" v={<Tex>{texComplex(psi[1], { digits: 3, exact: false })}</Tex>} />
            <KV hl="p1" k="formula P(1,t)" v={transitionProbability(p, t).toFixed(4)} />
            <KV hl="p1" k="simulated |⟨1|ψ(t)⟩|²" v={p1.toFixed(4)} />
          </div>
        ) : (
          <p className="text-[12px] text-ink-400">Choose ψ(0) = |0⟩ to compare these formulas with the simulation.</p>
        )}
        <div className="mt-2">
          <ProbabilityBars
            items={[
              { label: 'P(0)', p: p0, color: COLORS.p0, hl: 'p0' },
              { label: 'P(1)', p: p1, color: COLORS.p1, hl: 'p1' },
            ]}
          />
        </div>
      </Card>

      <Card title="Oscillation inspector" kicker="read off from H">
        <div className="space-y-0.5">
          <KV hl="r" k="r (half the energy gap)" v={fmt(r, 3)} />
          <KV hl="angle" k="Bloch angular frequency 2r" v={fmt(2 * r, 3)} />
          <KV hl="period" k="period of P(1,t): π/r" v={r > 1e-9 ? fmt(osc.period, 3) : '∞ (no motion)'} />
          <KV hl="period" k="frequency of P(1,t): r/π" v={fmt(r / Math.PI, 3)} />
          <KV hl="pmax" k="max P(1) from |0⟩: ε²/r²" v={fmt(osc.maxTransition, 3)} />
          <KV k="first maximum at t = π/(2r)" v={r > 1e-9 ? fmt(Math.PI / (2 * r), 3) : '—'} />
        </div>
      </Card>

    </>
  );

  return (
    <ModuleShell
      letter="C"
      title="The Schrödinger equation & Hamiltonians"
      intro={
        <p>
          A Hamiltonian is a Hermitian matrix; exponentiating it gives the unitary <Tex>{'e^{-iHt}'}</Tex>, which, up to a global phase, rotates the Bloch sphere about a fixed axis. Adjust{' '}
          <Tex>{'\\bar\\omega'}</Tex>, <Tex>{'\\Delta\\omega'}</Tex> and <Tex>{'\\epsilon'}</Tex>, press play, and watch every representation evolve together.
        </p>
      }
      viz={viz}
      controls={controls}
      panel={panel}
    />
  );
}
