import { useCallback, useMemo, useRef, useState } from 'react';
import { BlochCanvas, Arrow, AxisLine, PointMarker, Trail, StateArrow } from '../../components/bloch';
import { Tex } from '../../components/Tex';
import { Card, Slider, Button, Segmented, KV, Callout, Label } from '../../components/ui';
import { PredictionCard } from '../../components/Prediction';
import { PlaybackBar } from '../../components/Playback';
import { useTween } from '../../hooks/animation';
import { COLORS } from '../../theme';
import {
  Mat2,
  Vec2,
  Vec3,
  PRESETS,
  H,
  PX,
  PY,
  PZ,
  Rn,
  matProd,
  matSub,
  frobenius,
  apply,
  blochVector,
  stateFromAngles,
  fidelity,
  axisAngle,
  texMatrix,
  texAngle,
  fmt,
  equalUpToGlobalPhase,
  vecApproxEq,
} from '../../quantum';
import { operatorAxis, pauliName, unitaryPath } from './pauliMath';

type Inner = 'x' | 'y' | 'z';
const AXES: Record<Inner, Vec3> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
const PAULI: Record<Inner, Mat2> = { x: PX, y: PY, z: PZ };
const NAME: Record<Inner, string> = { x: 'X', y: 'Y', z: 'Z' };
const H_AXIS = axisAngle(H).axis;

interface SeqStep {
  tex: string;
  /** partial unitary at progress s */
  at: (s: number) => Mat2;
  axis: Vec3;
  U: Mat2;
}

const fmtVec = (v: readonly number[]) => `(${fmt(v[0], 2)}, ${fmt(v[1], 2)}, ${fmt(v[2], 2)})`;

/** Name of the rotation R_{n'}(θ): returns e.g. "R_z(θ)" or "R_y(-θ)". */
function rotName(n: Vec3, th: string): string {
  const idx = n.findIndex((c) => Math.abs(Math.abs(c) - 1) < 1e-9);
  if (idx < 0) return `R_{\\vec n'}(${th})`;
  const ax = 'xyz'[idx];
  return n[idx] > 0 ? `R_${ax}(${th})` : `R_${ax}(-${th})`;
}

export function useHadamardConj() {
  const [theta, setTheta] = useState(Math.PI / 2);
  const [inner, setInner] = useState<Inner>('x');
  const [psi, setPsi] = useState<Vec2>(stateFromAngles(Math.PI / 2, Math.PI / 2));
  const [cursor, setCursor] = useState(0);
  const [anim, setAnim] = useState<{ k: number; dir: 1 | -1 } | null>(null);
  const [playing, setPlaying] = useState(false);
  const tween = useTween();
  const playingRef = useRef(false);

  const steps: SeqStep[] = useMemo(() => {
    const n = AXES[inner];
    return [
      { tex: 'H', at: (s) => unitaryPath(H, s), axis: H_AXIS, U: H },
      { tex: `R_${inner}(\\theta)`, at: (s) => Rn(n, s * theta), axis: n, U: Rn(n, theta) },
      { tex: 'H', at: (s) => unitaryPath(H, s), axis: H_AXIS, U: H },
    ];
  }, [inner, theta]);
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  const states = useMemo(() => {
    const out: Vec2[] = [psi];
    steps.forEach((st) => out.push(apply(st.U, out[out.length - 1])));
    return out;
  }, [psi, steps]);

  // the equivalent single rotation: axis n' of H σ_n H, same angle
  const nPrime = operatorAxis(matProd(H, PAULI[inner], H))!;
  const ghostU = Rn(nPrime, theta);
  const ghost = apply(ghostU, psi);

  const run = useCallback(
    (k: number, dir: 1 | -1) => {
      setAnim({ k, dir });
      tween.start(900, () => {
        setAnim(null);
        const next = dir === 1 ? k + 1 : k;
        setCursor(next);
        if (dir === 1 && playingRef.current && next < 3) window.setTimeout(() => playingRef.current && runRef.current(next, 1), 200);
        else {
          playingRef.current = false;
          setPlaying(false);
        }
      });
    },
    [tween],
  );
  const runRef = useRef(run);
  runRef.current = run;

  const resetSeq = () => {
    playingRef.current = false;
    setPlaying(false);
    if (anim) tween.cancel();
    setAnim(null);
    setCursor(0);
  };

  const s = anim ? (anim.dir === 1 ? tween.progress : 1 - tween.progress) : 1;
  const shown: Vec2 = anim ? apply(steps[anim.k].at(s), states[anim.k]) : states[cursor];

  return {
    theta, setTheta: (v: number) => { resetSeq(); setTheta(v); },
    inner, setInner: (v: Inner) => { resetSeq(); setInner(v); },
    psi, setPsi: (v: Vec2) => { resetSeq(); setPsi(v); },
    cursor, anim, playing, steps, states, nPrime, ghostU, ghost, shown, s,
    stepForward: () => !anim && cursor < 3 && run(cursor, 1),
    stepBack: () => !anim && cursor > 0 && run(cursor - 1, -1),
    toggle: () => {
      if (playing) { playingRef.current = false; setPlaying(false); return; }
      playingRef.current = true;
      setPlaying(true);
      if (anim) return;
      if (cursor >= 3) { setCursor(0); window.setTimeout(() => runRef.current(0, 1), 60); } else run(cursor, 1);
    },
    replay: () => {
      if (anim) tween.cancel();
      setAnim(null);
      setCursor(0);
      playingRef.current = true;
      setPlaying(true);
      window.setTimeout(() => runRef.current(0, 1), 100);
    },
    reset: resetSeq,
  };
}
type HC = ReturnType<typeof useHadamardConj>;

export function HadamardViz({ hc }: { hc: HC }) {
  const { steps, states, cursor, anim, s, shown, ghost, psi, nPrime, theta } = hc;
  // trails of the completed steps plus the one in progress — all from the actual unitaries
  const trails = useMemo(() => {
    const out: { pts: Vec3[]; k: number }[] = [];
    const last = anim ? anim.k : cursor - 1;
    for (let k = 0; k <= last; k++) {
      const upTo = anim && k === anim.k ? s : 1;
      const pts: Vec3[] = [];
      const m = 40;
      for (let j = 0; j <= m; j++) pts.push(blochVector(apply(steps[k].at((upTo * j) / m), states[k])));
      out.push({ pts, k });
    }
    return out;
  }, [anim, cursor, s, steps, states]);
  const ghostPath = useMemo(() => {
    const pts: Vec3[] = [];
    for (let j = 0; j <= 48; j++) pts.push(blochVector(apply(Rn(nPrime, (theta * j) / 48), psi)));
    return pts;
  }, [nPrime, theta, psi]);
  const focusK = anim ? anim.k : Math.min(cursor, 2);
  const focus = steps[focusK];
  const done = cursor === 3 && !anim;
  return (
    <BlochCanvas
      overlay={
        <>
          <div className="absolute left-3 top-3 rounded-lg bg-ink-900/75 px-3 py-2 text-[12.5px] ring-1 ring-ink-700 backdrop-blur">
            <Label className="mb-1">sequence</Label>
            <div className="flex items-center gap-1.5 text-[13px]">
              <Tex>{'\\ket\\psi'}</Tex>
              {steps.map((st, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  <span className="text-ink-500">→</span>
                  <span className={`rounded px-1.5 py-0.5 ring-1 ring-inset ${anim?.k === i ? 'bg-axis/25 ring-axis' : i < cursor ? 'bg-ink-700 ring-ink-500' : 'ring-ink-700 text-ink-400'}`}>
                    <Tex>{st.tex}</Tex>
                  </span>
                </span>
              ))}
            </div>
          </div>
          <div className="absolute right-3 top-3 hidden rounded-lg bg-ink-900/75 px-3 py-1.5 text-[12px] ring-1 ring-ink-700 backdrop-blur sm:block">
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: COLORS.phase }} />
            ghost: <Tex>{`${rotName(nPrime, '\\theta')}\\ket\\psi`}</Tex>
            {done && <span className="ml-2 text-good">✓ coincide</span>}
          </div>
        </>
      }
    >
      <AxisLine n={focus.axis} color={COLORS.axis} dashed={!anim} label={focus.tex === 'H' ? '\\vec n_H' : AXESLABEL(focus.axis)} />
      <Trail points={ghostPath} color={COLORS.phase} dashed fade={false} lineWidth={1.4} opacity={0.8} />
      <PointMarker v={blochVector(ghost)} color={COLORS.phase} size={0.06} ring />
      <Arrow v={blochVector(psi)} color={COLORS.state} opacity={0.25} radius={0.014} />
      {trails.map((t) => (
        <Trail key={t.k} points={t.pts} color={t.k === 1 ? COLORS.state : COLORS.axis} lineWidth={2} fade={false} opacity={0.9} />
      ))}
      <StateArrow v={blochVector(shown)} />
    </BlochCanvas>
  );
}

const AXESLABEL = (n: Vec3) => (Math.abs(n[0]) > 0.99 ? 'x' : Math.abs(n[1]) > 0.99 ? 'y' : 'z');

export function HadamardControls({ hc }: { hc: HC }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="Sandwich a rotation between Hadamards" kicker="H R_n(θ) H">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-[12.5px] text-ink-300">inner rotation</span>
            <Segmented value={hc.inner} onChange={hc.setInner} options={(['x', 'y', 'z'] as Inner[]).map((a) => ({ value: a, label: a, tex: `R_${a}` }))} />
          </div>
          <Slider tex="\theta" label="rotation angle" value={hc.theta} min={0} max={2 * Math.PI} onChange={hc.setTheta} format={(v) => texAngle(v, { inline: true })} color={COLORS.axis} />
          <PlaybackBar playing={hc.playing} onToggle={hc.toggle} onReset={hc.reset} onStepBack={hc.stepBack} onStepForward={hc.stepForward} onReplay={hc.replay}>
            <span className="ml-1 text-[12px] text-ink-400">
              step <span className="font-mono text-ink-200">{hc.cursor}</span>/3
            </span>
          </PlaybackBar>
        </div>
      </Card>
      <Card title="Input state" kicker="any state works">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((pr) => (
            <Button key={pr.id} size="sm" active={equalUpToGlobalPhase(hc.psi, stateFromAngles(pr.theta, pr.phi))} onClick={() => hc.setPsi(stateFromAngles(pr.theta, pr.phi))}>
              <Tex>{pr.tex}</Tex>
            </Button>
          ))}
          <Button size="sm" onClick={() => hc.setPsi(stateFromAngles(1.0, 2.2))}>generic</Button>
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-400">
          The golden ghost is where a single <Tex>{rotName(hc.nPrime, '\\theta')}</Tex> would take the input. Step through the three gates and watch the blue state land on it — for
          every input, which is what an operator identity means.
        </p>
      </Card>
    </div>
  );
}

export function HadamardPanel({ hc }: { hc: HC }) {
  const conj = (P: Mat2) => matProd(H, P, H);
  const sandwich = matProd(H, hc.steps[1].U, H);
  const err = frobenius(matSub(sandwich, hc.ghostU));
  const final = hc.states[3];
  const th = texAngle(hc.theta, { inline: true });
  const n = NAME[hc.inner];
  const nn = rotName(hc.nPrime, th);
  return (
    <>
      <Card title="Hadamard conjugation of the Paulis" kicker="basis change">
        {(['x', 'y', 'z'] as Inner[]).map((a) => (
          <Tex key={a} display>{`H${NAME[a]}H = ${texMatrix(conj(PAULI[a]))} = ${pauliName(conj(PAULI[a]))}`}</Tex>
        ))}
        <p className="text-[12.5px] leading-relaxed text-ink-400">
          <Tex>{'H'}</Tex> is a half-turn about <Tex>{'(x+z)/\\sqrt2'}</Tex>: it swaps the x and z axes and flips y. Since <Tex>{'H = H^\\dagger = H^{-1}'}</Tex>, it is the
          change of basis between the eigenvectors of <Tex>{'X'}</Tex> and <Tex>{'Z'}</Tex>.
        </p>
      </Card>
      <Card title="Conjugating a rotation" kicker="moving the axis">
        <Tex display>{`H\\,R_${hc.inner}(${th})\\,H = ${texMatrix(sandwich, { digits: 3 })}`}</Tex>
        <Tex display>{`${nn} = ${texMatrix(hc.ghostU, { digits: 3 })}`}</Tex>
        <div className="space-y-0.5">
          <KV k={<Tex>{`\\|HR_${hc.inner}H - ${rotName(hc.nPrime, '\\theta')}\\|`}</Tex>} v={<span className="text-good">{err.toExponential(1)}</span>} />
          <KV k={<span>final state vs ghost <Tex>{'|\\langle\\cdot|\\cdot\\rangle|^2'}</Tex></span>} v={fmt(fidelity(final, hc.ghost), 6)} />
          <KV k="equal as vectors (no phase)" v={vecApproxEq(final, hc.ghost, 1e-9) ? '✓' : '✗'} />
        </div>
        <Label className="mb-1 mt-3">derivation</Label>
        <Tex display>
          {`\\begin{aligned} H R_${hc.inner}(\\theta) H &= H\\, e^{-i\\theta ${n}/2}\\, H \\\\ &= e^{-i\\theta\\,(H${n}H)/2} \\quad (\\text{conjugation rule, } U = H = H^\\dagger) \\\\ &= ${rotName(hc.nPrime, '\\theta')} \\end{aligned}`}
        </Tex>
        <p className="text-[12.5px] leading-relaxed text-ink-400">
          The identity <Tex>{'e^{U^\\dagger AU} = U^\\dagger e^A U'}</Tex> holds because <Tex>{'(U^\\dagger A U)^k = U^\\dagger A^k U'}</Tex> — the inner <Tex>{'UU^\\dagger = I'}</Tex> cancel — so the series for{' '}
          <Tex>{'e^{U^\\dagger AU}'}</Tex> is <Tex>{'U^\\dagger e^{A} U'}</Tex> term by term.
        </p>
      </Card>
      <Callout tone="insight" title="Conjugation rotates the axis, keeps the angle">
        <Tex display>{"U R_{\\vec n}(\\theta) U^\\dagger = R_{\\vec n'}(\\theta), \\qquad \\vec n' = R_U\\,\\vec n"}</Tex>
        Here <Tex>{'\\vec n = '}</Tex>
        <span className="font-mono">{fmtVec(AXES[hc.inner])}</span> becomes <Tex>{"\\vec n' = "}</Tex>
        <span className="font-mono">{fmtVec(hc.nPrime)}</span>. Doing a rotation “in a rotated frame” is the same as rotating about the rotated axis.
      </Callout>
      <PredictionCard
        question={
          <>
            What is <Tex>{'H R_y(\\theta) H'}</Tex>?
          </>
        }
        options={[
          { id: 'ry', label: <Tex>{'R_y(\\theta)'}</Tex> },
          { id: 'rym', label: <Tex>{'R_y(-\\theta)'}</Tex> },
          { id: 'rx', label: <Tex>{'R_x(\\theta)'}</Tex> },
          { id: 'rz', label: <Tex>{'R_z(\\theta)'}</Tex> },
        ]}
        answer="rym"
        onRun={() => {
          hc.setInner('y');
          window.setTimeout(() => hc.replay(), 80);
        }}
        explanation={
          <p>
            <Tex>{'HYH = -Y'}</Tex> (the half-turn about <Tex>{'(x+z)/\\sqrt2'}</Tex> reverses the y axis), so <Tex>{'HR_y(\\theta)H = e^{-i\\theta(-Y)/2} = R_y(-\\theta)'}</Tex>: the
            same axis, but the rotation runs backwards. The ghost now sits on the opposite side of the y axis.
          </p>
        }
      />
    </>
  );
}
