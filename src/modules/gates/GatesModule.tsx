import { useCallback, useMemo, useRef, useState } from 'react';
import { ModuleShell } from '../../layout/ModuleShell';
import {
  BlochCanvas,
  StateArrow,
  Arrow,
  AxisLine,
  RotationArc,
  AngleAroundAxis,
  PointMarker,
  Trail,
  OrbitCircle,
  DragHandle,
} from '../../components/bloch';
import { ProbabilityBars } from '../../components/charts';
import { Tex } from '../../components/Tex';
import { Card, Slider, Button, Segmented, Toggle, KV, Label, Icon } from '../../components/ui';
import { PredictionCard } from '../../components/Prediction';
import { PlaybackBar } from '../../components/Playback';
import { HighlightProvider, useHighlight } from '../../components/Highlight';
import { useTween } from '../../hooks/animation';
import { COLORS } from '../../theme';
import {
  Vec2,
  Vec3,
  Mat2,
  PRESETS,
  KET0,
  stateFromAngles,
  stateFromBloch,
  blochVector,
  apply,
  abs2,
  axisAngle,
  Rn,
  matScale,
  matMul,
  matSub,
  frobenius,
  expi,
  H as HAD,
  X,
  Y,
  Z,
  S,
  T,
  pauliDecompose,
  texMatrix,
  texColumn,
  texKet,
  texAngle,
  texComplex,
  texReal,
  fmt,
  fmtAngle,
  equalUpToGlobalPhase,
} from '../../quantum';
import { GateId, Step, buildStep, pathAt, runCircuit, tipPath, durationFor, FIXED_GATES, ROTATION_GATES } from './gateMath';

const TIPS: Record<string, string> = {
  U: 'U — the selected gate. Every single-qubit unitary is a rotation of the Bloch sphere, up to a global phase.',
  gphase: 'e^{iα} — global phase of the gate. Multiplies every amplitude equally; invisible on the Bloch sphere.',
  axis: 'n — rotation axis of the gate on the Bloch sphere (violet).',
  angle: 'θ — rotation angle about n (right-hand rule). Note the θ/2 inside the matrix.',
  before: 'State before the gate (faint arrow).',
  after: 'State after the gate.',
  psi: '|ψ⟩ — the current state (blue arrow).',
};

const SYMBOLIC: Record<GateId, string> = {
  X: 'X = \\begin{pmatrix}0&1\\\\1&0\\end{pmatrix}',
  Y: 'Y = \\begin{pmatrix}0&-i\\\\i&0\\end{pmatrix}',
  Z: 'Z = \\begin{pmatrix}1&0\\\\0&-1\\end{pmatrix}',
  H: 'H = \\tfrac{1}{\\sqrt2}\\begin{pmatrix}1&1\\\\1&-1\\end{pmatrix}',
  S: 'S = \\begin{pmatrix}1&0\\\\0&i\\end{pmatrix}',
  T: 'T = \\begin{pmatrix}1&0\\\\0&e^{i\\pi/4}\\end{pmatrix}',
  Rx: 'R_x(\\hl{angle}{\\theta}) = \\begin{pmatrix}\\cos\\frac{\\theta}{2}&-i\\sin\\frac{\\theta}{2}\\\\-i\\sin\\frac{\\theta}{2}&\\cos\\frac{\\theta}{2}\\end{pmatrix}',
  Ry: 'R_y(\\hl{angle}{\\theta}) = \\begin{pmatrix}\\cos\\frac{\\theta}{2}&-\\sin\\frac{\\theta}{2}\\\\\\sin\\frac{\\theta}{2}&\\cos\\frac{\\theta}{2}\\end{pmatrix}',
  Rz: 'R_z(\\hl{angle}{\\theta}) = \\begin{pmatrix}e^{-i\\theta/2}&0\\\\0&e^{i\\theta/2}\\end{pmatrix}',
  Rn: 'R_{\\hl{axis}{\\vec n}}(\\hl{angle}{\\theta}) = \\cos\\tfrac{\\theta}{2}\\,I - i\\sin\\tfrac{\\theta}{2}\\,(\\vec n\\cdot\\vec\\sigma)',
};

const DESCRIPTIONS: Record<GateId, string> = {
  X: 'Bit flip: π rotation about x (up to the phase i).',
  Y: 'Bit + phase flip: π rotation about y.',
  Z: 'Phase flip: π rotation about z.',
  H: 'Hadamard: π rotation about (x+z)/√2 — swaps the x and z axes.',
  S: 'S = diag(1, i): π/2 rotation about z (up to phase).',
  T: 'T = diag(1, e^{iπ/4}): π/4 rotation about z (up to phase).',
  Rx: 'Rotation by θ about the x axis.',
  Ry: 'Rotation by θ about the y axis.',
  Rz: 'Rotation by θ about the z axis.',
  Rn: 'Rotation by θ about an arbitrary unit axis n — the most general single-qubit gate up to global phase.',
};

const CARDINALS: { tex: string; v: Vec3; color: string }[] = [
  { tex: '|0\\rangle', v: [0, 0, 1], color: COLORS.z },
  { tex: '|1\\rangle', v: [0, 0, -1], color: COLORS.z },
  { tex: '|{+}\\rangle', v: [1, 0, 0], color: COLORS.x },
  { tex: '|{-}\\rangle', v: [-1, 0, 0], color: COLORS.x },
  { tex: '|{+i}\\rangle', v: [0, 1, 0], color: COLORS.y },
  { tex: '|{-i}\\rangle', v: [0, -1, 0], color: COLORS.y },
];
const CARD_STATES: Vec2[] = CARDINALS.map((c) => stateFromBloch(c.v));

const fmtVec = (v: Vec3) => `(${fmt(v[0], 2)}, ${fmt(v[1], 2)}, ${fmt(v[2], 2)})`;
const texVec3 = (v: Vec3) => `(${texReal(v[0], { digits: 2 })},\\,${texReal(v[1], { digits: 2 })},\\,${texReal(v[2], { digits: 2 })})`;

interface Anim {
  k: number;
  dir: 1 | -1;
}

function GatesInner() {
  const { active } = useHighlight();
  // ---- selection --------------------------------------------------------------
  const [gate, setGate] = useState<GateId>('H');
  const [theta, setTheta] = useState(Math.PI / 2);
  const [nTheta, setNTheta] = useState(Math.PI / 4);
  const [nPhi, setNPhi] = useState(Math.PI / 6);
  const selected = useMemo(() => buildStep(gate, { theta, nTheta, nPhi }), [gate, theta, nTheta, nPhi]);

  // ---- circuit ----------------------------------------------------------------
  const [psi0, setPsi0] = useState<Vec2>(KET0);
  const [history, setHistory] = useState<Step[]>([]);
  const [cursor, setCursor] = useState(0);
  const [anim, setAnim] = useState<Anim | null>(null);
  const [playing, setPlaying] = useState(false);
  const [preview, setPreview] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [whole, setWhole] = useState(false);
  const tween = useTween();

  const { states, cums } = useMemo(() => runCircuit(psi0, history), [psi0, history]);

  // refs for chained playback
  const historyRef = useRef(history);
  historyRef.current = history;
  const playingRef = useRef(false);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  const runStep = useCallback(
    (k: number, dir: 1 | -1) => {
      const st = historyRef.current[k];
      if (!st) return;
      setPreview(false);
      setAnim({ k, dir });
      tween.start(durationFor(st, speedRef.current), () => {
        setAnim(null);
        const next = dir === 1 ? k + 1 : k;
        setCursor(next);
        if (dir === 1 && playingRef.current && next < historyRef.current.length) {
          window.setTimeout(() => {
            if (playingRef.current) runStepRef.current(next, 1);
          }, 160);
        } else {
          playingRef.current = false;
          setPlaying(false);
        }
      });
    },
    [tween],
  );
  const runStepRef = useRef(runStep);
  runStepRef.current = runStep;

  const stopAll = () => {
    playingRef.current = false;
    setPlaying(false);
    if (anim) tween.finish();
  };

  const applyGate = (st: Step = selected) => {
    // finish a running animation first so the circuit is consistent
    if (anim) tween.finish();
    playingRef.current = false;
    setPlaying(false);
    const base = anim ? (anim.dir === 1 ? anim.k + 1 : anim.k) : cursor;
    const next = [...historyRef.current.slice(0, base), st];
    historyRef.current = next;
    setHistory(next);
    setCursor(base);
    runStep(base, 1);
  };

  const stepForward = () => {
    if (anim) return;
    if (cursor < history.length) runStep(cursor, 1);
  };
  const stepBack = () => {
    if (anim) return;
    if (cursor > 0) runStep(cursor - 1, -1);
  };
  const togglePlay = () => {
    if (playing) {
      playingRef.current = false;
      setPlaying(false);
      return;
    }
    if (history.length === 0) return;
    playingRef.current = true;
    setPlaying(true);
    if (anim) return;
    if (cursor >= history.length) {
      setCursor(0);
      window.setTimeout(() => runStepRef.current(0, 1), 60);
    } else runStep(cursor, 1);
  };
  const replay = () => {
    if (history.length === 0) return;
    if (anim) tween.cancel();
    setAnim(null);
    setCursor(0);
    playingRef.current = true;
    setPlaying(true);
    window.setTimeout(() => runStepRef.current(0, 1), 120);
  };
  const undo = () => {
    stopAll();
    if (history.length === 0) return;
    const next = history.slice(0, -1);
    setHistory(next);
    setCursor((c) => Math.min(c, next.length));
    setPreview(true);
  };
  const resetCircuit = () => {
    stopAll();
    setHistory([]);
    setCursor(0);
    setPreview(true);
  };
  const setInput = (psi: Vec2) => {
    stopAll();
    setPsi0(psi);
    setCursor(0);
    setPreview(true);
  };

  // ---- what is displayed --------------------------------------------------------
  const s = anim ? (anim.dir === 1 ? tween.progress : 1 - tween.progress) : 1;
  const shownPsi: Vec2 = anim ? apply(pathAt(history[anim.k], s), states[anim.k]) : states[cursor];
  const shownCum: Mat2 = anim ? matMul(pathAt(history[anim.k], s), cums[anim.k]) : cums[cursor];
  const r = blochVector(shownPsi);

  // focus = the gate whose geometry / algebra we show
  const focus = useMemo(() => {
    if (anim) return { st: history[anim.k], before: states[anim.k], s, kind: 'anim' as const, index: anim.k };
    if (!preview && cursor > 0) return { st: history[cursor - 1], before: states[cursor - 1], s: 1, kind: 'applied' as const, index: cursor - 1 };
    return { st: selected, before: states[cursor], s: 0, kind: 'preview' as const, index: -1 };
  }, [anim, history, states, s, preview, cursor, selected]);

  const fBefore = focus.before;
  const fAfter = apply(focus.st.U, fBefore);
  const rBefore = blochVector(fBefore);
  const rAfter = blochVector(fAfter);
  const predicted = useMemo(() => (focus.kind === 'preview' ? tipPath(focus.st, fBefore, 1) : []), [focus.kind, focus.st, fBefore]);
  const traced = useMemo(() => (focus.kind !== 'preview' ? tipPath(focus.st, fBefore, focus.s) : []), [focus.kind, focus.st, fBefore, focus.s]);

  const cardinalNow = CARD_STATES.map((c) => blochVector(apply(shownCum, c)));
  const zImg = cardinalNow[0];
  const xImg = cardinalNow[2];

  const aa = axisAngle(focus.st.U);
  const total = cums[cursor];
  const totalAA = axisAngle(total);

  const hotAxis = active === 'axis';
  const hotAngle = active === 'angle';

  // ---- viz --------------------------------------------------------------------
  const viz = (
    <BlochCanvas
      overlay={
        <>
          <div className="absolute left-3 top-3 max-w-[70%] rounded-lg bg-ink-900/75 px-3 py-2 ring-1 ring-ink-700 backdrop-blur">
            <Label className="mb-0.5">{anim ? 'applying' : focus.kind === 'preview' ? 'current state' : 'after last gate'}</Label>
            <div className="text-[15px]">
              <Tex>{`\\ket{\\psi} = ${texKet(shownPsi, { digits: 3 })}`}</Tex>
            </div>
          </div>
          <div className="absolute right-3 top-3 hidden rounded-lg bg-ink-900/75 px-3 py-1.5 text-[12px] text-ink-200 ring-1 ring-ink-700 backdrop-blur sm:block">
            {focus.st.trivial ? (
              <span>identity (up to phase)</span>
            ) : (
              <span>
                <span style={{ color: COLORS.axis }}>{focus.kind === 'preview' ? 'next: ' : ''}</span>
                <Tex>{focus.st.tex}</Tex> · {fmtAngle(focus.st.angle)} about <span className="font-mono">{fmtVec(focus.st.axis)}</span>
                {focus.kind === 'anim' && <span className="ml-1 text-ink-400">({Math.round(100 * focus.s)}%)</span>}
              </span>
            )}
          </div>
          <div className="absolute bottom-2 left-3 text-[11.5px] text-ink-400">Drag the tip to choose an input state (keeps the gate sequence).</div>
        </>
      }
    >
      {!focus.st.trivial && (
        <>
          <AxisLine n={focus.st.axis} color={COLORS.axis} lineWidth={hotAxis ? 3.4 : 2} dashed={focus.kind === 'preview'} label="\vec n" />
          <OrbitCircle n={focus.st.axis} through={rBefore} opacity={0.35} />
          <AngleAroundAxis n={focus.st.axis} angle={focus.kind === 'preview' ? focus.st.angle : focus.st.angle * focus.s} label={hotAngle ? '\\theta' : undefined} />
        </>
      )}
      {focus.kind === 'preview' && !focus.st.trivial && (
        <>
          <Trail points={predicted} color={COLORS.axis} dashed fade={false} lineWidth={1.6} opacity={0.85} />
          <PointMarker v={rAfter} color={COLORS.state} size={active === 'after' ? 0.06 : 0.04} opacity={0.55} />
        </>
      )}
      {focus.kind !== 'preview' && !focus.st.trivial && (
        <RotationArc n={focus.st.axis} from={rBefore} angle={focus.st.angle * focus.s} color={COLORS.axis} lineWidth={hotAngle ? 3.6 : 2.4} label={focus.s > 0.25 ? texAngle(focus.st.angle * focus.s, { inline: true }) : undefined} />
      )}
      {focus.kind !== 'preview' && traced.length > 1 && <Trail points={traced} color={COLORS.state} lineWidth={1.4} opacity={0.7} />}
      {focus.kind !== 'preview' && <Arrow v={rBefore} color={COLORS.state} opacity={active === 'before' ? 0.7 : 0.28} radius={0.016} />}
      {whole && (
        <>
          <OrbitCircle n={zImg} through={xImg} color={COLORS.gridStrong} opacity={0.9} dashed={false} lineWidth={1.4} />
          {CARDINALS.map((c, i) => (
            <PointMarker key={i} v={cardinalNow[i]} color={c.color} label={c.tex} size={0.035} />
          ))}
        </>
      )}
      <StateArrow v={r} emphasized={active === 'psi' || active === 'after'} />
      {!anim && <DragHandle v={r} onChange={(v) => setInput(stateFromBloch(v))} />}
    </BlochCanvas>
  );

  // ---- controls -------------------------------------------------------------------
  const parametric = ROTATION_GATES.includes(gate);
  const controls = (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Gate palette" kicker="choose an operation">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {FIXED_GATES.map((g) => (
              <Button key={g} size="sm" active={gate === g} onClick={() => { setGate(g); setPreview(true); }} title={DESCRIPTIONS[g]} className="min-w-[38px]">
                <Tex>{g}</Tex>
              </Button>
            ))}
            <span className="mx-1 w-px self-stretch bg-ink-700" />
            {ROTATION_GATES.map((g) => (
              <Button key={g} size="sm" active={gate === g} onClick={() => { setGate(g); setPreview(true); }} title={DESCRIPTIONS[g]}>
                <Tex>{g === 'Rn' ? 'R_{\\vec n}(\\theta)' : `R_${g[1]}(\\theta)`}</Tex>
              </Button>
            ))}
          </div>
          <p className="text-[12.5px] leading-snug text-ink-400">{DESCRIPTIONS[gate]}</p>
          {parametric && (
            <Slider
              tex="\theta"
              label="rotation angle"
              value={theta}
              min={-2 * Math.PI}
              max={2 * Math.PI}
              onChange={(v) => { setTheta(v); setPreview(true); }}
              format={(v) => texAngle(v, { inline: true })}
              hl="angle"
              color={COLORS.axis}
              marks={[
                { value: Math.PI / 4, tex: '\\pi/4' },
                { value: Math.PI / 2, tex: '\\pi/2' },
                { value: Math.PI, tex: '\\pi' },
                { value: 2 * Math.PI, tex: '2\\pi' },
                { value: -Math.PI / 2, tex: '-\\pi/2' },
              ]}
            />
          )}
          {gate === 'Rn' && (
            <div className="grid grid-cols-2 gap-3">
              <Slider tex="\theta_n" label="axis polar" value={nTheta} min={0} max={Math.PI} onChange={(v) => { setNTheta(v); setPreview(true); }} format={(v) => texAngle(v, { inline: true })} hl="axis" color={COLORS.axis} />
              <Slider tex="\varphi_n" label="axis azimuth" value={nPhi} min={0} max={2 * Math.PI} onChange={(v) => { setNPhi(v); setPreview(true); }} format={(v) => texAngle(v, { inline: true })} hl="axis" color={COLORS.axis} />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button variant="primary" onClick={() => applyGate()}>
              Apply <Tex>{selected.tex}</Tex>
            </Button>
            <Segmented size="sm" value={String(speed)} onChange={(v) => setSpeed(parseFloat(v))} options={[0.5, 1, 2].map((x) => ({ value: String(x), label: `${x}×` }))} />
            <Toggle checked={whole} onChange={setWhole} label="whole-sphere action" />
          </div>
        </div>
      </Card>

      <Card title="Circuit & history" kicker="step through">
        <div className="space-y-3">
          <div>
            <Label className="mb-1.5">input state</Label>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <Button key={p.id} size="sm" active={equalUpToGlobalPhase(psi0, stateFromAngles(p.theta, p.phi))} onClick={() => setInput(stateFromAngles(p.theta, p.phi))} title={p.description}>
                  <Tex>{p.tex}</Tex>
                </Button>
              ))}
            </div>
          </div>
          <div>
            <Label className="mb-1.5">sequence (time runs left → right)</Label>
            <div className="flex min-h-[38px] flex-wrap items-center gap-1 rounded-lg bg-ink-800/70 px-2 py-1.5 ring-1 ring-inset ring-ink-700">
              <span className="text-[13px] text-ink-300">
                <Tex>{'\\ket{\\psi_0}'}</Tex>
              </span>
              {history.length === 0 && <span className="ml-2 text-[12px] text-ink-500">apply a gate to start</span>}
              {history.map((st, i) => {
                const done = i < cursor;
                const now = anim?.k === i;
                return (
                  <span key={i} className="flex items-center gap-1">
                    <span className="h-px w-3 bg-ink-500" />
                    <button
                      onClick={() => { stopAll(); setCursor(i + 1); setPreview(false); }}
                      title="jump here"
                      className={`rounded-md px-2 py-0.5 text-[12.5px] ring-1 ring-inset transition-colors ${
                        now ? 'bg-axis/25 text-ink-100 ring-axis' : done ? 'bg-ink-700 text-ink-100 ring-ink-500' : 'bg-transparent text-ink-500 ring-ink-700'
                      }`}
                    >
                      <Tex>{st.tex}</Tex>
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
          <PlaybackBar
            playing={playing}
            onToggle={togglePlay}
            onReset={() => { stopAll(); setCursor(0); setPreview(true); }}
            onStepBack={stepBack}
            onStepForward={stepForward}
            onReplay={replay}
          >
            <Button size="sm" variant="ghost" onClick={undo} title="Remove last gate" disabled={history.length === 0}>
              {Icon.undo} undo
            </Button>
            <Button size="sm" variant="ghost" onClick={resetCircuit} disabled={history.length === 0}>
              clear
            </Button>
          </PlaybackBar>
          <div className="text-[12px] text-ink-400">
            step <span className="font-mono text-ink-200">{cursor}</span> / {history.length}
            {history.length > 0 && (
              <>
                {' '}· composite <Tex>{`U_{\\rm tot}`}</Tex> ={' '}
                {totalAA.trivial ? (
                  <span>identity up to phase</span>
                ) : (
                  <span>
                    rotation by <span className="font-mono text-ink-200">{fmtAngle(totalAA.angle)}</span> about <span className="font-mono text-ink-200">{fmtVec(totalAA.axis)}</span>
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  );

  // ---- panel ----------------------------------------------------------------------
  const residual = frobenius(matSub(focus.st.U, matScale(Rn(aa.axis, aa.angle), expi(aa.globalPhase))));
  const panel = (
    <>
      <Card title="The gate" kicker={focus.kind === 'preview' ? 'selected (preview)' : focus.kind === 'anim' ? 'being applied' : 'last applied'}>
        <Tex display>{SYMBOLIC[focus.st.id]}</Tex>
        {ROTATION_GATES.includes(focus.st.id) && <Tex display>{`\\hl{U}{U} = ${texMatrix(focus.st.U)}`}</Tex>}
        <div className="mt-1 rounded-lg bg-ink-800/70 p-2.5">
          <Label className="mb-1">as a rotation (up to global phase)</Label>
          {aa.trivial ? (
            <Tex display>{`U = e^{i\\,${texAngle(aa.globalPhase, { inline: true })}}\\, I`}</Tex>
          ) : (
            <Tex display>
              {`U = \\hl{gphase}{e^{i\\alpha}}\\,R_{\\hl{axis}{\\vec n}}(\\hl{angle}{\\theta}),\\quad \\alpha = ${texAngle(aa.globalPhase, { inline: true })},\\ \\vec n = ${texVec3(aa.axis)},\\ \\theta = ${texAngle(aa.angle, { inline: true })}`}
            </Tex>
          )}
          <div className="mt-1 text-[11.5px] text-ink-400">
            numerical check <Tex>{'\\|U - e^{i\\alpha}R_{\\vec n}(\\theta)\\|'}</Tex> = <span className="font-mono text-good">{residual.toExponential(1)}</span>
            {focus.st.id.startsWith('R') && Math.abs(focus.st.angle) > Math.PI + 1e-9 && (
              <span> — the animation follows your θ = {fmtAngle(focus.st.angle)}; the decomposition reports the equivalent angle in [0, π].</span>
            )}
          </div>
        </div>
      </Card>

      <Card title="Action on the state vector" kicker="matrix × column">
        <Tex display>{`\\hl{U}{U}\\hl{before}{\\ket{\\psi}} = ${texMatrix(focus.st.U, { digits: 2 })}${texColumn(fBefore, { digits: 3 })} = \\hl{after}{${texColumn(fAfter, { digits: 3 })}}`}</Tex>
        <div className="mt-2 grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-1 text-[12.5px]">
          <span />
          <span className="text-ink-400">before</span>
          <span className="text-ink-400">after</span>
          <span className="text-ink-400"><Tex>{'\\alpha'}</Tex></span>
          <span className="font-mono text-ink-200"><Tex>{texComplex(fBefore[0])}</Tex></span>
          <span className="font-mono text-ink-100"><Tex>{texComplex(fAfter[0])}</Tex></span>
          <span className="text-ink-400"><Tex>{'\\beta'}</Tex></span>
          <span className="font-mono text-ink-200"><Tex>{texComplex(fBefore[1])}</Tex></span>
          <span className="font-mono text-ink-100"><Tex>{texComplex(fAfter[1])}</Tex></span>
        </div>
        <Label className="mb-1 mt-3">probabilities after (white tick = before)</Label>
        <ProbabilityBars
          items={[
            { label: 'P(0)', p: abs2(fAfter[0]), compare: abs2(fBefore[0]), color: COLORS.p0, hl: 'p0' },
            { label: 'P(1)', p: abs2(fAfter[1]), compare: abs2(fBefore[1]), color: COLORS.p1, hl: 'p1' },
          ]}
        />
        <div className="mt-2 space-y-0.5">
          <KV k="Bloch before" v={fmtVec(rBefore)} hl="before" />
          <KV k="Bloch after" v={fmtVec(rAfter)} hl="after" />
          <KV k={<span>norm after <Tex>{'\\|U\\psi\\|'}</Tex></span>} v={fmt(Math.sqrt(abs2(fAfter[0]) + abs2(fAfter[1])), 6)} />
        </div>
      </Card>

      <PauliAsRotationCard />

      <HadamardCard
        onDemo={() => {
          setWhole(true);
          setGate('H');
          setPsi0(KET0);
          const st = buildStep('H', { theta, nTheta, nPhi });
          historyRef.current = [st];
          setHistory([st]);
          setCursor(0);
          stopAllSoft();
          window.setTimeout(() => runStepRef.current(0, 1), 80);
        }}
      />

      <PredictionCard
        question={
          <>
            Apply <Tex>{'R_z(2\\pi)'}</Tex> to <Tex>{'\\ket{+}'}</Tex>. The arrow sweeps once around the equator and returns to where it started. Which matrix is <Tex>{'R_z(2\\pi)'}</Tex>?
          </>
        }
        options={[
          { id: 'I', label: <Tex>{'I'}</Tex> },
          { id: '-I', label: <Tex>{'-I'}</Tex> },
          { id: 'Z', label: <Tex>{'Z'}</Tex> },
          { id: 'dep', label: 'It depends on the input state.' },
        ]}
        answer="-I"
        onRun={() => {
          const st = buildStep('Rz', { theta: 2 * Math.PI, nTheta, nPhi });
          setGate('Rz');
          setTheta(2 * Math.PI);
          setPsi0(stateFromAngles(Math.PI / 2, 0));
          historyRef.current = [st];
          setHistory([st]);
          setCursor(0);
          stopAllSoft();
          window.setTimeout(() => runStepRef.current(0, 1), 80);
        }}
        explanation={
          <>
            <p>
              <Tex>{'R_z(2\\pi) = \\cos(\\pi) I - i\\sin(\\pi) Z = -I'}</Tex>. Because of the <Tex>{'\\theta/2'}</Tex> in the exponent, a full turn of the Bloch sphere multiplies the
              state by <Tex>{'-1'}</Tex>; it takes <Tex>{'4\\pi'}</Tex> to return to <Tex>{'+I'}</Tex>. Look at the amplitudes table: they all flipped sign.
            </p>
            <p>
              For a single qubit this sign is a global phase and unobservable. It becomes measurable when the rotation is applied conditionally (e.g. in an
              interferometer or a controlled gate) — the famous spinor sign of spin-½ particles.
            </p>
          </>
        }
      />

      <PredictionCard
        question={
          <>
            Start in <Tex>{'\\ket0'}</Tex> and apply <Tex>{'H'}</Tex> twice. Where does the state end up?
          </>
        }
        options={[
          { id: '1', label: <Tex>{'\\ket1'}</Tex> },
          { id: '+', label: <Tex>{'\\ket{+}'}</Tex> },
          { id: '0', label: <Tex>{'\\ket0'}</Tex> },
          { id: '-', label: <Tex>{'\\ket{-}'}</Tex> },
        ]}
        answer="0"
        onRun={() => {
          const st = buildStep('H', { theta, nTheta, nPhi });
          setGate('H');
          setPsi0(KET0);
          historyRef.current = [st, st];
          setHistory([st, st]);
          setCursor(0);
          playingRef.current = true;
          setPlaying(true);
          window.setTimeout(() => runStepRef.current(0, 1), 80);
        }}
        explanation={
          <>
            <p>
              <Tex>{'H^2 = I'}</Tex>: a π rotation about the same axis twice is a 2π rotation. Here no sign appears because <Tex>{'H = iR_{\\vec n}(\\pi)'}</Tex>, so{' '}
              <Tex>{'H^2 = i^2 R_{\\vec n}(2\\pi) = (-1)(-I) = I'}</Tex>.
            </p>
          </>
        }
      />
    </>
  );

  function stopAllSoft() {
    playingRef.current = false;
    setPlaying(false);
    if (anim) tween.cancel();
    setAnim(null);
  }

  return (
    <ModuleShell
      letter="B"
      title="Quantum gates as rotations"
      intro={
        <p>
          A single-qubit gate is a 2×2 unitary matrix. Geometrically, every such matrix is — up to an unobservable global phase — a rotation of the Bloch sphere,{' '}
          <Tex>{'U = e^{i\\alpha}R_{\\vec n}(\\theta)'}</Tex>. Pick a gate, preview its axis, and apply it: the animation follows the actual unitary path{' '}
          <Tex>{'e^{is\\alpha}R_{\\vec n}(s\\theta)'}</Tex>, <Tex>{'s: 0 \\to 1'}</Tex>.
        </p>
      }
      viz={viz}
      controls={controls}
      panel={panel}
    />
  );
}

// ---------------------------------------------------------------------------
// explanation cards
// ---------------------------------------------------------------------------

function PauliAsRotationCard() {
  const rows: { name: string; U: Mat2 }[] = [
    { name: 'X', U: X },
    { name: 'Y', U: Y },
    { name: 'Z', U: Z },
    { name: 'H', U: HAD },
    { name: 'S', U: S },
    { name: 'T', U: T },
  ];
  return (
    <Card title="Why a Pauli gate is a 180° rotation" kicker="up to global phase">
      <Tex display>{'\\begin{aligned} R_x(\\pi) &= \\cos\\tfrac{\\pi}{2}\\,I - i\\sin\\tfrac{\\pi}{2}\\,X = -iX \\\\ \\Longrightarrow\\quad X &= \\hl{gphase}{i}\\,R_x(\\pi) = e^{i\\pi/2}R_x(\\pi) \\end{aligned}'}</Tex>
      <p className="mb-2 text-[12.5px] leading-relaxed text-ink-400">
        Likewise <Tex>{'Y = iR_y(\\pi)'}</Tex> and <Tex>{'Z = iR_z(\\pi)'}</Tex>. The factor <Tex>{'i'}</Tex> multiplies both amplitudes equally, so on the Bloch sphere a Pauli
        gate is exactly a half-turn about its own axis. Decomposition computed from each matrix:
      </p>
      <table className="w-full text-[12px]">
        <thead>
          <tr className="text-ink-400">
            <th className="py-1 text-left font-normal">U</th>
            <th className="text-left font-normal">axis n</th>
            <th className="text-right font-normal">θ</th>
            <th className="text-right font-normal"><Tex>{'e^{i\\alpha}'}</Tex></th>
          </tr>
        </thead>
        <tbody className="font-mono tabular-nums text-ink-100">
          {rows.map((r) => {
            const a = axisAngle(r.U);
            return (
              <tr key={r.name} className="border-t border-ink-800">
                <td className="py-1 font-sans"><Tex>{r.name}</Tex></td>
                <td>{fmtVec(a.axis)}</td>
                <td className="text-right">{fmtAngle(a.angle)}</td>
                <td className="text-right"><Tex>{texComplex(expi(a.globalPhase), { digits: 2 })}</Tex></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function HadamardCard({ onDemo }: { onDemo: () => void }) {
  const dec = pauliDecompose(HAD);
  const plus = apply(HAD, KET0);
  const minus = apply(HAD, stateFromAngles(Math.PI, 0));
  return (
    <Card title="Hadamard: exchanging the X and Z axes" kicker="basis change" right={<Button size="sm" onClick={onDemo}>{Icon.play} show on sphere</Button>}>
      <Tex display>{`H = \\tfrac{1}{\\sqrt2}(X + Z) \\quad (\\text{coefficients } ${texReal(dec[1].re)},\\ ${texReal(dec[3].re)})`}</Tex>
      <Tex display>{`H\\ket0 = ${texKet(plus)} = \\ket{+},\\qquad H\\ket1 = ${texKet(minus)} = \\ket{-}`}</Tex>
      <Tex display>{'H = i\\,R_{\\vec n_H}(\\pi),\\qquad \\vec n_H = \\tfrac{1}{\\sqrt2}(1, 0, 1)'}</Tex>
      <p className="text-[12.5px] leading-relaxed text-ink-400">
        A half-turn about the diagonal between <Tex>{'x'}</Tex> and <Tex>{'z'}</Tex> swaps those two axes and reverses <Tex>{'y'}</Tex>. Hence <Tex>{'HZH = X'}</Tex>: measuring in
        the X basis is the same as applying <Tex>{'H'}</Tex>, measuring in the Z basis, and applying <Tex>{'H'}</Tex> again. Turn on <em>whole-sphere action</em> to watch all six
        basis states move rigidly.
      </p>
    </Card>
  );
}

export default function GatesModule(_props: { subpath: string }) {
  return (
    <HighlightProvider tips={TIPS}>
      <GatesInner />
    </HighlightProvider>
  );
}

