import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { ModuleShell } from '../../layout/ModuleShell';
import { BlochCanvas, StateArrow, AxisLine, PointMarker, Arrow } from '../../components/bloch';
import { Histogram } from '../../components/charts';
import { Tex } from '../../components/Tex';
import { Card, Slider, Button, KV, Callout, Label, Segmented, Toggle } from '../../components/ui';
import { PlaybackBar } from '../../components/Playback';
import { PredictionCard } from '../../components/Prediction';
import { HighlightProvider } from '../../components/Highlight';
import { COLORS } from '../../theme';
import { PRESETS, predictChain, len3, scale3, angleBetween, dot3, texAngle, fmt, texReal } from '../../quantum';
import {
  SGEngine,
  StageCfg,
  SourceCfg,
  Stats,
  AxisKind,
  PRESETS_SG,
  stage,
  axisOf,
  outcomeLabels,
  axisName,
  toCoreStages,
  sourceDensity,
  chainTheory,
  computeLayout,
} from './sim';
import { BeamLine } from './BeamLine';

const TIPS: Record<string, string> = {
  n: 'n — the measurement direction set by the magnet orientation. It defines the basis {|+n⟩, |−n⟩}.',
  rin: 'r_in — Bloch vector of the state entering this magnet (length < 1 for a mixed beam; 0 for an unpolarized oven).',
  delta: 'Δ — angle on the Bloch sphere between the incoming state and the measurement axis.',
};

const AXIS_OPTIONS: { value: AxisKind; label: string; tex?: string; title: string }[] = [
  { value: 'Z', label: 'Z', tex: 'Z', title: 'field along z' },
  { value: 'X', label: 'X', tex: 'X', title: 'field along x' },
  { value: 'Y', label: 'Y', tex: 'Y', title: 'field along y' },
  { value: 'tilt', label: 'tilt', title: 'rotate from z toward x' },
  { value: 'n', label: 'n', tex: '\\vec n', title: 'arbitrary direction' },
];

const sameStages = (a: StageCfg[], b: StageCfg[]) =>
  a.length === b.length &&
  a.every((s, i) => s.kind === b[i].kind && s.pass === b[i].pass && (s.kind !== 'tilt' || Math.abs(s.tilt - b[i].tilt) < 1e-9) && (s.kind !== 'n' || (s.theta === b[i].theta && s.phi === b[i].phi)));

interface PresetStory {
  question: ReactNode;
  options: { id: string; label: ReactNode }[];
  answer: string;
  explanation: ReactNode;
}

const STORIES: Record<string, PresetStory> = {
  Z: {
    question: <>Hot atoms with randomly oriented magnetic moments fly through one Z magnet. What appears on the screen?</>,
    options: [
      { id: 'smear', label: 'A continuous smear (random dipole orientations).' },
      { id: 'two', label: 'Two separate spots of equal intensity.' },
      { id: 'one', label: 'A single undeflected spot.' },
    ],
    answer: 'two',
    explanation: (
      <>
        <p>
          Only two deflections ever occur: the measured spin component is quantized, with eigenvalues <Tex>{'\\pm1'}</Tex> of <Tex>{'Z'}</Tex>. For the unpolarized beam{' '}
          <Tex>{'\\rho = I/2'}</Tex>, <Tex>{'P(\\uparrow) = \\operatorname{tr}(P_\\uparrow\\rho) = \\tfrac12'}</Tex>. Toggle “classical expectation” to compare with the smear a
          classical dipole model predicts.
        </p>
      </>
    ),
  },
  ZX: {
    question: (
      <>
        Only <Tex>{'\\uparrow'}</Tex> atoms reach the X magnet. A classical dipole along z has no x-component. What comes out of X?
      </>
    ),
    options: [
      { id: 'none', label: 'Nothing is deflected — a single central spot.' },
      { id: 'half', label: '50 % + and 50 % −.' },
      { id: 'plus', label: 'Everything goes +.' },
    ],
    answer: 'half',
    explanation: (
      <>
        <p>
          The state after the first magnet is <Tex>{'\\ket\\uparrow = \\ket0 = \\tfrac{1}{\\sqrt2}(\\ket+ + \\ket-)'}</Tex>, so{' '}
          <Tex>{'P(\\pm) = |\\langle\\pm|0\\rangle|^2 = \\tfrac12'}</Tex>. Equivalently: apply <Tex>{'H'}</Tex> and measure in Z,{' '}
          <Tex>{'H\\ket0 = \\ket+'}</Tex> gives each outcome with probability <Tex>{'|1/\\sqrt2|^2'}</Tex>. On the Bloch sphere the X axis is 90° from{' '}
          <Tex>{'\\ket0'}</Tex>, and <Tex>{'\\cos^2(90^\\circ/2) = \\tfrac12'}</Tex>.
        </p>
      </>
    ),
  },
  ZXZ: {
    question: (
      <>
        Select <Tex>{'\\uparrow'}</Tex>, then select <Tex>{'+'}</Tex> in X, then measure Z again. If each atom remembered its first result, what would we see?
      </>
    ),
    options: [
      { id: 'up', label: 'All ↑ — the atoms were already selected as ↑.' },
      { id: 'half', label: '50 % ↑ and 50 % ↓.' },
      { id: 'mostly', label: 'Mostly ↑ (75 %).' },
    ],
    answer: 'half',
    explanation: (
      <>
        <p>
          The X measurement leaves the atom in <Tex>{'\\ket+ = \\tfrac{1}{\\sqrt2}(\\ket0 + \\ket1)'}</Tex> no matter what came before: collapse replaces the state, so the
          earlier Z information is erased. Hence <Tex>{'P(\\uparrow) = |\\langle 0|+\\rangle|^2 = \\tfrac12'}</Tex>. Overall,{' '}
          <Tex>{'\\tfrac12\\cdot\\tfrac12\\cdot\\tfrac12 = 12.5\\%'}</Tex> of the emitted atoms hit each spot. A spin is not a pair of classical bits.
        </p>
      </>
    ),
  },
  ZXX: {
    question: <>Same as before, but the last magnet is oriented along x instead of z. What does it show?</>,
    options: [
      { id: 'half', label: '50 % + and 50 % −.' },
      { id: 'plus', label: '100 % +.' },
      { id: 'minus', label: '100 % −.' },
    ],
    answer: 'plus',
    explanation: (
      <>
        <p>
          After selecting <Tex>{'+'}</Tex> the atom is in the eigenstate <Tex>{'\\ket+'}</Tex> of <Tex>{'X'}</Tex>, so a second X measurement gives{' '}
          <Tex>{'P(+) = |\\langle +|+\\rangle|^2 = 1'}</Tex>. Repeating a measurement in the same basis reproduces the result.
        </p>
      </>
    ),
  },
  ZZ: {
    question: (
      <>
        Select <Tex>{'\\uparrow'}</Tex> and measure Z again.
      </>
    ),
    options: [
      { id: 'up', label: '100 % ↑.' },
      { id: 'half', label: '50 / 50 — measurements are random.' },
    ],
    answer: 'up',
    explanation: (
      <>
        <p>
          The randomness is in which eigenstate the first measurement selects, not in repeated measurements: <Tex>{'\\ket0'}</Tex> is an eigenstate of <Tex>{'Z'}</Tex>, so{' '}
          <Tex>{'P(\\uparrow) = |\\langle0|0\\rangle|^2 = 1'}</Tex>.
        </p>
      </>
    ),
  },
  Z30: {
    question: (
      <>
        The second magnet is rotated by 30° from z toward x. What fraction of the <Tex>{'\\uparrow'}</Tex> atoms is deflected “+”?
      </>
    ),
    options: [
      { id: 'half', label: '50 %' },
      { id: 'cos30', label: <><Tex>{'\\cos^2 30^\\circ = 75\\%'}</Tex></> },
      { id: 'cos15', label: <><Tex>{'\\cos^2 15^\\circ \\approx 93.3\\%'}</Tex></> },
      { id: 'all', label: '100 %' },
    ],
    answer: 'cos15',
    explanation: (
      <>
        <p>
          With <Tex>{'\\vec n = (\\sin30^\\circ, 0, \\cos30^\\circ)'}</Tex> and <Tex>{'\\vec r = \\hat z'}</Tex>,{' '}
          <Tex>{'P(+) = \\tfrac12(1 + \\vec n\\cdot\\vec r) = \\tfrac12(1+\\cos30^\\circ) = \\cos^2 15^\\circ \\approx 0.933'}</Tex>. The half angle appears because
          Bloch-sphere angles are twice the Hilbert-space angles: <Tex>{'\\ket{+_n} = \\cos15^\\circ\\ket0 + \\sin15^\\circ\\ket1'}</Tex>.
        </p>
      </>
    ),
  },
};

function SGInner() {
  const [stages, setStages] = useState<StageCfg[]>(PRESETS_SG[2].stages);
  const [presetId, setPresetId] = useState<string | null>('ZXZ');
  const [source, setSource] = useState<SourceCfg>({ kind: 'unpolarized', theta: 0, phi: 0 });
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showClassical, setShowClassical] = useState(false);
  const [drawKey, setDrawKey] = useState(0);

  const engineRef = useRef<SGEngine | null>(null);
  if (!engineRef.current) engineRef.current = new SGEngine(stages, source);
  const engine = engineRef.current;
  const [stats, setStats] = useState<Stats>(() => engine.snapshot());

  const layout = useMemo(() => computeLayout(stages), [stages]);
  const core = useMemo(() => toCoreStages(stages), [stages]);
  const rho0 = useMemo(() => sourceDensity(source), [source]);
  const theory = useMemo(() => predictChain(rho0, core), [rho0, core]);
  const chain = useMemo(() => chainTheory(rho0, core), [rho0, core]);

  // a new apparatus or source invalidates all atoms in flight and the statistics
  useEffect(() => {
    engine.configure(stages, source);
    setStats(engine.snapshot());
    setDrawKey((d) => d + 1);
  }, [engine, stages, source]);
  useEffect(() => {
    engine.streaming = playing;
  }, [engine, playing]);
  useEffect(() => {
    engine.speed = speed;
  }, [engine, speed]);
  useEffect(() => {
    if (selected > stages.length - 1) setSelected(stages.length - 1);
  }, [stages.length, selected]);

  const editStages = (next: StageCfg[]) => {
    setStages(next);
    const match = PRESETS_SG.find((p) => sameStages(p.stages, next));
    setPresetId(match ? match.id : null);
  };
  const loadPreset = (id: string) => {
    const p = PRESETS_SG.find((x) => x.id === id)!;
    setStages(p.stages.map((s) => ({ ...s })));
    setPresetId(id);
    setSelected(Math.min(selected, p.stages.length - 1));
    setShowClassical(false);
  };
  const updateStage = (k: number, patch: Partial<StageCfg>) => editStages(stages.map((s, i) => (i === k ? { ...s, ...patch } : s)));
  const addStage = () => {
    if (stages.length >= 4) return;
    const next = stages.map((s, i) => (i === stages.length - 1 && s.pass === 'both' ? { ...s, pass: 'plus' as const } : s));
    next.push(stage('Z', 'both'));
    editStages(next);
    setSelected(next.length - 1);
  };
  const removeStage = (k: number) => {
    if (stages.length <= 1) return;
    editStages(stages.filter((_, i) => i !== k));
  };
  const toggleBeam = (k: number, sign: 1 | -1) => {
    const st = stages[k];
    const last = k === stages.length - 1;
    const me = sign === 1 ? 'plus' : 'minus';
    const other = sign === 1 ? 'minus' : 'plus';
    let pass = st.pass;
    if (!last) pass = me;
    else if (st.pass === 'both') pass = other; // block the clicked beam
    else if (st.pass === other) pass = 'both'; // clicked beam was blocked: unblock
    updateStage(k, { pass });
  };

  const fire = (n: number) => {
    engine.fire(n);
  };
  const fireInstant = (n: number) => {
    engine.fireInstant(n);
    setStats(engine.snapshot());
    setDrawKey((d) => d + 1);
  };
  const resetCounts = () => {
    engine.reset();
    setStats(engine.snapshot());
    setDrawKey((d) => d + 1);
  };

  const lastK = stages.length - 1;
  const lastLab = outcomeLabels(stages[lastK]);
  const story = presetId ? STORIES[presetId] : null;

  // --- selected magnet: Bloch view
  const sel = Math.min(selected, lastK);
  const selStage = stages[sel];
  const selAxis = axisOf(selStage);
  const selLab = outcomeLabels(selStage);
  const selTh = chain[sel];
  const rIn = selTh?.blochIn ?? null;
  const rInLen = rIn ? len3(rIn) : 0;
  const lastEvent = stats.last[sel];
  const selPassPlus = selStage.pass !== 'minus';
  const selPassMinus = selStage.pass !== 'plus';

  const viz = (
    <div className="absolute inset-0">
      <BeamLine
        engine={engine}
        layout={layout}
        stages={stages}
        source={source}
        theory={theory}
        stats={stats}
        selected={sel}
        onSelect={setSelected}
        onToggleBeam={toggleBeam}
        onStats={setStats}
        showClassical={showClassical}
        drawKey={drawKey}
      />
      <div className="pointer-events-none absolute left-3 top-3 hidden max-w-[46%] flex-wrap sm:flex gap-x-3 gap-y-1 rounded-lg bg-ink-900/75 px-3 py-1.5 text-[11.5px] text-ink-300 ring-1 ring-ink-700 backdrop-blur">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: '#cfd6e4' }} /> not yet measured</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: COLORS.p0 }} /> last outcome +</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: COLORS.p1 }} /> last outcome −</span>
      </div>
      <div className="pointer-events-none absolute right-3 top-3 hidden max-w-[50%] rounded-lg text-right sm:block bg-ink-900/75 px-3 py-1.5 font-mono text-[11.5px] text-ink-300 ring-1 ring-ink-700 backdrop-blur">
        emitted <span className="text-ink-100">{stats.emitted}</span>{stats.queued > 0 && <> · queued <span className="text-ink-100">{stats.queued}</span></>} · in flight <span className="text-ink-100">{stats.inFlight}</span> · blocked{' '}
        <span className="text-ink-100">{stats.blocked}</span>
      </div>
      <div className="pointer-events-none absolute bottom-2 right-3 hidden text-right sm:block text-[11.5px] text-ink-400">Click a beam label to block / unblock it · click a magnet to inspect it</div>
    </div>
  );

  const controls = (
    <>
      <Card title="Experiment" kicker="presets · run">
        <div className="space-y-3">
          <div>
            <Label className="mb-1.5">classic sequences</Label>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS_SG.map((p) => (
                <Button key={p.id} size="sm" active={presetId === p.id} onClick={() => loadPreset(p.id)}>
                  {p.label}
                </Button>
              ))}
              {!presetId && <span className="self-center pl-1 text-[12px] text-phase">custom</span>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="primary" onClick={() => fire(1)}>
              fire 1
            </Button>
            <Button size="sm" onClick={() => fire(100)}>
              fire 100
            </Button>
            <Button size="sm" onClick={() => fire(1000)}>
              fire 1000
            </Button>
            <Button size="sm" variant="ghost" onClick={() => fireInstant(10000)} title="Simulate 10 000 atoms without animation">
              +10 000 instantly
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-ink-400">stream</span>
              <PlaybackBar playing={playing} onToggle={() => setPlaying((p) => !p)} onReset={resetCounts} speed={speed} onSpeed={setSpeed} />
            </div>
            <Toggle checked={showClassical} onChange={setShowClassical} label="classical expectation" />
          </div>
        </div>
      </Card>

      {story ? (
        <PredictionCard
          key={presetId}
          question={story.question}
          options={story.options}
          answer={story.answer}
          explanation={story.explanation}
          onRun={() => {
            resetCounts();
            fire(presetId === 'Z' ? 600 : 1000);
            if (presetId === 'Z') setShowClassical(true);
          }}
          onReset={resetCounts}
        />
      ) : (
        <Callout tone="insight" title="Custom sequence">
          <p>
            For any chain, each magnet sees the eigenstate selected by the previous one. The conditional probability is{' '}
            <Tex>{'P(\\pm) = \\tfrac12(1 \\pm \\vec n_k\\cdot\\vec n_{k-1}s_{k-1})'}</Tex>, where <Tex>{'s_{k-1} = \\pm1'}</Tex> is the selected beam — only the last selection matters.
          </p>
        </Callout>
      )}

      <Card
        title="Apparatus"
        kicker="magnets in sequence"
        right={
          <Button size="sm" onClick={addStage} disabled={stages.length >= 4}>
            + add magnet
          </Button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
          {stages.map((s, k) => {
            const last = k === lastK;
            const lab = outcomeLabels(s);
            return (
              <div
                key={k}
                onClick={() => setSelected(k)}
                className={`rounded-lg p-3 ring-1 ring-inset transition-colors ${k === sel ? 'bg-ink-800 ring-axis/50' : 'bg-ink-800/50 ring-ink-700'}`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-ink-100">
                    Magnet {k + 1} <span className="font-normal text-ink-400">· <Tex>{axisName(s).tex}</Tex></span>
                  </span>
                  {stages.length > 1 && (
                    <button onClick={(e) => { e.stopPropagation(); removeStage(k); }} className="text-[11px] text-ink-400 hover:text-bad" title="Remove magnet">
                      remove
                    </button>
                  )}
                </div>
                <Segmented size="sm" value={s.kind} onChange={(v) => updateStage(k, { kind: v })} options={AXIS_OPTIONS} />
                {s.kind === 'tilt' && (
                  <div className="mt-2">
                    <Slider
                      label="tilt from z toward x"
                      value={s.tilt}
                      min={0}
                      max={Math.PI}
                      step={Math.PI / 180}
                      onChange={(v) => updateStage(k, { tilt: v })}
                      format={(v) => `${Math.round((v * 180) / Math.PI)}^\\circ`}
                      color={COLORS.axis}
                      hl="n"
                      marks={[
                        { value: Math.PI / 6, tex: '30^\\circ' },
                        { value: Math.PI / 4, tex: '45^\\circ' },
                        { value: Math.PI / 2, tex: '90^\\circ' },
                      ]}
                    />
                  </div>
                )}
                {s.kind === 'n' && (
                  <div className="mt-2 space-y-2">
                    <Slider tex="\theta_n" value={s.theta} min={0} max={Math.PI} step={Math.PI / 180} onChange={(v) => updateStage(k, { theta: v })} format={(v) => texAngle(v, { inline: true })} color={COLORS.axis} hl="n" />
                    <Slider tex="\varphi_n" value={s.phi} min={0} max={2 * Math.PI} step={Math.PI / 180} onChange={(v) => updateStage(k, { phi: v })} format={(v) => texAngle(v, { inline: true })} color={COLORS.axis} hl="n" />
                  </div>
                )}
                <div className="mt-2">
                  <Label className="mb-1">{last ? 'beams reaching the screen' : 'beam passed on'}</Label>
                  <Segmented
                    size="sm"
                    value={s.pass}
                    onChange={(v) => updateStage(k, { pass: v })}
                    options={
                      last
                        ? [
                            { value: 'both', label: 'both' },
                            { value: 'plus', label: '', tex: `${lab.plusTex}\\text{ only}` },
                            { value: 'minus', label: '', tex: `${lab.minusTex}\\text{ only}` },
                          ]
                        : [
                            { value: 'plus', label: '', tex: lab.plusTex },
                            { value: 'minus', label: '', tex: lab.minusTex },
                          ]
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Source" kicker="what the oven emits">
        <div className="space-y-3">
          <Segmented
            value={source.kind}
            onChange={(v) => setSource({ ...source, kind: v })}
            options={[
              { value: 'unpolarized', label: 'unpolarized oven (ρ = I/2)' },
              { value: 'prepared', label: 'prepared state |ψ⟩' },
            ]}
          />
          {source.kind === 'unpolarized' ? (
            <p className="text-[12.5px] leading-relaxed text-ink-400">
              Each atom gets a spin direction drawn uniformly from the sphere. Averaged over atoms this is exactly <Tex>{'\\rho = \\tfrac12 I'}</Tex>, the state of a hot, unpolarized beam —
              no experiment can tell this mixture apart from a 50/50 mixture of <Tex>{'\\ket0'}</Tex> and <Tex>{'\\ket1'}</Tex>.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Slider tex="\theta" value={source.theta} min={0} max={Math.PI} onChange={(v) => setSource({ ...source, theta: v })} format={(v) => texAngle(v, { inline: true })} color={COLORS.state} />
              <Slider tex="\varphi" value={source.phi} min={0} max={2 * Math.PI} onChange={(v) => setSource({ ...source, phi: v })} format={(v) => texAngle(v, { inline: true })} color={COLORS.phase} />
              <div className="flex flex-wrap gap-1.5 sm:col-span-2">
                {PRESETS.map((p) => (
                  <Button key={p.id} size="sm" onClick={() => setSource({ kind: 'prepared', theta: p.theta, phi: p.phi })}>
                    <Tex>{p.tex}</Tex>
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Callout tone="info" title="X magnet = Hadamard + Z measurement">
        <p>
          Measuring along x is the same as applying <Tex>{'H'}</Tex>, measuring in the computational basis, and applying <Tex>{'H'}</Tex> again to the collapsed state:{' '}
          <Tex>{'\\ket{\\pm} = H\\ket{0/1}'}</Tex> and <Tex>{'HXH = Z'}</Tex>. In the lab you simply rotate the magnet.
        </p>
      </Callout>

        <Callout tone="insight" title="Rotating the magnet: P(+) = cos²(Δ/2)">
        <p>
          For an incoming eigenstate along <Tex>{'\\vec m'}</Tex> and a magnet along <Tex>{'\\vec n'}</Tex> at angle <Tex>{'\\Delta'}</Tex>,{' '}
          <Tex>{'P(+) = \\tfrac12(1+\\cos\\Delta) = \\cos^2(\\Delta/2)'}</Tex>. 0° → certain, 30° → 0.933, 90° → ½, 180° → 0. Try the <b>tilt</b> axis on the last magnet.
        </p>
      </Callout>
      </div>
    </>
  );

  // probability of + for the selected magnet, from geometry
  const delta = rIn && rInLen > 0.999 ? angleBetween(rIn, selAxis) : null;

  const panel = (
    <>
      <Card title="State · basis · outcome" kicker="three different things">
        <div className="space-y-2.5 text-[12.5px] leading-relaxed text-ink-300">
          <div className="flex gap-2.5">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: COLORS.state }} />
            <div>
              <span className="font-semibold text-ink-100">Quantum state</span> <Tex>{'\\ket\\psi'}</Tex> — what an atom carries: a unit vector in <Tex>{'\\mathbb C^2'}</Tex>, a point on the
              Bloch sphere. Never observed directly.
            </div>
          </div>
          <div className="flex gap-2.5">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: COLORS.axis }} />
            <div>
              <span className="font-semibold text-ink-100">Measurement basis</span> <Tex>{'\\{\\ket{+_n},\\ket{-_n}\\}'}</Tex> — chosen by <em>you</em>, by orienting the magnet along{' '}
              <Tex>{'\\vec n'}</Tex>: the eigenvectors of <Tex>{'\\vec n\\cdot\\vec\\sigma'}</Tex>.
            </div>
          </div>
          <div className="flex gap-2.5">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: `linear-gradient(90deg, ${COLORS.p0} 50%, ${COLORS.p1} 50%)` }} />
            <div>
              <span className="font-semibold text-ink-100">Outcome</span> — a single deflection up or down (eigenvalue <Tex>{'\\pm1'}</Tex>), random with probability{' '}
              <Tex>{'|\\langle\\pm_n|\\psi\\rangle|^2'}</Tex>. Afterwards the state <em>is</em> <Tex>{'\\ket{\\pm_n}'}</Tex>.
            </div>
          </div>
        </div>
      </Card>

      <Card
        title={`Magnet ${sel + 1} on the Bloch sphere`}
        kicker="state in → state out"
        right={
          <Segmented
            size="sm"
            value={String(sel)}
            onChange={(v) => setSelected(parseInt(v, 10))}
            options={stages.map((_, k) => ({ value: String(k), label: String(k + 1) }))}
          />
        }
        bodyClassName="pt-1"
      >
        <div className="bg-grid relative -mx-1 overflow-hidden rounded-lg border border-ink-700/70" style={{ height: 300 }}>
          <BlochCanvas labels="xyz" zoom={1.08}>
            <AxisLine n={selAxis} color={COLORS.axis} dashed lineWidth={1.4} opacity={0.85} />
            <PointMarker v={selAxis} color={COLORS.p0} label={`\\ket{${selLab.plusTex}}`} ring={selPassPlus} />
            <PointMarker v={scale3(selAxis, -1)} color={COLORS.p1} label={`\\ket{${selLab.minusTex}}`} ring={selPassMinus} />
            {lastEvent && source.kind === 'unpolarized' && sel === 0 && <Arrow v={lastEvent.pre} color={COLORS.state} opacity={0.3} radius={0.012} headRadius={0.035} />}
            {rIn && rInLen > 0.999 && <StateArrow v={rIn} opacity={0.55} label="\psi_{\text{in}}" />}
            {rIn && rInLen > 1e-6 && rInLen <= 0.999 && <Arrow v={rIn} color={COLORS.state} opacity={0.7} label="\vec r_{\text{in}}" />}
            {rIn && rInLen <= 1e-6 && <PointMarker v={[0, 0, 0]} color={COLORS.state} label="\rho = I/2" size={0.05} />}
            {rIn && selPassPlus && <Arrow v={selAxis} color={COLORS.p0} opacity={selPassMinus ? 0.55 : 1} radius={0.02} />}
            {rIn && selPassMinus && <Arrow v={scale3(selAxis, -1)} color={COLORS.p1} opacity={selPassPlus ? 0.55 : 1} radius={0.02} />}
          </BlochCanvas>
        </div>
        <div className="mt-2 space-y-1 text-[12.5px] leading-relaxed text-ink-300">
          {!rIn ? (
            <p>No atom can reach this magnet: an earlier magnet blocks every beam that leads here.</p>
          ) : rInLen <= 1e-6 ? (
            <p>
              The unpolarized beam has <Tex>{'\\vec r_{\\text{in}} = 0'}</Tex> (centre of the ball). Every axis gives <Tex>{'P(\\pm) = \\tfrac12(1 \\pm \\vec n\\cdot\\vec 0) = \\tfrac12'}</Tex>.
              The faint arrow is the spin of the last atom drawn from the oven.
            </p>
          ) : rInLen > 0.999 ? (
            <>
              <Tex display>{`P(${selLab.plusTex}) = \\tfrac12\\big(1 + \\hl{n}{\\vec n}\\cdot\\hl{rin}{\\vec r_{\\text{in}}}\\big) = \\cos^2\\tfrac{\\hl{delta}{\\Delta}}{2} = ${texReal(selTh.condPlus, { digits: 3 })}`}</Tex>
              <p>
                Angle between incoming state and axis: <Tex>{`\\Delta = ${delta !== null ? Math.round((delta * 180) / Math.PI) : 0}^\\circ`}</Tex>. The outgoing state is the eigenstate of the
                passing beam — the earlier history is gone.
              </p>
            </>
          ) : (
            <p>
              The incoming beam is partially mixed, <Tex>{`|\\vec r_{\\text{in}}| = ${fmt(rInLen, 2)}`}</Tex>; <Tex>{`P(+) = \\tfrac12(1+\\vec n\\cdot\\vec r_{\\text{in}}) = ${fmt((1 + dot3(selAxis, rIn)) / 2)}`}</Tex>.
            </p>
          )}
        </div>
      </Card>

      <Card title="Born rule vs. simulation" kicker="per magnet">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-ink-400">
              <th className="pb-1 text-left font-normal">magnet</th>
              <th className="pb-1 text-right font-normal">reach</th>
              <th className="pb-1 text-right font-normal">P(+) theory</th>
              <th className="pb-1 text-right font-normal">sim</th>
              <th className="pb-1 text-right font-normal">N</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums text-ink-100">
            {stages.map((s, k) => {
              const N = stats.entered[k];
              const simP = N ? stats.plus[k] / N : NaN;
              const thP = theory.condPlus[k];
              return (
                <tr key={k} className={`cursor-pointer border-t border-ink-800 ${k === sel ? 'bg-ink-800/60' : ''}`} onClick={() => setSelected(k)}>
                  <td className="py-1 font-sans text-ink-300">
                    {k + 1}. <Tex>{axisName(s).tex}</Tex>
                  </td>
                  <td className="py-1 text-right">{(100 * theory.enter[k]).toFixed(1)}%</td>
                  <td className="py-1 text-right" style={{ color: COLORS.p0 }}>
                    {Number.isFinite(thP) ? thP.toFixed(3) : '—'}
                  </td>
                  <td className="py-1 text-right">{Number.isFinite(simP) ? simP.toFixed(3) : '—'}</td>
                  <td className="py-1 text-right text-ink-400">{N}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-3 space-y-0.5">
          <KV k={<>screen <Tex>{lastLab.plusTex}</Tex> (of emitted)</>} v={`${stats.emitted ? fmt(stats.detPlus / stats.emitted) : '—'}  /  ${fmt(theory.finalPlus)}`} />
          <KV k={<>screen <Tex>{lastLab.minusTex}</Tex> (of emitted)</>} v={`${stats.emitted ? fmt(stats.detMinus / stats.emitted) : '—'}  /  ${fmt(theory.finalMinus)}`} />
          <KV k="absorbed by stoppers" v={`${stats.emitted ? fmt(stats.blocked / stats.emitted) : '—'}  /  ${fmt(1 - theory.finalPlus - theory.finalMinus)}`} />
          <div className="pt-0.5 text-right text-[10.5px] text-ink-500">simulated / predicted</div>
        </div>
      </Card>

      <Card title={`Outcomes at magnet ${lastK + 1}`} kicker="histogram · conditional on arrival">
        <Histogram
          height={130}
          bins={[
            { label: lastLab.plusTex, count: stats.plus[lastK] ?? 0, expected: Number.isFinite(theory.condPlus[lastK]) ? theory.condPlus[lastK] : 0, color: COLORS.p0 },
            { label: lastLab.minusTex, count: stats.minus[lastK] ?? 0, expected: Number.isFinite(theory.condPlus[lastK]) ? 1 - theory.condPlus[lastK] : 0, color: COLORS.p1 },
          ]}
        />
        <p className="mt-2 text-[12px] leading-relaxed text-ink-400">
          Statistical scatter shrinks like <Tex>{'1/\\sqrt N'}</Tex>. Fire 1000 or add 10 000 instantly and watch the bars settle on the dashed Born-rule values.
        </p>
      </Card>


    </>
  );

  return (
    <ModuleShell
      letter="F"
      title="The Stern–Gerlach experiment & quantum measurement"
      intro={
        <p>
          An inhomogeneous magnetic field measures one spin component of each atom. Assemble magnets along different axes, block beams, and see how the state collapses into an
          eigenstate of whatever you measured — with every atom carrying a real state vector and every deflection drawn from the Born rule.
        </p>
      }
      viz={viz}
      vizHeight="clamp(220px, min(46vh, 40vw + 90px), 500px)"
      controls={controls}
      panel={panel}
    />
  );
}


export default function SternGerlachModule(_props: { subpath: string }) {
  return (
    <HighlightProvider tips={TIPS}>
      <SGInner />
    </HighlightProvider>
  );
}

