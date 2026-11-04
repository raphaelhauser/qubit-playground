import { ReactNode, useMemo, useRef, useState } from 'react';
import { BlochCanvas, StateArrow, AxisLine, OrbitCircle, Trail, PointMarker } from '../../components/bloch';
import { LinePlot } from '../../components/charts';
import { Tex } from '../../components/Tex';
import { Card, Slider, Button, KV, Callout, Label, Segmented, Icon, Swatch } from '../../components/ui';
import { useHighlight } from '../../components/Highlight';
import { useRaf } from '../../hooks/animation';
import { COLORS } from '../../theme';
import {
  Mat2,
  Vec2,
  Vec3,
  c,
  mat,
  matR,
  matScale,
  matSub,
  nDotSigma,
  hamiltonianMatrix,
  hamiltonianAxis,
  expm,
  expmSeries,
  frobenius,
  apply,
  norm,
  blochVector,
  isUnitary,
  axisFromAngles,
  stateFromAngles,
  texMatrix,
  texAngle,
  fmt,
  ZERO,
} from '../../quantum';
import { AxisControl, MatBox, LOG_TICKS, texSci } from './common';

type Preset = 'rot' | 'diagI' | 'diagR' | 'ham' | 'nil';
const NMAX = 30;

const INPUTS: { id: string; tex: string; psi: Vec2 }[] = [
  { id: '0', tex: '\\ket0', psi: stateFromAngles(0, 0) },
  { id: '+', tex: '\\ket{+}', psi: stateFromAngles(Math.PI / 2, 0) },
  { id: '+i', tex: '\\ket{+i}', psi: stateFromAngles(Math.PI / 2, Math.PI / 2) },
];

export function SeriesTab({ header }: { header: (viz: ReactNode, controls: ReactNode, panel: ReactNode) => ReactNode }) {
  const [preset, setPreset] = useState<Preset>('rot');
  const [theta, setTheta] = useState(Math.PI);
  const [nT, setNT] = useState(Math.PI / 2);
  const [nP, setNP] = useState(0);
  const [phiA, setPhiA] = useState(Math.PI / 2);
  const [phiB, setPhiB] = useState(-Math.PI / 4);
  const [a, setA] = useState(1);
  const [b, setB] = useState(-0.5);
  const [h, setH] = useState({ omegaBar: 0.3, deltaOmega: 0.8, epsilon: 0.5, t: 2 });
  const [s, setS] = useState(1.5);
  const [N, setN] = useState(3);
  const [input, setInput] = useState('0');
  const [anim, setAnim] = useState(false);
  const { active } = useHighlight();

  const acc = useRef(0);
  useRaf((dt) => {
    acc.current += dt;
    if (acc.current > 0.55) {
      acc.current = 0;
      if (N >= 20) setAnim(false);
      else setN(N + 1);
    }
  }, anim);

  const n = axisFromAngles(nT, nP);
  const hp = { omegaBar: h.omegaBar, deltaOmega: h.deltaOmega, epsilon: h.epsilon };
  const A: Mat2 = useMemo(() => {
    switch (preset) {
      case 'rot':
        return matScale(nDotSigma(n), c(0, -theta / 2));
      case 'diagI':
        return mat(c(0, phiA), ZERO, ZERO, c(0, phiB));
      case 'diagR':
        return matR(a, 0, 0, b);
      case 'ham':
        return matScale(hamiltonianMatrix(hp), c(0, -h.t));
      case 'nil':
        return matR(0, s, 0, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, theta, n[0], n[1], n[2], phiA, phiB, a, b, h, s]);

  const { terms, partialSums } = useMemo(() => expmSeries(A, NMAX), [A]);
  const E = useMemo(() => expm(A), [A]);
  const errors = useMemo(() => partialSums.map((S) => frobenius(matSub(S, E))), [partialSums, E]);
  const termNorms = useMemo(() => terms.map((T) => frobenius(T)), [terms]);
  const SN = partialSums[N - 1];
  const psiIn = INPUTS.find((x) => x.id === input)!.psi;
  const out = apply(SN, psiIn);
  const exact = apply(E, psiIn);
  const outNorm = norm(out);
  const exactNorm = norm(exact);
  const dirs = useMemo(() => {
    const pts: Vec3[] = [];
    for (let k = 0; k < N; k++) {
      const v = apply(partialSums[k], psiIn);
      if (norm(v) > 1e-9) pts.push(blochVector(v));
    }
    return pts;
  }, [partialSums, psiIn, N]);
  const unitaryExact = isUnitary(E, 1e-9);
  const rotAxis: Vec3 | null = preset === 'rot' ? n : preset === 'ham' ? hamiltonianAxis(hp).v : preset === 'diagI' && Math.abs(phiA - phiB) > 1e-9 ? [0, 0, 1] : null;

  const ATex: Record<Preset, string> = {
    rot: `A = -\\tfrac{i\\theta}{2}\\,(\\vec n\\cdot\\vec\\sigma),\\quad \\theta = ${texAngle(theta, { inline: true })}`,
    diagI: `A = \\begin{pmatrix} i\\varphi_1 & 0 \\\\ 0 & i\\varphi_2\\end{pmatrix}`,
    diagR: `A = \\begin{pmatrix} a & 0 \\\\ 0 & b\\end{pmatrix}`,
    ham: `A = -iHt,\\quad t = ${h.t.toFixed(2)}`,
    nil: `A = \\begin{pmatrix} 0 & s \\\\ 0 & 0\\end{pmatrix}`,
  };

  const viz = (
    <BlochCanvas
      overlay={
        <>
          <div className="absolute left-3 top-3 rounded-lg bg-ink-900/75 px-3 py-2 ring-1 ring-ink-700 backdrop-blur">
            <Label className="mb-0.5">partial sum with N = {N} terms acting on {input === '0' ? '|0⟩' : input === '+' ? '|+⟩' : '|+i⟩'}</Label>
            <div className="text-[13.5px]">
              <Tex>{`\\|S_{${N}}\\ket\\psi\\| = ${outNorm.toFixed(4)}`}</Tex>
              <span className="mx-2 text-ink-500">·</span>
              <Tex>{`\\|e^A\\ket\\psi\\| = ${exactNorm.toFixed(4)}`}</Tex>
            </div>
          </div>
          <div className="absolute bottom-2 left-3 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px]">
            <Swatch color={COLORS.state}>direction of S_N|ψ⟩</Swatch>
            <Swatch color={COLORS.phase}>earlier partial sums</Swatch>
            <Swatch color={COLORS.muted}>exact e^A|ψ⟩</Swatch>
          </div>
        </>
      }
    >
      {rotAxis && <AxisLine n={rotAxis} dashed opacity={0.8} />}
      {rotAxis && <OrbitCircle n={rotAxis} through={blochVector(psiIn)} />}
      <PointMarker v={blochVector(psiIn)} color={COLORS.faint} size={0.03} />
      {dirs.length > 1 && <Trail points={dirs} color={COLORS.phase} lineWidth={1.4} fade={false} opacity={0.7} dashed />}
      {dirs.slice(0, -1).map((d, i) => (
        <PointMarker key={i} v={d} color={COLORS.phase} size={0.025} opacity={0.4 + (0.6 * i) / Math.max(1, dirs.length)} />
      ))}
      {norm(exact) > 1e-9 && <StateArrow v={blochVector(exact)} color={COLORS.muted} opacity={0.55} />}
      {outNorm > 1e-9 && <StateArrow v={blochVector(out)} emphasized={active === 'SN'} />}
    </BlochCanvas>
  );

  const controls = (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="Choose the exponent A" kicker="presets">
        <Segmented
          size="sm"
          value={preset}
          onChange={(p) => {
            setPreset(p);
            setN(3);
            // diagonal exponents leave |0⟩ on its pole; |+⟩ shows their effect
            if (p === 'diagI' || p === 'diagR') setInput('+');
          }}
          options={[
            { value: 'rot', label: 'rotation', title: '−iθ/2 · n·σ' },
            { value: 'diagI', label: 'imag. diagonal' },
            { value: 'diagR', label: 'real diagonal' },
            { value: 'ham', label: '−iHt' },
            { value: 'nil', label: 'nilpotent' },
          ]}
        />
        <div className="mt-3 space-y-2.5">
          {preset === 'rot' && (
            <>
              <Slider tex="\theta" label="rotation angle" value={theta} min={0} max={4 * Math.PI} onChange={setTheta} format={(v) => texAngle(v, { inline: true })} color={COLORS.state} />
              <AxisControl nTheta={nT} nPhi={nP} onChange={(t, p) => { setNT(t); setNP(p); }} />
            </>
          )}
          {preset === 'diagI' && (
            <>
              <Slider tex="\varphi_1" value={phiA} min={-2 * Math.PI} max={2 * Math.PI} onChange={setPhiA} format={(v) => texAngle(v, { inline: true })} color={COLORS.phase} />
              <Slider tex="\varphi_2" value={phiB} min={-2 * Math.PI} max={2 * Math.PI} onChange={setPhiB} format={(v) => texAngle(v, { inline: true })} color={COLORS.phase} />
            </>
          )}
          {preset === 'diagR' && (
            <>
              <Slider tex="a" value={a} min={-2} max={2} step={0.01} onChange={setA} format={(v) => v.toFixed(2)} />
              <Slider tex="b" value={b} min={-2} max={2} step={0.01} onChange={setB} format={(v) => v.toFixed(2)} />
            </>
          )}
          {preset === 'ham' && (
            <>
              <Slider tex="\bar\omega" value={h.omegaBar} min={-2} max={2} step={0.01} onChange={(v) => setH({ ...h, omegaBar: v })} format={(v) => v.toFixed(2)} color={COLORS.phase} />
              <Slider tex="\Delta\omega" value={h.deltaOmega} min={-2} max={2} step={0.01} onChange={(v) => setH({ ...h, deltaOmega: v })} format={(v) => v.toFixed(2)} color={COLORS.axis} />
              <Slider tex="\epsilon" value={h.epsilon} min={-2} max={2} step={0.01} onChange={(v) => setH({ ...h, epsilon: v })} format={(v) => v.toFixed(2)} color={COLORS.axis} />
              <Slider tex="t" value={h.t} min={0} max={6} step={0.01} onChange={(v) => setH({ ...h, t: v })} format={(v) => v.toFixed(2)} />
            </>
          )}
          {preset === 'nil' && <Slider tex="s" value={s} min={-3} max={3} step={0.01} onChange={setS} format={(v) => v.toFixed(2)} />}
        </div>
      </Card>
      <Card title="Add terms one by one" kicker="truncation">
        <Slider tex="N" label="number of terms" value={N} min={1} max={NMAX} step={1} onChange={(v) => { setAnim(false); setN(Math.round(v)); }} format={(v) => String(Math.round(v))} hl="SN" />
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="primary" onClick={() => { if (!anim) setN(1); setAnim(!anim); }}>
            {anim ? Icon.pause : Icon.play} {anim ? 'pause' : 'animate from N = 1'}
          </Button>
          <Button size="sm" onClick={() => { setAnim(false); setN(Math.max(1, N - 1)); }}>{Icon.stepB}</Button>
          <Button size="sm" onClick={() => { setAnim(false); setN(Math.min(NMAX, N + 1)); }}>{Icon.stepF}</Button>
          <span className="ml-2 text-[12px] text-ink-400">acting on</span>
          <Segmented size="sm" value={input} onChange={setInput} options={INPUTS.map((x) => ({ value: x.id, label: x.id, tex: x.tex }))} />
        </div>
        <div className="mt-3">
          <LinePlot
            series={[
              { points: errors.map((e, k) => [k + 1, Math.max(e, 1e-17)] as [number, number]), color: COLORS.state, label: '\\|S_N - e^A\\|' },
              { points: termNorms.map((e, k) => [k + 1, Math.max(e, 1e-17)] as [number, number]), color: COLORS.phase, dashed: true, label: '\\|A^{k}/k!\\|,\\ k = N-1' },
            ]}
            xMin={1}
            xMax={NMAX}
            yMin={-16}
            yMax={4}
            logY
            yTicks={LOG_TICKS}
            height={170}
            cursorX={N}
            onScrub={(x) => { setAnim(false); setN(Math.max(1, Math.min(NMAX, Math.round(x)))); }}
            xLabel="number of terms N"
          />
        </div>
        <p className="mt-1 text-[11.5px] leading-relaxed text-ink-400">
          The terms first grow like <Tex>{'\\|A\\|^k'}</Tex> but the factorial always wins: the series converges for every matrix. It stalls near <Tex>{'10^{-16}'}</Tex> — double-precision round-off.
        </p>
      </Card>
    </div>
  );

  const shownTerms = Array.from({ length: Math.min(N, 6) }, (_, k) => k);
  const panel = (
    <>
      <Card title="The exponential series" kicker="definition">
        <Tex display>{'e^{A} = \\sum_{k=0}^{\\infty}\\frac{A^k}{k!} = I + A + \\frac{A^2}{2!} + \\frac{A^3}{3!} + \\cdots'}</Tex>
        <Tex display>{ATex[preset]}</Tex>
        <MatBox label="A" M={A} />
      </Card>
      <Card title={`Terms k = 0 … ${N - 1}`} kicker="the summands">
        <div className="grid grid-cols-2 gap-1.5">
          {shownTerms.map((k) => (
            <div key={k} className={`rounded-md px-1.5 py-1 ring-1 ring-inset ${k === N - 1 ? 'bg-state/[0.08] ring-state/40' : 'bg-ink-800/70 ring-ink-700'}`}>
              <div className="text-[10.5px] text-ink-400">k = {k} · ‖·‖ = {fmt(termNorms[k], 3)}</div>
              <div className="text-[11.5px]">
                <Tex>{`\\tfrac{A^{${k}}}{${k}!} = ${texMatrix(terms[k], { digits: 2, exact: false, factor: false })}`}</Tex>
              </div>
            </div>
          ))}
        </div>
        {N > 6 && (
          <div className="mt-1.5 rounded-md bg-state/[0.08] px-1.5 py-1 ring-1 ring-inset ring-state/40">
            <div className="text-[10.5px] text-ink-400">… latest term k = {N - 1} · ‖·‖ = {termNorms[N - 1].toExponential(1)}</div>
            <div className="text-[11.5px]">
              <Tex>{`\\tfrac{A^{${N - 1}}}{${N - 1}!} = ${texMatrix(terms[N - 1], { digits: 2, exact: false, factor: false })}`}</Tex>
            </div>
          </div>
        )}
      </Card>
      <Card title="Partial sum vs. exact" kicker={`N = ${N} terms`}>
        <Tex display>{`\\hl{SN}{S_{${N}}} = \\sum_{k=0}^{${N - 1}} \\frac{A^k}{k!} = ${texMatrix(SN, { digits: 3, exact: false, factor: false })}`}</Tex>
        <Tex display>{`e^A = ${texMatrix(E, { digits: 3, exact: true })}`}</Tex>
        <KV k={<Tex>{`\\|S_{${N}} - e^A\\|_F`}</Tex>} v={<Tex>{texSci(errors[N - 1])}</Tex>} />
        <KV k={<Tex>{'e^A \\text{ unitary?}'}</Tex>} v={unitaryExact ? 'yes' : 'no'} />
        <KV k={<Tex>{`\\|S_{${N}}\\ket\\psi\\|`}</Tex>} v={outNorm.toFixed(5)} />
      </Card>
      {preset === 'rot' && (
        <Callout tone="insight" title="Why a truncated rotation is not a rotation">
          Every partial sum <Tex>{'S_N'}</Tex> is a polynomial in <Tex>{'\\vec n\\cdot\\vec\\sigma'}</Tex>, so it maps the sphere's axis to itself, but it is not unitary: <Tex>{'\\|S_N\\ket\\psi\\| \\ne 1'}</Tex>.
          The arrow shows only the <em>direction</em> of <Tex>{'S_N\\ket\\psi'}</Tex>; its length converges to 1 as the series converges. See the derivation tab for the exact sum.
        </Callout>
      )}
      {preset === 'diagI' && (
        <Callout tone="insight" title="Diagonal matrices exponentiate entrywise">
          Every power of a diagonal matrix is diagonal, <Tex>{'A^k = \\mathrm{diag}(\\lambda_1^k, \\lambda_2^k)'}</Tex>, so the series splits into two scalar series:{' '}
          <Tex>{'e^{A} = \\mathrm{diag}(e^{i\\varphi_1}, e^{i\\varphi_2})'}</Tex> — two phases on the unit circle. Only their difference <Tex>{'\\varphi_2-\\varphi_1'}</Tex> rotates the Bloch vector (about z).
        </Callout>
      )}
      {preset === 'diagR' && (
        <Callout tone="warn" title="Real exponents are not unitary">
          <Tex>{'e^{\\mathrm{diag}(a,b)} = \\mathrm{diag}(e^a, e^b)'}</Tex> stretches the amplitudes instead of rotating their phases: the norm changes and the normalized state slides towards the pole with the larger
          exponent. Unitary evolution needs an anti-Hermitian exponent <Tex>{'A = -iHt'}</Tex>.
        </Callout>
      )}
      {preset === 'ham' && (
        <Callout tone="insight" title="Hermitian H ⇒ unitary e^{−iHt}">
          The exact sum is unitary for every <Tex>{'t'}</Tex>, even though no truncation is. Compare with the Schrödinger module: this is exactly <Tex>{'U_t'}</Tex> there.
        </Callout>
      )}
      {preset === 'nil' && (
        <Callout tone="good" title="The series terminates">
          <Tex>{'A^2 = 0'}</Tex>, so <Tex>{'e^A = I + A'}</Tex> exactly: the error drops to zero at <Tex>{'N = 2'}</Tex>. Nilpotent matrices have only the eigenvalue 0 but are not diagonalizable — the
          series works where an eigenvalue decomposition does not.
        </Callout>
      )}
    </>
  );

  return <>{header(viz, controls, panel)}</>;
}

