import { useMemo, useRef, useState } from 'react';
import { Line } from '@react-three/drei';
import { ModuleShell } from '../../layout/ModuleShell';
import { BlochCanvas, StateArrow, AxisLine, PointMarker, ProjectionOnAxis, DragHandle, Label3D, toThree } from '../../components/bloch';
import { ComplexPlane } from '../../components/ComplexPlane';
import { ProbabilityBars, Histogram } from '../../components/charts';
import { Tex } from '../../components/Tex';
import { Card, Slider, Button, KV, Callout, Label, Segmented, Swatch } from '../../components/ui';
import { PredictionCard } from '../../components/Prediction';
import { HighlightProvider, useHighlight } from '../../components/Highlight';
import { COLORS } from '../../theme';
import {
  PRESETS,
  Vec3,
  stateFromAngles,
  blochVector,
  anglesFromBloch,
  inner,
  abs2,
  apply,
  norm,
  vsub,
  vadd,
  dot3,
  cross3,
  normalize3,
  scale3,
  add3,
  mulberry32,
  probabilitiesFromBloch,
  texMatrix,
  texComplex,
  texColumn,
  texAngle,
  texReal,
  fmt,
} from '../../quantum';
import { OpId, opSpec, texCharPoly } from './ops';

const TIPS: Record<string, string> = {
  lambda: 'λ — an eigenvalue of the observable. It is the number the apparatus records: here always +1 or −1.',
  vplus: '|v₊⟩ — eigenvector for λ = +1. After recording +1, the qubit is left in this state.',
  vminus: '|v₋⟩ — eigenvector for λ = −1. After recording −1, the qubit is left in this state.',
  cplus: 'c₊ = ⟨v₊|ψ⟩ — the amplitude of |ψ⟩ along |v₊⟩ (a complex projection).',
  cminus: 'c₋ = ⟨v₋|ψ⟩ — the amplitude of |ψ⟩ along |v₋⟩ (a complex projection).',
  pplus: 'P(+1) = |c₊|² = (1 + n·r)/2. On the sphere: half the distance from −n to the foot of the projection.',
  pminus: 'P(−1) = |c₋|² = (1 − n·r)/2. On the sphere: half the distance from the foot of the projection to +n.',
  expect: '⟨A⟩ = P(+1) − P(−1) = n·r — the average recorded value over many runs.',
  foot: 'Foot of the perpendicular from the Bloch vector onto the measurement axis, at position n·r.',
};

const OPS: { value: OpId; label: string; tex: string }[] = [
  { value: 'X', label: 'X', tex: 'X' },
  { value: 'Y', label: 'Y', tex: 'Y' },
  { value: 'Z', label: 'Z', tex: 'Z' },
  { value: 'H', label: 'H', tex: 'H' },
  { value: 'n', label: 'n·σ', tex: '\\vec n\\cdot\\vec\\sigma' },
];

/** Two coloured segments on the measurement diameter: [−n, foot] has length 2P(+), [foot, +n] has length 2P(−). */
function BornSegments({ n, r, active }: { n: Vec3; r: Vec3; active: string | null }) {
  const u = normalize3(n);
  const d = dot3(u, r);
  const foot = scale3(u, d);
  const minusEnd = scale3(u, -1);
  const plusEnd = u;
  const helper: Vec3 = Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const perp = scale3(normalize3(cross3(u, helper)), 0.16);
  const midP = add3(scale3(add3(minusEnd, foot), 0.5), perp);
  const midM = add3(scale3(add3(foot, plusEnd), 0.5), perp);
  const hotP = active === 'pplus';
  const hotM = active === 'pminus';
  return (
    <group>
      {1 + d > 1e-3 && (
        <>
          <Line points={[toThree(minusEnd), toThree(foot)]} color={COLORS.p0} lineWidth={hotP ? 8 : 5} transparent opacity={0.9} />
          <Label3D position={midP} tex="2P(+1)" color={COLORS.p0} size={hotP ? 13.5 : 11.5} />
        </>
      )}
      {1 - d > 1e-3 && (
        <>
          <Line points={[toThree(foot), toThree(plusEnd)]} color={COLORS.p1} lineWidth={hotM ? 8 : 5} transparent opacity={0.9} />
          <Label3D position={midM} tex="2P(-1)" color={COLORS.p1} size={hotM ? 13.5 : 11.5} />
        </>
      )}
    </group>
  );
}

function EigenInner() {
  const [op, setOp] = useState<OpId>('Z');
  const [nTheta, setNTheta] = useState(Math.PI / 3);
  const [nPhi, setNPhi] = useState(Math.PI / 6);
  const [theta, setTheta] = useState(Math.PI / 3);
  const [phi, setPhi] = useState(Math.PI / 5);
  const [measured, setMeasured] = useState<{ outcome: 1 | -1; key: string } | null>(null);
  const [tally, setTally] = useState<{ plus: number; minus: number; key: string } | null>(null);
  const rng = useRef(mulberry32((Math.random() * 2 ** 31) | 0));
  const { active } = useHighlight();

  const spec = useMemo(() => opSpec(op, nTheta, nPhi), [op, nTheta, nPhi]);
  const psi = useMemo(() => stateFromAngles(theta, phi), [theta, phi]);
  const r = useMemo(() => blochVector(psi), [psi]);
  const cPlus = inner(spec.plus, psi);
  const cMinus = inner(spec.minus, psi);
  const pPlus = abs2(cPlus);
  const pMinus = abs2(cMinus);
  const geo = probabilitiesFromBloch(r, spec.axis);
  const nr = dot3(spec.axis, r);
  const Avp = apply(spec.matrix, spec.plus);
  const Avm = apply(spec.matrix, spec.minus);
  const resP = norm(vsub(Avp, spec.plus));
  const resM = norm(vadd(Avm, spec.minus));
  const ortho = abs2(inner(spec.plus, spec.minus));
  const cp = texCharPoly(spec.matrix);

  const key = `${op}|${nTheta}|${nPhi}|${theta}|${phi}`;
  const lastOutcome = measured && measured.key === key ? measured.outcome : null;
  const counts = tally && tally.key === key ? tally : null;

  const setFromBloch = (v: Vec3) => {
    const a = anglesFromBloch(v);
    setTheta(a.theta);
    if (Math.hypot(v[0], v[1]) > 1e-3) setPhi(a.phi);
  };

  const measureOnce = () => {
    const outcome: 1 | -1 = rng.current() < pPlus ? 1 : -1;
    const target = outcome === 1 ? spec.axis : scale3(spec.axis, -1);
    const a = anglesFromBloch(target);
    const nt = a.theta;
    const np = Math.hypot(target[0], target[1]) > 1e-9 ? a.phi : phi;
    setTheta(nt);
    setPhi(np);
    setMeasured({ outcome, key: `${op}|${nTheta}|${nPhi}|${nt}|${np}` });
  };

  const measureCopies = (n: number) => {
    let plus = counts?.plus ?? 0;
    let minus = counts?.minus ?? 0;
    for (let k = 0; k < n; k++) {
      if (rng.current() < pPlus) plus++;
      else minus++;
    }
    setTally({ plus, minus, key });
  };

  const viz = (
    <BlochCanvas
      overlay={
        <>
          <div className="pointer-events-auto absolute left-3 top-3 rounded-lg bg-ink-900/75 p-2 ring-1 ring-ink-700 backdrop-blur">
            <Label className="mb-1">measure along</Label>
            <Segmented size="sm" value={op} onChange={setOp} options={OPS} />
          </div>
          <div className="absolute right-3 top-3 rounded-lg bg-ink-900/75 px-3 py-2 text-[12.5px] ring-1 ring-ink-700 backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <span style={{ color: COLORS.p0 }}>
                <Tex>{'P(+1)'}</Tex>
              </span>
              <span className="font-mono tabular-nums text-ink-100">{fmt(pPlus)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span style={{ color: COLORS.p1 }}>
                <Tex>{'P(-1)'}</Tex>
              </span>
              <span className="font-mono tabular-nums text-ink-100">{fmt(pMinus)}</span>
            </div>
          </div>
          <div className="absolute bottom-2 left-3 hidden max-w-[70%] text-[11.5px] text-ink-400 sm:block">
            Drag the state. The dashed perpendicular drops onto the measurement axis; its foot splits the diameter into lengths 2P(+1) and 2P(−1).
          </div>
        </>
      }
    >
      <AxisLine n={spec.axis} color={COLORS.axis} dashed lineWidth={1.2} opacity={0.75} length={1.38} />
      <BornSegments n={spec.axis} r={r} active={active} />
      <PointMarker v={spec.axis} color={COLORS.p0} label={spec.plusKet} ring />
      <PointMarker v={scale3(spec.axis, -1)} color={COLORS.p1} label={spec.minusKet} ring />
      <ProjectionOnAxis v={r} n={spec.axis} color={active === 'foot' ? COLORS.text : COLORS.muted} />
      <StateArrow v={r} emphasized={active === 'psi'} />
      <DragHandle v={r} onChange={setFromBloch} />
    </BlochCanvas>
  );

  const controls = (
    <>
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="Input state" kicker="what is being measured">
        <div className="space-y-3">
          <Slider tex="\theta" label="polar angle" value={theta} min={0} max={Math.PI} onChange={setTheta} format={(v) => texAngle(v, { inline: true })} hl="theta" color={COLORS.text} />
          <Slider tex="\varphi" label="azimuth" value={phi} min={0} max={2 * Math.PI} onChange={setPhi} format={(v) => texAngle(v, { inline: true })} hl="phi" color={COLORS.phase} />
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <Button key={p.id} size="sm" title={p.description} onClick={() => { setTheta(p.theta); setPhi(p.phi); }}>
                <Tex>{p.tex}</Tex>
              </Button>
            ))}
          </div>
        </div>
      </Card>
      <Card title="Measurement basis" kicker="the observable">
        <div className="space-y-3">
          <Segmented value={op} onChange={setOp} options={OPS} />
          {op === 'n' ? (
            <>
              <Slider tex="\theta_n" label="axis polar angle" value={nTheta} min={0} max={Math.PI} onChange={setNTheta} format={(v) => texAngle(v, { inline: true })} hl="n" color={COLORS.axis} />
              <Slider tex="\varphi_n" label="axis azimuth" value={nPhi} min={0} max={2 * Math.PI} onChange={setNPhi} format={(v) => texAngle(v, { inline: true })} hl="n" color={COLORS.axis} />
            </>
          ) : (
            <p className="text-[12.5px] leading-relaxed text-ink-400">
              {op === 'H' ? (
                <>
                  The Hadamard matrix is Hermitian too, so it is an observable: <Tex>{'H = (X+Z)/\\sqrt2'}</Tex>, i.e. spin along <Tex>{'(\\hat x+\\hat z)/\\sqrt2'}</Tex>.
                </>
              ) : (
                <>
                  Choose <Tex>{'\\vec n\\cdot\\vec\\sigma'}</Tex> to measure spin along an arbitrary axis.
                </>
              )}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Swatch color={COLORS.state}>state |ψ⟩</Swatch>
            <Swatch color={COLORS.axis}>measurement axis</Swatch>
            <Swatch color={COLORS.p0}>outcome +1</Swatch>
            <Swatch color={COLORS.p1}>outcome −1</Swatch>
          </div>
        </div>
      </Card>
    </div>
    <div className="grid items-start gap-4 md:grid-cols-2">
        <Card title="Measure" kicker="sample the Born rule">
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="primary" onClick={measureOnce}>
              Measure once (collapse)
            </Button>
            <Button size="sm" onClick={() => measureCopies(200)}>
              Measure 200 fresh copies
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setTally(null)}>
              Clear
            </Button>
          </div>
          {lastOutcome !== null && (
            <div className="mt-3 animate-fadein rounded-lg bg-ink-800 p-3 text-[13px] leading-relaxed text-ink-200 ring-1 ring-inset ring-ink-700">
              Recorded <Tex>{`\\lambda = ${lastOutcome === 1 ? '+1' : '-1'}`}</Tex>. The state collapsed to{' '}
              <Tex>{lastOutcome === 1 ? spec.plusKet : spec.minusKet}</Tex> — measure again and you get <Tex>{lastOutcome === 1 ? '+1' : '-1'}</Tex> with certainty
              (<Tex>{`P = ${fmt(lastOutcome === 1 ? pPlus : pMinus)}`}</Tex>).
            </div>
          )}
          {counts && (
            <div className="mt-3">
              <Histogram
                height={120}
                bins={[
                  { label: '+1', count: counts.plus, expected: pPlus, color: COLORS.p0 },
                  { label: '-1', count: counts.minus, expected: pMinus, color: COLORS.p1 },
                ]}
              />
            </div>
          )}
        </Card>

        <PredictionCard
          question={
            <>
              Prepare <Tex>{'\\ket 0'}</Tex> and measure the Hadamard observable <Tex>{'H'}</Tex>. How likely is the outcome <Tex>{'+1'}</Tex>?
            </>
          }
          options={[
            { id: 'half', label: <>exactly <Tex>{'1/2'}</Tex>, like an X measurement</> },
            { id: 'one', label: <>certain: <Tex>{'H\\ket0'}</Tex> is a nice state</> },
            { id: 'cos', label: <><Tex>{'\\cos^2(\\pi/8) \\approx 0.854'}</Tex></> },
            { id: 'zero', label: <>impossible</> },
          ]}
          answer="cos"
          onRun={() => {
            setOp('H');
            setTheta(0);
            setPhi(0);
          }}
          explanation={
            <>
              <p>
                The <Tex>{'+1'}</Tex> eigenvector of <Tex>{'H'}</Tex> points along <Tex>{'(\\hat x+\\hat z)/\\sqrt2'}</Tex>, only 45° from <Tex>{'\\ket0'}</Tex>. So{' '}
                <Tex>{'P(+1) = \\tfrac12(1 + \\vec n\\cdot\\vec r) = \\tfrac12(1 + \\tfrac{1}{\\sqrt2}) = \\cos^2\\tfrac{\\pi}{8}'}</Tex>.
              </p>
              <p>
                Note that <Tex>{'H\\ket0 = \\ket+'}</Tex> is the gate acting on the state — a different question. Measuring an observable never applies the matrix to the state;
                it projects onto one of its eigenvectors.
              </p>
            </>
          }
        />
    </div>
    <div className="grid items-start gap-4 md:grid-cols-2">
        <Callout tone="insight" title="Eigenvalue = outcome, eigenvector = state afterwards">
          <p>
            Measuring <Tex>{'A'}</Tex> records one eigenvalue <Tex>{'\\lambda'}</Tex> and leaves the qubit in the matching eigenvector. The probabilities come from expanding{' '}
            <Tex>{'\\ket\\psi'}</Tex> in the eigenbasis — the measurement basis is chosen by the apparatus, not by the state.
          </p>
        </Callout>

        <Callout tone="info" title="Why the squared magnitude?">
          <p>
            The amplitudes <Tex>{'c_\\pm'}</Tex> are complex: they carry a phase that cannot be a probability (a probability must be real, non-negative and phase-independent).{' '}
            <Tex>{'|c_\\pm|^2'}</Tex> is the unique natural choice: it ignores phase, and because <Tex>{'\\{\\ket{v_+},\\ket{v_-}\\}'}</Tex> is orthonormal, Pythagoras gives{' '}
            <Tex>{'|c_+|^2 + |c_-|^2 = \\langle\\psi|\\psi\\rangle = 1'}</Tex> in <em>every</em> basis. Unitary changes of basis preserve this sum.
          </p>
        </Callout>
    </div>
    </>
  );

  const nCoeffs = `(${texReal(spec.axis[0], { digits: 2 })},\\,${texReal(spec.axis[1], { digits: 2 })},\\,${texReal(spec.axis[2], { digits: 2 })})`;

  const panel = (
    <>
      <Card title="The observable" kicker="Hermitian matrix">
        <Tex display>{`A = ${spec.tex} = ${texMatrix(spec.matrix)}`}</Tex>
        {op === 'n' && <Tex display>{`\\vec n = ${nCoeffs},\\qquad \\vec n\\cdot\\vec\\sigma = \\begin{pmatrix} n_z & n_x - i n_y \\\\ n_x + i n_y & -n_z\\end{pmatrix}`}</Tex>}
        <p className="text-[12px] leading-relaxed text-ink-400">
          <Tex>{'A = A^\\dagger'}</Tex> (real eigenvalues, orthogonal eigenvectors) and <Tex>{'A^2 = I'}</Tex> (so every eigenvalue squares to 1).
        </p>
      </Card>

      <Card title="Eigenvalues" kicker="characteristic polynomial">
        <Tex display>{`\\begin{aligned} \\det(A - \\lambda I) &= ${cp.det} \\\\ &= ${cp.product} \\\\ &= \\lambda^2 - (\\operatorname{tr}A)\\,\\lambda + \\det A = \\lambda^2 - 1 = 0 \\end{aligned}`}</Tex>
        <Tex display>{'\\Rightarrow\\quad \\hl{lambda}{\\lambda_\\pm} = \\pm 1'}</Tex>
        <p className="text-[12px] leading-relaxed text-ink-400">
          All Pauli-type observables have <Tex>{'\\operatorname{tr}A = 0'}</Tex> and <Tex>{'\\det A = -1'}</Tex>. The eigenvalues are the only values the apparatus can ever record.
        </p>
      </Card>

      <Card title="Normalized eigenvectors" kicker="measurement basis">
        <Tex display>{`\\hl{vplus}{\\ket{v_+}} = ${spec.plusKet} = ${spec.plusCol}`}</Tex>
        <Tex display>{`\\hl{vminus}{\\ket{v_-}} = ${spec.minusKet} = ${spec.minusCol}`}</Tex>
        <Label className="mb-1 mt-2">live check</Label>
        <Tex display>{`A\\ket{v_+} = ${texColumn(Avp)} = (+1)\\ket{v_+}`}</Tex>
        <Tex display>{`A\\ket{v_-} = ${texColumn(Avm)} = (-1)\\ket{v_-}`}</Tex>
        <div className="mt-1 space-y-0.5">
          <KV k={<Tex>{'\\|A v_+ - v_+\\|,\\ \\|A v_- + v_-\\|'}</Tex>} v={`${resP.toExponential(1)}, ${resM.toExponential(1)}`} />
          <KV k={<Tex>{'|\\langle v_+|v_-\\rangle|^2'}</Tex>} v={ortho.toExponential(1)} />
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-400">
          Orthogonal in <Tex>{'\\mathbb C^2'}</Tex>, antipodal on the Bloch sphere. Any eigenvector times a phase <Tex>{'e^{i\\gamma}'}</Tex> is equally valid; we fix the first entry real and non-negative.
        </p>
      </Card>

      <Card title="Born rule" kicker="projections → probabilities" right={<div className="flex gap-3"><Swatch color={COLORS.p0}>c₊</Swatch><Swatch color={COLORS.p1}>c₋</Swatch></div>}>
        <Tex display>{'\\ket\\psi = \\hl{cplus}{c_+}\\ket{v_+} + \\hl{cminus}{c_-}\\ket{v_-},\\qquad c_\\pm = \\langle v_\\pm|\\psi\\rangle'}</Tex>
        <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-center gap-3">
          <ComplexPlane
            showRelative={false}
            amplitudes={[
              { z: cPlus, color: COLORS.p0, label: 'c_+', hl: 'cplus' },
              { z: cMinus, color: COLORS.p1, label: 'c_-', hl: 'cminus' },
            ]}
          />
          <div className="space-y-1 text-[12.5px]">
            <Tex>{`c_+ = ${texComplex(cPlus)}`}</Tex>
            <br />
            <Tex>{`c_- = ${texComplex(cMinus)}`}</Tex>
            <div className="pt-1 text-[12px] leading-relaxed text-ink-400">
              The arrows' <em>lengths</em> carry the probabilities; their angles (phases) do not.
            </div>
          </div>
        </div>
        <Tex display>{'\\hl{pplus}{P(\\pm1)} = |c_\\pm|^2 = \\tfrac12\\big(1 \\pm \\hl{n}{\\vec n}\\cdot\\hl{bloch}{\\vec r}\\big)'}</Tex>
        <ProbabilityBars
          items={[
            { label: 'P(+1)', p: pPlus, color: COLORS.p0, hl: 'pplus' },
            { label: 'P(-1)', p: pMinus, color: COLORS.p1, hl: 'pminus' },
          ]}
        />
        <div className="mt-2 space-y-0.5">
          <KV k={<Tex>{'|c_+|^2 + |c_-|^2'}</Tex>} v={fmt(pPlus + pMinus)} />
          <KV k={<Tex>{'\\tfrac12(1 \\pm \\vec n\\cdot\\vec r)'}</Tex>} v={`${fmt(geo.plus)} / ${fmt(geo.minus)}`} hl="foot" />
          <KV k={<Tex>{'\\hl{expect}{\\langle A\\rangle} = P(+1) - P(-1) = \\vec n\\cdot\\vec r'}</Tex>} v={fmt(nr)} hl="expect" />
        </div>
      </Card>

    </>
  );

  return (
    <ModuleShell
      letter="G"
      title="Eigenvectors, eigenvalues & measurement bases"
      intro={
        <p>
          A measurement is specified by a Hermitian observable. Its eigenvalues are the possible readings, its eigenvectors form the measurement basis, and the Born rule turns
          the overlaps <Tex>{'\\langle v_\\pm|\\psi\\rangle'}</Tex> into probabilities. On the Bloch sphere the whole story is a perpendicular projection onto an axis.
        </p>
      }
      viz={viz}
      controls={controls}
      panel={panel}
    />
  );
}

export default function EigenModule(_props: { subpath: string }) {
  return (
    <HighlightProvider tips={TIPS}>
      <EigenInner />
    </HighlightProvider>
  );
}
