/**
 * Concept challenges: transfer questions. Commit to a prediction, then see the explanation and a
 * linked visualization driven by the actual quantum mechanics.
 */
import { ComponentType, ReactNode, useEffect, useMemo, useState } from 'react';
import { navigate } from '../../layout/router';
import { usePersistentState, useRaf } from '../../hooks/animation';
import { BlochCanvas, StateArrow, Trail, AxisLine, PointMarker, DragHandle, OrbitCircle } from '../../components/bloch';
import { ComplexPlane } from '../../components/ComplexPlane';
import { ProbabilityBars } from '../../components/charts';
import { Tex } from '../../components/Tex';
import { Button, Icon, Slider, Segmented, KV, Label, Swatch } from '../../components/ui';
import { PlaybackBar } from '../../components/Playback';
import { COLORS } from '../../theme';
import {
  Vec2,
  Vec3,
  c,
  abs,
  abs2,
  mul,
  expi,
  vscale,
  apply,
  PX,
  PY,
  matMul,
  matProd,
  stateFromAngles,
  blochVector,
  anglesFromBloch,
  evolveState,
  hamiltonianAxis,
  energies,
  HamiltonianParams,
  Rn,
  KET0,
  stateAlong,
  fidelity,
  texMatrix,
  texKet,
  fmt,
  texAngle,
} from '../../quantum';
import { PerturbationViz, XMeasureViz, SGChainViz, VizCard, Frame } from './widgets';
import { M } from './tex';

const PI = Math.PI;

// ---------------------------------------------------------------------------
// concept-specific visualizations
// ---------------------------------------------------------------------------

function useLoopClock(tMax: number, speed = 1) {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  useRaf((dt) => setT((x) => (x + dt * speed > tMax ? 0 : x + dt * speed)), playing);
  return { t, setT, playing, setPlaying };
}

/** Two Hamiltonians: H₂ = H₁ + sI (same physics) or H₂ = λH₁ (different physics). */
function EnergyLevelsViz() {
  const [mode, setMode] = useState<'shift' | 'scale'>('shift');
  const [s, setS] = useState(1.5);
  const H1: HamiltonianParams = { omegaBar: 0.2, deltaOmega: 0.45, epsilon: 0.5 };
  const H2: HamiltonianParams = mode === 'shift' ? { ...H1, omegaBar: H1.omegaBar + s } : { omegaBar: H1.omegaBar * s, deltaOmega: H1.deltaOmega * s, epsilon: H1.epsilon * s };
  const TMAX = 4 * PI;
  const { t, setT, playing, setPlaying } = useLoopClock(TMAX, 0.8);
  const a = evolveState(H1, KET0, t);
  const b = evolveState(H2, KET0, t);
  const trail = (p: HamiltonianParams) => {
    const pts: Vec3[] = [];
    for (let k = 0; k <= 100; k++) pts.push(blochVector(evolveState(p, KET0, (t * k) / 100)));
    return pts;
  };
  const e1 = energies(H1);
  const e2 = energies(H2);
  const lo = Math.min(e1[0], e2[0], -0.2) - 0.3;
  const hi = Math.max(e1[1], e2[1], 0.2) + 0.3;
  const y = (E: number) => 150 - ((E - lo) / (hi - lo)) * 140;
  return (
    <VizCard title="Two Hamiltonians, one motion?">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_190px]">
        <Frame height={290}>
          <BlochCanvas labels="kets">
            <Trail points={trail(H1)} />
            <Trail points={trail(H2)} color={COLORS.phase} />
            <StateArrow v={blochVector(a)} />
            <StateArrow v={blochVector(b)} color={COLORS.phase} opacity={0.7} />
          </BlochCanvas>
          <div className="pointer-events-none absolute left-2.5 top-2.5 rounded-lg bg-ink-900/75 px-2.5 py-1.5 text-[12px] ring-1 ring-ink-700">
            <Swatch color={COLORS.state}>
              <Tex>{'H_1'}</Tex>
            </Swatch>{' '}
            <Swatch color={COLORS.phase}>
              <Tex>{'H_2'}</Tex>
            </Swatch>
            <div className="mt-0.5 text-ink-300">
              <Tex>{`|\\langle\\psi_1|\\psi_2\\rangle|^2 = ${fmt(fidelity(a, b), 3)}`}</Tex>
            </div>
          </div>
        </Frame>
        <div>
          <Label className="mb-1">energy levels</Label>
          <svg viewBox="0 0 190 160" className="w-full">
            {[
              { e: e1, x: 20, col: COLORS.state, name: 'H₁' },
              { e: e2, x: 110, col: COLORS.phase, name: 'H₂' },
            ].map((L) => (
              <g key={L.name}>
                {L.e.map((E, i) => (
                  <g key={i}>
                    <line x1={L.x} x2={L.x + 60} y1={y(E)} y2={y(E)} stroke={L.col} strokeWidth={2.5} />
                    <text x={L.x + 30} y={y(E) - 4} fill={COLORS.muted} fontSize={9.5} textAnchor="middle">
                      {fmt(E, 2)}
                    </text>
                  </g>
                ))}
                <line x1={L.x + 30} x2={L.x + 30} y1={y(L.e[0]) - 3} y2={y(L.e[1]) + 3} stroke={COLORS.faint} strokeDasharray="2 2" />
                <text x={L.x + 30} y={158} fill={L.col} fontSize={11} textAnchor="middle">
                  {L.name}
                </text>
              </g>
            ))}
          </svg>
          <div className="space-y-0.5 text-[12px]">
            <KV k="gap H₁" v={fmt(e1[1] - e1[0], 3)} />
            <KV k="gap H₂" v={fmt(e2[1] - e2[0], 3)} />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Segmented value={mode} onChange={(m) => { setMode(m); setS(m === 'shift' ? 1.5 : 1.6); }} options={[{ value: 'shift', label: '', tex: 'H_2 = H_1 + sI' }, { value: 'scale', label: '', tex: 'H_2 = sH_1' }]} />
        <div className="min-w-[200px] flex-1">
          <Slider tex="s" value={s} min={mode === 'shift' ? -2 : 0.2} max={mode === 'shift' ? 2 : 2.5} onChange={setS} format={(v) => fmt(v, 2)} color={COLORS.phase} />
        </div>
      </div>
      <PlaybackBar playing={playing} onToggle={() => setPlaying(!playing)} onReset={() => setT(0)} />
    </VizCard>
  );
}

/** Which rule turns amplitudes into probabilities? */
function AmplitudeRulesViz() {
  const [theta, setTheta] = useState(1.1);
  const [phi, setPhi] = useState(2.2);
  const [gamma, setGamma] = useState(0.6);
  const psi = vscale(stateFromAngles(theta, phi), expi(gamma));
  const [a, b] = psi;
  const rules: { name: string; f: (z: typeof a) => typeof a }[] = [
    { name: '\\mathrm{Re}\\,z', f: (z) => c(z.re) },
    { name: '|z|', f: (z) => c(abs(z)) },
    { name: 'z^2', f: (z) => mul(z, z) },
    { name: '|z|^2', f: (z) => c(abs2(z)) },
  ];
  const fmtC = (z: { re: number; im: number }) => (Math.abs(z.im) < 5e-4 ? fmt(z.re, 3) : `${fmt(z.re, 2)}${z.im < 0 ? '−' : '+'}${fmt(Math.abs(z.im), 2)}i`);
  const ok = (cond: boolean) => <span className={cond ? 'text-good' : 'text-bad'}>{cond ? '✓' : '✗'}</span>;
  return (
    <VizCard title="Candidate rules: amplitude → probability">
      <div className="grid items-center gap-3 sm:grid-cols-[170px_minmax(0,1fr)]">
        <ComplexPlane
          amplitudes={[
            { z: a, color: COLORS.p0, label: '\\alpha' },
            { z: b, color: COLORS.p1, label: '\\beta' },
          ]}
        />
        <div className="space-y-3">
          <Slider tex="\theta" value={theta} min={0} max={PI} onChange={setTheta} format={(v) => texAngle(v, { inline: true })} />
          <Slider tex="\varphi" label="relative phase" value={phi} min={0} max={2 * PI} onChange={setPhi} format={(v) => texAngle(v, { inline: true })} color={COLORS.phase} />
          <Slider tex="\gamma" label="global phase" value={gamma} min={0} max={2 * PI} onChange={setGamma} format={(v) => texAngle(v, { inline: true })} color={COLORS.phase} />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[440px] text-[12.5px]">
          <thead className="text-[11.5px] text-ink-400">
            <tr>
              <th className="pb-1 text-left font-normal">rule p(z)</th>
              <th className="pb-1 text-right font-normal">p(α)</th>
              <th className="pb-1 text-right font-normal">p(β)</th>
              <th className="pb-1 text-center font-normal">real, ≥ 0</th>
              <th className="pb-1 text-center font-normal">p(α)+p(β) = 1</th>
              <th className="pb-1 text-center font-normal">ignores e^(iγ)</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {rules.map((r) => {
              const pa = r.f(a);
              const pb = r.f(b);
              const real = Math.abs(pa.im) < 1e-9 && Math.abs(pb.im) < 1e-9 && pa.re >= -1e-12 && pb.re >= -1e-12;
              const sum1 = Math.abs(pa.re + pb.re - 1) < 1e-6 && Math.abs(pa.im + pb.im) < 1e-6;
              // invariance under an extra global phase e^{i}
              const pa2 = r.f(mul(a, expi(1)));
              const blind = Math.abs(pa2.re - pa.re) < 1e-9 && Math.abs(pa2.im - pa.im) < 1e-9;
              return (
                <tr key={r.name} className={`border-t border-ink-800 ${r.name === '|z|^2' ? 'bg-good/[0.05]' : ''}`}>
                  <td className="py-1 font-sans">
                    <Tex>{r.name}</Tex>
                  </td>
                  <td className="py-1 text-right">{fmtC(pa)}</td>
                  <td className="py-1 text-right">{fmtC(pb)}</td>
                  <td className="py-1 text-center">{ok(real)}</td>
                  <td className="py-1 text-center">{ok(sum1)}</td>
                  <td className="py-1 text-center">{ok(blind)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[12px] leading-relaxed text-ink-400">
        Move the sliders: only <Tex>{'|z|^2'}</Tex> is always real and non-negative, sums to one for every normalized state, and ignores the global phase.
      </p>
    </VizCard>
  );
}

/** R_n(φ) for φ ∈ [0, 4π]: back on the sphere after 2π, back in Hilbert space only after 4π. */
function TwoPiViz() {
  const [phi, setPhi] = useState(0);
  const [playing, setPlaying] = useState(false);
  useRaf((dt) => setPhi((p) => (p + dt * 1.2 > 4 * PI ? 0 : p + dt * 1.2)), playing);
  const n: Vec3 = [0, 0.6, 0.8];
  const psi0 = stateFromAngles(PI / 2, 0);
  const U = Rn(n, phi);
  const psi = apply(U, psi0);
  const trail = useMemo(() => {
    const pts: Vec3[] = [];
    for (let k = 0; k <= 120; k++) pts.push(blochVector(apply(Rn(n, (Math.min(phi, 2 * PI) * k) / 120), psi0)));
    return pts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phi]);
  return (
    <VizCard title="A full turn of the sphere">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_200px]">
        <Frame height={280}>
          <BlochCanvas labels="kets">
            <AxisLine n={n} color={COLORS.axis} label="\vec n" />
            <OrbitCircle n={n} through={blochVector(psi0)} />
            <Trail points={trail} fade={false} />
            <StateArrow v={blochVector(psi)} />
          </BlochCanvas>
          <div className="pointer-events-none absolute left-2.5 top-2.5 rounded-lg bg-ink-900/75 px-2.5 py-1.5 text-[12px] ring-1 ring-ink-700">
            <Tex>{`R_{\\vec n}(${texAngle(phi, { inline: true })}) = ${texMatrix(U, { digits: 2 })}`}</Tex>
          </div>
        </Frame>
        <div className="space-y-2">
          <Label>amplitudes</Label>
          <ComplexPlane
            amplitudes={[
              { z: psi[0], color: COLORS.p0, label: '\\alpha' },
              { z: psi[1], color: COLORS.p1, label: '\\beta' },
            ]}
            ghosts={[
              { z: psi0[0], color: COLORS.p0, label: '' },
              { z: psi0[1], color: COLORS.p1, label: '' },
            ]}
          />
          <KV k={<Tex>{'\\langle\\psi_0|\\psi\\rangle'}</Tex>} v={fmt(psi0[0].re * psi[0].re + psi0[0].im * psi[0].im + psi0[1].re * psi[1].re + psi0[1].im * psi[1].im, 3)} />
        </div>
      </div>
      <Slider tex="\varphi" label="rotation angle" value={phi} min={0} max={4 * PI} onChange={(v) => { setPlaying(false); setPhi(v); }} format={(v) => texAngle(v, { inline: true })} marks={[{ value: 2 * PI, tex: '2\\pi' }, { value: 4 * PI, tex: '4\\pi' }]} />
      <PlaybackBar playing={playing} onToggle={() => setPlaying(!playing)} onReset={() => { setPlaying(false); setPhi(0); }} />
      <p className="text-[12.5px] text-ink-400">
        At <Tex>{'\\varphi = 2\\pi'}</Tex> the arrow is home but the amplitudes are negated (dashed: initial). Only at <Tex>{'4\\pi'}</Tex> do they return.
      </p>
    </VizCard>
  );
}

/** Global phase: amplitudes spin, everything observable stays put. */
function GlobalPhaseViz() {
  const [gamma, setGamma] = useState(0);
  const [playing, setPlaying] = useState(true);
  useRaf((dt) => setGamma((g) => (g + dt * 0.9) % (2 * PI)), playing);
  const base = stateFromAngles(1.0, 0.8);
  const psi = vscale(base, expi(gamma));
  const r = blochVector(psi);
  return (
    <VizCard title="Multiply by e^{iγ}">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_200px]">
        <Frame height={260}>
          <BlochCanvas labels="kets">
            <StateArrow v={r} />
          </BlochCanvas>
          <div className="pointer-events-none absolute left-2.5 top-2.5 rounded-lg bg-ink-900/75 px-2.5 py-1.5 text-[12px] ring-1 ring-ink-700">
            <Tex>{`e^{i\\gamma}\\ket\\psi = ${texKet(psi, { digits: 2, exact: false })}`}</Tex>
          </div>
        </Frame>
        <ComplexPlane
          amplitudes={[
            { z: psi[0], color: COLORS.p0, label: '\\alpha' },
            { z: psi[1], color: COLORS.p1, label: '\\beta' },
          ]}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="mb-1">Z basis</Label>
          <ProbabilityBars items={[{ label: 'P(0)', p: abs2(psi[0]), color: COLORS.p0 }, { label: 'P(1)', p: abs2(psi[1]), color: COLORS.p1 }]} />
        </div>
        <div>
          <Label className="mb-1">X basis</Label>
          <ProbabilityBars items={[{ label: 'P(+)', p: (1 + r[0]) / 2, color: COLORS.p0 }, { label: 'P(-)', p: (1 - r[0]) / 2, color: COLORS.p1 }]} />
        </div>
      </div>
      <Slider tex="\gamma" value={gamma} min={0} max={2 * PI} onChange={(v) => { setPlaying(false); setGamma(v); }} format={(v) => texAngle(v, { inline: true })} color={COLORS.phase} />
      <PlaybackBar playing={playing} onToggle={() => setPlaying(!playing)} />
    </VizCard>
  );
}

/** Eigenstates of H are stationary. */
function StationaryViz() {
  const [p, setP] = useState<HamiltonianParams>({ omegaBar: 0.3, deltaOmega: 0.4, epsilon: 0.55 });
  const [init, setInit] = useState<'0' | 'plus' | 'minus'>('plus');
  const TMAX = 4 * PI;
  const { t, setT, playing, setPlaying } = useLoopClock(TMAX, 0.9);
  const { v } = hamiltonianAxis(p);
  const E = energies(p);
  const psi0: Vec2 = init === '0' || !v ? KET0 : init === 'plus' ? stateAlong(v) : stateAlong([-v[0], -v[1], -v[2]]);
  const psi = evolveState(p, psi0, t);
  const trail = useMemo(() => {
    const pts: Vec3[] = [];
    for (let k = 0; k <= 100; k++) pts.push(blochVector(evolveState(p, psi0, (t * k) / 100)));
    return pts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p, init, t]);
  return (
    <VizCard title="Energy eigenstates only pick up a phase">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_200px]">
        <Frame height={280}>
          <BlochCanvas labels="kets">
            {v && <AxisLine n={v} color={COLORS.axis} label="\vec v" />}
            {v && <PointMarker v={v} color={COLORS.p0} ring label={`E_+ = ${fmt(E[1], 2)}`} />}
            {v && <PointMarker v={[-v[0], -v[1], -v[2]]} color={COLORS.p1} ring label={`E_- = ${fmt(E[0], 2)}`} />}
            <Trail points={trail} />
            <StateArrow v={blochVector(psi)} />
          </BlochCanvas>
        </Frame>
        <div className="space-y-2">
          <Label>amplitudes</Label>
          <ComplexPlane
            amplitudes={[
              { z: psi[0], color: COLORS.p0, label: '\\alpha' },
              { z: psi[1], color: COLORS.p1, label: '\\beta' },
            ]}
          />
          <p className="text-[11.5px] leading-snug text-ink-400">For an eigenstate both amplitudes turn together at rate {M`E`}: a global phase {M`e^{-iEt}`}.</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Label>start in</Label>
        <Segmented value={init} onChange={(x) => { setInit(x); setT(0); }} options={[{ value: '0', label: '', tex: '\\ket0' }, { value: 'plus', label: '', tex: '\\ket{E_+}' }, { value: 'minus', label: '', tex: '\\ket{E_-}' }]} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Slider tex="\bar\omega" value={p.omegaBar} min={-2} max={2} onChange={(x) => setP({ ...p, omegaBar: x })} format={(x) => fmt(x, 2)} />
        <Slider tex="\Delta\omega" value={p.deltaOmega} min={-1.5} max={1.5} onChange={(x) => setP({ ...p, deltaOmega: x })} format={(x) => fmt(x, 2)} />
        <Slider tex="\varepsilon" value={p.epsilon} min={-1.5} max={1.5} onChange={(x) => setP({ ...p, epsilon: x })} format={(x) => fmt(x, 2)} />
      </div>
      <PlaybackBar playing={playing} onToggle={() => setPlaying(!playing)} onReset={() => setT(0)} />
    </VizCard>
  );
}

/** XY vs YX on a state, and conjugation X Y X = −Y. */
function AnticommuteViz() {
  const [s, setS] = useState<Vec3>(() => blochVector(stateFromAngles(1.0, 0.7)));
  const psi = useMemo(() => {
    const a = anglesFromBloch(s);
    return stateFromAngles(a.theta, a.phi);
  }, [s]);
  const xy = apply(matMul(PX, PY), psi);
  const yx = apply(matMul(PY, PX), psi);
  const xyx = matProd(PX, PY, PX);
  return (
    <VizCard title="XY|ψ⟩ vs YX|ψ⟩">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_200px]">
        <Frame height={280}>
          <BlochCanvas labels="both">
            <StateArrow v={s} color={COLORS.faint} />
            <DragHandle v={s} onChange={setS} color={COLORS.muted} />
            <StateArrow v={blochVector(xy)} color={COLORS.p0} />
            <StateArrow v={blochVector(yx)} color={COLORS.p1} opacity={0.6} />
            <AxisLine n={[0, 1, 0]} color={COLORS.phase} label="Y" length={1.25} />
            <AxisLine n={[0, -1, 0]} color={COLORS.axis} dashed label="XYX" length={1.25} />
          </BlochCanvas>
          <div className="pointer-events-none absolute left-2.5 top-2.5 rounded-lg bg-ink-900/75 px-2.5 py-1.5 text-[12px] ring-1 ring-ink-700">
            <Swatch color={COLORS.p0}>
              <Tex>{'XY\\ket\\psi'}</Tex>
            </Swatch>{' '}
            <Swatch color={COLORS.p1}>
              <Tex>{'YX\\ket\\psi'}</Tex>
            </Swatch>
          </div>
        </Frame>
        <div className="space-y-2 text-[12.5px]">
          <Label>amplitudes</Label>
          <ComplexPlane
            amplitudes={[
              { z: xy[0], color: COLORS.p0, label: '' },
              { z: xy[1], color: COLORS.p0, label: '' },
            ]}
            ghosts={[
              { z: yx[0], color: COLORS.p1, label: '' },
              { z: yx[1], color: COLORS.p1, label: '' },
            ]}
            showRelative={false}
          />
          <KV k={<Tex>{'|\\langle XY\\psi|YX\\psi\\rangle|^2'}</Tex>} v={fmt(fidelity(xy, yx), 3)} />
          <Tex display>{`XYX = ${texMatrix(xyx)} = -Y`}</Tex>
        </div>
      </div>
      <p className="text-[12.5px] leading-relaxed text-ink-400">
        The amplitudes of <Tex>{'YX\\ket\\psi'}</Tex> (dashed) are exactly the negatives of those of <Tex>{'XY\\ket\\psi'}</Tex> — the same Bloch vector. Anticommutation becomes visible as
        conjugation: <Tex>{'XYX = -Y'}</Tex> points the Y axis the other way.
      </p>
    </VizCard>
  );
}

// ---------------------------------------------------------------------------
// the challenges
// ---------------------------------------------------------------------------

interface Concept {
  id: string;
  title: string;
  question: ReactNode;
  options: { id: string; label: ReactNode; feedback?: ReactNode }[];
  answer: string;
  explanation: ReactNode;
  Viz: ComponentType;
  explore: { path: string; label: string };
}

const CONCEPTS: Concept[] = [
  {
    id: 'identity',
    title: 'Raising the identity component',
    question: <>What changes on the Bloch sphere when the identity component {M`\bar\omega`} of a Hamiltonian {M`H = \bar\omega I + \epsilon X + \Delta\omega Z`} is increased?</>,
    options: [
      { id: 'a', label: 'The precession speeds up.', feedback: <>The precession rate is {M`2r = 2\sqrt{\epsilon^2+\Delta\omega^2}`} — independent of {M`\bar\omega`}.</> },
      { id: 'b', label: 'Nothing at all — only the global phase rotates faster.' },
      { id: 'c', label: 'The rotation axis tilts towards z.', feedback: <>The axis {M`\vec v = (\epsilon,0,\Delta\omega)/r`} doesn't contain {M`\bar\omega`}.</> },
      { id: 'd', label: 'The state is pushed towards the lower-energy pole.', feedback: 'Unitary evolution never relaxes a state; and both energies shift equally anyway.' },
    ],
    answer: 'b',
    explanation: (
      <p>
        {M`e^{-iHt} = e^{-i\bar\omega t}\,e^{-irt(\vec v\cdot\vec\sigma)}`}: the identity part factors out as a pure global phase, because {M`I`} commutes with everything. Slide {M`\bar\omega`} in the
        visualization: the pencil "shifted" arrow sits exactly on top of the ink one, while in the complex plane the amplitudes spin at a different rate.
      </p>
    ),
    Viz: () => (
      <PerturbationViz
        mode="pauli"
        initial={{ omegaBar: 0, deltaOmega: 0.5, epsilon: 0.6 }}
        compareShift={1.5}
        title="Ghost: the same H with ω̄ raised by 1.5"
        note={<>Ghost arrow and dashed amplitudes: {M`H + 1.5\,I`}. On the sphere they coincide with {M`H`}; only the amplitudes' common phase differs.</>}
      />
    ),
    explore: { path: '/hamiltonian', label: 'Hamiltonian playground' },
  },
  {
    id: 'same-evolution',
    title: 'Different eigenvalues, same motion',
    question: 'Why do two Hamiltonians with different eigenvalues sometimes produce identical observable evolution?',
    options: [
      { id: 'a', label: 'Because only the eigenvectors matter, never the eigenvalues.', feedback: <>Switch to {M`H_2 = sH_1`}: same eigenvectors, different eigenvalues — and a visibly different (faster/slower) motion.</> },
      { id: 'b', label: 'Because they differ by a multiple of the identity: same eigenvectors and same energy differences; the common shift is a global phase.' },
      { id: 'c', label: 'Because all single-qubit Hamiltonians generate the same evolution.', feedback: 'The axis and speed both depend on H.' },
      { id: 'd', label: 'Because measurement destroys the information.', feedback: 'This is about unitary evolution, before any measurement.' },
    ],
    answer: 'b',
    explanation: (
      <p>
        If {M`H_2 = H_1 + sI`}, then {M`e^{-iH_2t} = e^{-ist}e^{-iH_1t}`}: every state differs by the global phase {M`e^{-ist}`}. The level diagram shows both spectra shifted rigidly — the gap,
        which sets the precession speed, is unchanged. Scaling {M`H`} changes the gap, and the motion with it.
      </p>
    ),
    Viz: EnergyLevelsViz,
    explore: { path: '/hamiltonian', label: 'Hamiltonian playground' },
  },
  {
    id: 'sg30',
    title: 'Tilting the magnet by 30°',
    question: <>A beam of {M`\ket0`} atoms enters a Stern–Gerlach magnet whose axis is rotated by 30° from z (in the xz-plane). What fraction goes into the + beam?</>,
    options: [
      { id: 'a', label: <>{M`\cos 30^\circ \approx 86.6\%`}</>, feedback: 'That would be an amplitude-like rule. Probabilities follow the half-angle squared.' },
      { id: 'b', label: <>{M`\cos^2 30^\circ = 75\%`}</>, feedback: <>Half-angles: the Bloch angle between state and axis is 30°, so use {M`\cos^2(30^\circ/2)`}.</> },
      { id: 'c', label: <>{M`\cos^2 15^\circ \approx 93.3\%`}</> },
      { id: 'd', label: '50 %, as for any axis other than z.', feedback: 'Only perpendicular axes give 50 %.' },
    ],
    answer: 'c',
    explanation: (
      <p>
        {M`P(+) = \tfrac12(1 + \vec n\cdot\vec r) = \tfrac12(1+\cos 30^\circ) = \cos^2 15^\circ \approx 0.933`}. The {M`-`} beam gets {M`\sin^2 15^\circ \approx 6.7\%`}. Use the axis slider: 0° gives
        certainty, 90° gives 50/50, 180° flips the outcome.
      </p>
    ),
    Viz: () => <XMeasureViz axisTiltControl initialTilt={PI / 6} />,
    explore: { path: '/stern-gerlach', label: 'Stern–Gerlach with an arbitrary axis' },
  },
  {
    id: 'born',
    title: 'Why squared magnitudes?',
    question: 'Why is a measurement probability computed with the squared magnitude |z|² of a complex amplitude, rather than, say, Re z or |z|?',
    options: [
      { id: 'a', label: 'It is the only simple rule that is real, non-negative, sums to 1 for every normalized state, and ignores the global phase.' },
      { id: 'b', label: 'Because amplitudes are always real in the end.', feedback: 'Amplitudes are genuinely complex; their phases matter for interference.' },
      { id: 'c', label: 'Because |z| can exceed 1.', feedback: 'For a normalized state |z| ≤ 1 anyway; the problem is that |α| + |β| ≠ 1.' },
      { id: 'd', label: 'It is an arbitrary convention.', feedback: 'Check the table: the other candidates violate basic requirements.' },
    ],
    answer: 'a',
    explanation: (
      <p>
        Normalization is {M`|\alpha|^2 + |\beta|^2 = 1`} — the Pythagorean length of the state vector, preserved by unitaries. So {M`|z|^2`} automatically gives a probability distribution for every
        state and every basis, at all times. {M`\mathrm{Re}\,z`} can be negative, {M`z^2`} is complex, and {M`|\alpha| + |\beta|`} is not 1 (try {M`\ket+`}: {M`\sqrt2`}).
      </p>
    ),
    Viz: AmplitudeRulesViz,
    explore: { path: '/bloch', label: 'Amplitudes & probabilities' },
  },
  {
    id: 'twopi',
    title: 'A 2π rotation',
    question: <>{M`R_{\vec n}(2\pi) = -I`}. Can you detect this minus sign by measuring a single qubit that was rotated by {M`2\pi`}?</>,
    options: [
      { id: 'a', label: 'Yes — the Bloch vector ends up reversed.', feedback: <>{M`-\ket\psi`} has the same Bloch vector as {M`\ket\psi`}.</> },
      { id: 'b', label: <>No — {M`-1`} is a global phase. It becomes observable only relative to a reference, e.g. when the rotation is applied to one branch of a superposition (controlled-{M`R`}).</> },
      { id: 'c', label: 'Yes — the probabilities change sign.', feedback: 'Probabilities are |z|²: never negative, unchanged by a sign.' },
    ],
    answer: 'b',
    explanation: (
      <p>
        The sign {M`-1 = e^{i\pi}`} multiplies every amplitude equally. Spinors need {M`4\pi`} to return — visible in the complex plane — but for an isolated qubit this is unobservable. Neutron
        interferometers make it visible by rotating only one arm and interfering it with the other.
      </p>
    ),
    Viz: TwoPiViz,
    explore: { path: '/gates', label: 'Rotation gates' },
  },
  {
    id: 'bloch-phase',
    title: 'Where is the global phase?',
    question: 'Why can the Bloch sphere not show the global phase of a state?',
    options: [
      { id: 'a', label: 'It could, but it is omitted to keep the picture simple.', feedback: 'No measurement can reveal it, so there is nothing physical to draw.' },
      { id: 'b', label: <>The Bloch vector {M`\langle\psi|\vec\sigma|\psi\rangle`} is built from {M`\bar\alpha\beta`} and {M`|\alpha|^2, |\beta|^2`}, all unchanged by {M`\ket\psi\to e^{i\gamma}\ket\psi`} — and so is every probability.</> },
      { id: 'c', label: 'Because the global phase is always zero.', feedback: 'Amplitudes can carry any common phase — watch them spin in the complex plane.' },
    ],
    answer: 'b',
    explanation: (
      <p>
        A qubit vector has 4 real parameters; normalization removes one and the unobservable phase another, leaving the 2 angles {M`(\theta,\varphi)`} of the sphere. Each point of the sphere stands for a
        whole circle {M`\{e^{i\gamma}\ket\psi\}`} of physically identical vectors.
      </p>
    ),
    Viz: GlobalPhaseViz,
    explore: { path: '/bloch', label: 'Global-phase experiment' },
  },
  {
    id: 'eigenvalues',
    title: 'What eigenvalues of H mean',
    question: <>A qubit starts in an eigenstate {M`\ket{E_+}`} of {M`H`}. How does it evolve?</>,
    options: [
      { id: 'a', label: <>It doesn't change physically: {M`\ket{\psi(t)} = e^{-iE_+t}\ket{E_+}`}. The eigenvalue is the energy, i.e. the rate of the phase.</> },
      { id: 'b', label: 'It precesses around the axis v like every other state.', feedback: 'Points on the rotation axis stay fixed under the rotation.' },
      { id: 'c', label: <>It decays to {M`\ket{E_-}`}, the lower energy.</>, feedback: 'Unitary evolution has no decay; that needs coupling to an environment.' },
    ],
    answer: 'a',
    explanation: (
      <p>
        Eigenstates lie on the rotation axis {M`\pm\vec v`}, so the rotation leaves them in place — they are <em>stationary states</em>. The eigenvalues {M`E_\pm = \bar\omega\pm r`} are energies; only their
        difference {M`2r`} appears as a precession frequency for superpositions.
      </p>
    ),
    Viz: StationaryViz,
    explore: { path: '/hamiltonian', label: 'Hamiltonian playground' },
  },
  {
    id: 'remove-x',
    title: 'Is it the X magnet?',
    question: 'In Z (select ↑) → X (select +) → Z the final screen shows 50 % ↑. What if the middle X magnet is removed?',
    options: [
      { id: 'a', label: 'Still 50 % ↑ — the atoms forget their spin in flight.', feedback: 'Then repeated Z measurements would disagree, which is not observed.' },
      { id: 'b', label: '100 % ↑ — it is the X measurement that erases the Z information.' },
      { id: 'c', label: '0 % ↑.', feedback: 'Nothing flips |0⟩ to |1⟩ without a magnet.' },
    ],
    answer: 'b',
    explanation: <p>{M`|\langle0|0\rangle|^2 = 1`}. The X magnet projects onto {M`\ket+`}, which is equidistant from both Z poles; without it, the state stays {M`\ket0`}. Toggle the middle magnet and fire atoms.</p>,
    Viz: () => <SGChainViz />,
    explore: { path: '/stern-gerlach', label: 'Stern–Gerlach simulator' },
  },
  {
    id: 'detuning',
    title: 'Large splitting, few transitions',
    question: <>Why does a large energy splitting {M`\Delta\omega \gg \epsilon`} suppress transitions from {M`\ket0`} to {M`\ket1`}?</>,
    options: [
      { id: 'a', label: <>The rotation axis {M`\vec v`} tilts toward z, so {M`\ket0`} only circles on a narrow cone: {M`P_{\max} = \epsilon^2/(\epsilon^2+\Delta\omega^2)`}.</> },
      { id: 'b', label: 'The evolution becomes slower.', feedback: <>It becomes <em>faster</em> ({M`r`} grows) — but with a tiny amplitude.</> },
      { id: 'c', label: 'Large Hamiltonians are not unitary.', feedback: 'e^{−iHt} is unitary for any Hermitian H.' },
    ],
    answer: 'a',
    explanation: (
      <p>
        The coupling {M`\epsilon`} tries to rotate about x, the splitting about z; the net axis is their vector sum. With {M`\Delta\omega \gg \epsilon`} the axis is almost z and the north pole barely moves.
        This is the "detuning" of a drive from resonance.
      </p>
    ),
    Viz: () => <PerturbationViz mode="pauli" initial={{ omegaBar: 0, deltaOmega: 1.2, epsilon: 0.3 }} title="Detuned: Δω ≫ ε" />,
    explore: { path: '/hamiltonian', label: 'Hamiltonian playground' },
  },
  {
    id: 'anti-pi',
    title: 'Anticommuting gates',
    question: <>{M`X`} and {M`Y`} anticommute: {M`XY = -YX`}. Applied to the same qubit, "X then Y" and "Y then X" give…</>,
    options: [
      { id: 'a', label: 'opposite Bloch vectors.', feedback: 'A sign on the whole state is a global phase.' },
      { id: 'b', label: 'the same physical state.' },
      { id: 'c', label: 'states 90° apart.', feedback: 'Drag the state and compare the two arrows.' },
    ],
    answer: 'b',
    explanation: (
      <p>
        {M`YX\ket\psi = -XY\ket\psi`}: the same ray. As π-rotations, {M`R_x(\pi)`} and {M`R_y(\pi)`} compose to a π-rotation about z in either order. Anticommutation shows up when one operator is
        conjugated by the other: {M`XYX = -Y`}, a half-turn about x reverses the y axis.
      </p>
    ),
    Viz: AnticommuteViz,
    explore: { path: '/pauli', label: 'Pauli algebra' },
  },
];

// ---------------------------------------------------------------------------
// page
// ---------------------------------------------------------------------------

function Quiz({ concept, chosen, onChoose }: { concept: Concept; chosen: string | undefined; onChoose: (id: string | null) => void }) {
  const [sel, setSel] = useState<string | null>(chosen ?? null);
  useEffect(() => setSel(chosen ?? null), [chosen, concept.id]);
  const committed = chosen !== undefined;
  const right = chosen === concept.answer;
  const fb = committed ? concept.options.find((o) => o.id === chosen)?.feedback : null;
  return (
    <div className="rounded-[10px] bg-ink-850 p-4 ring-1 ring-inset ring-ink-700">
      <div className="mb-2 font-mono text-[10.5px] tracking-[0.05em] text-ink-400">predict first</div>
      <div className="prose-q mb-3 text-[14.5px] text-ink-100">{concept.question}</div>
      <div className="space-y-1.5">
        {concept.options.map((o) => {
          const isSel = sel === o.id;
          const good = committed && o.id === concept.answer;
          const bad = committed && isSel && o.id !== concept.answer;
          return (
            <button
              key={o.id}
              disabled={committed}
              onClick={() => setSel(o.id)}
              className={`flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] ring-1 ring-inset transition-colors ${
                good ? 'bg-good/10 text-ink-100 ring-good/50' : bad ? 'bg-bad/10 text-ink-100 ring-bad/40' : isSel ? 'bg-ink-700 text-ink-100 ring-state/50' : 'bg-ink-800/60 text-ink-200 ring-ink-700 hover:bg-ink-750'
              }`}
            >
              <span className={`mt-[3px] h-3 w-3 shrink-0 rounded-full border ${isSel ? 'border-state bg-state' : 'border-ink-400'}`} />
              <span className="min-w-0">{o.label}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex gap-2">
        {!committed ? (
          <Button variant="primary" size="sm" disabled={!sel} onClick={() => sel && onChoose(sel)}>
            Lock in prediction
          </Button>
        ) : (
          <Button size="sm" onClick={() => onChoose(null)}>
            Try again
          </Button>
        )}
      </div>
      {committed && (
        <div className="mt-3 animate-fadein rounded-lg bg-ink-800/80 p-3 ring-1 ring-inset ring-ink-700">
          <div className={`mb-1 text-[12.5px] font-semibold ${right ? 'text-good' : 'text-p1'}`}>{right ? 'Right.' : 'Not quite.'}</div>
          {!right && fb && <div className="prose-q mb-2 text-[13px]">{fb}</div>}
          <div className="prose-q text-[13px]">{concept.explanation}</div>
        </div>
      )}
    </div>
  );
}

export default function ConceptsModule({ subpath }: { subpath: string }) {
  const [answers, setAnswers] = usePersistentState<Record<string, string>>('qp.concepts.v1', {});
  const concept = CONCEPTS.find((x) => x.id === subpath) ?? CONCEPTS[0];
  const idx = CONCEPTS.indexOf(concept);
  const Viz = concept.Viz;
  useEffect(() => {
    document.getElementById('main-scroll')?.scrollTo({ top: 0 });
  }, [concept.id]);
  const done = CONCEPTS.filter((x) => answers[x.id] !== undefined).length;
  return (
    <div className="mx-auto w-full max-w-[1560px] px-4 pb-16 pt-7 lg:px-8">
      <div className="font-mono text-[11px] tracking-[0.06em] text-ink-400">transfer</div>
      <h1 className="mt-1.5 text-[30px] font-semibold leading-[1.06] tracking-[-0.02em] text-ink-100 lg:text-[40px]">Concept challenges</h1>
      <p className="mt-2 max-w-[860px] text-[14px] leading-relaxed text-ink-300">
        Questions that test understanding rather than algebra. Commit to a prediction, then check it against the explanation and the live simulation. {done}/{CONCEPTS.length} answered.
      </p>
      <div className="mt-4 grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)]">
        <nav className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
          {CONCEPTS.map((x, i) => {
            const on = x.id === concept.id;
            const a = answers[x.id];
            return (
              <button
                key={x.id}
                onClick={() => navigate(`/concepts/${x.id}`)}
                className={`flex shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors lg:w-full ${on ? 'bg-ink-750 text-ink-100 ring-1 ring-inset ring-ink-600' : 'text-ink-300 hover:bg-ink-800'}`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10.5px] font-semibold ${
                    a === undefined ? 'bg-ink-800 text-ink-400' : a === x.answer ? 'bg-good/20 text-good' : 'bg-p1/20 text-p1'
                  }`}
                >
                  {a === undefined ? i + 1 : a === x.answer ? '✓' : '·'}
                </span>
                <span className="whitespace-nowrap lg:whitespace-normal">{x.title}</span>
              </button>
            );
          })}
        </nav>
        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-3">
            <Quiz
              concept={concept}
              chosen={answers[concept.id]}
              onChoose={(id) =>
                setAnswers((p) => {
                  const n = { ...p };
                  if (id === null) delete n[concept.id];
                  else n[concept.id] = id;
                  return n;
                })
              }
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => navigate(concept.explore.path)}>
                Explore: {concept.explore.label} {Icon.arrowR}
              </Button>
              <div className="ml-auto flex gap-1.5">
                <Button size="sm" variant="ghost" disabled={idx === 0} onClick={() => navigate(`/concepts/${CONCEPTS[idx - 1].id}`)}>
                  {Icon.arrowL}
                </Button>
                <Button size="sm" variant="ghost" disabled={idx === CONCEPTS.length - 1} onClick={() => navigate(`/concepts/${CONCEPTS[idx + 1].id}`)}>
                  next {Icon.arrowR}
                </Button>
              </div>
            </div>
          </div>
          <div className="min-w-0">
            <Viz key={concept.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
