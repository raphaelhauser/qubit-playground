import { ReactNode, useMemo, useRef, useState } from 'react';
import { BlochCanvas, StateArrow, AxisLine, OrbitCircle, RotationArc, PointMarker, Arrow } from '../../components/bloch';
import { LinePlot } from '../../components/charts';
import { Tex } from '../../components/Tex';
import { Card, Slider, Button, Callout, Icon, Swatch, KV } from '../../components/ui';
import { useHighlight } from '../../components/Highlight';
import { useRaf } from '../../hooks/animation';
import { COLORS } from '../../theme';
import {
  c,
  I2,
  KET0,
  matMul,
  matPow,
  matAdd,
  matScale,
  matSub,
  matApproxEq,
  nDotSigma,
  expm,
  expmSeries,
  frobenius,
  apply,
  norm,
  blochVector,
  axisFromAngles,
  Rn,
  texMatrix,
  texAngle,
  texReal,
  fmt,
} from '../../quantum';
import { AxisControl, Check, texSci } from './common';
import { cosSin } from './math';

const STEP_MS = 3600;

export function DerivationTab({ header }: { header: (viz: ReactNode, controls: ReactNode, panel: ReactNode) => ReactNode }) {
  const [theta, setTheta] = useState((2 * Math.PI) / 3);
  const [nT, setNT] = useState(Math.PI / 4);
  const [nP, setNP] = useState(0);
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(false);
  const [spin, setSpin] = useState(false);
  const [M, setM] = useState(2);
  const acc = useRef(0);
  const { active } = useHighlight();

  useRaf((dt) => {
    if (auto) {
      acc.current += dt * 1000;
      if (acc.current > STEP_MS) {
        acc.current = 0;
        if (step >= 5) setAuto(false);
        else setStep(step + 1);
      }
    }
    if (spin) setTheta((t) => (t + dt * 0.8) % (4 * Math.PI));
  }, auto || spin);

  const n = axisFromAngles(nT, nP);
  const NS = useMemo(() => nDotSigma(n), [n[0], n[1], n[2]]); // eslint-disable-line react-hooks/exhaustive-deps
  const NS2 = matMul(NS, NS);
  const A = matScale(NS, c(0, -theta / 2));
  const viaExp = expm(A);
  const formula = matAdd(matScale(I2, c(Math.cos(theta / 2))), matScale(NS, c(0, -Math.sin(theta / 2))));
  const series25 = expmSeries(A, 25).partialSums[24];
  const x = theta / 2;
  const trunc = cosSin(x, M);
  const UM = matAdd(matScale(I2, c(trunc.cs)), matScale(NS, c(0, -trunc.sn)));
  const psiExact = apply(Rn(n, theta), KET0);
  const psiTrunc = apply(UM, KET0);
  const b0 = blochVector(KET0);

  // even / odd partial sums vs m
  const partial = useMemo(() => {
    const ev: [number, number][] = [];
    const od: [number, number][] = [];
    for (let m = 0; m <= 10; m++) {
      const r = cosSin(x, m);
      ev.push([m, r.cs]);
      od.push([m, r.sn]);
    }
    return { ev, od };
  }, [x]);
  const yLo = Math.max(-3, Math.min(-1.1, ...partial.ev.map((p) => p[1]), ...partial.od.map((p) => p[1])));
  const yHi = Math.min(3, Math.max(1.1, ...partial.ev.map((p) => p[1]), ...partial.od.map((p) => p[1])));

  // Taylor polynomials vs θ
  const curves = useMemo(() => {
    const ex: [number, number][] = [];
    const es: [number, number][] = [];
    const tc: [number, number][] = [];
    const ts: [number, number][] = [];
    for (let k = 0; k <= 200; k++) {
      const th = (4 * Math.PI * k) / 200;
      ex.push([th, Math.cos(th / 2)]);
      es.push([th, Math.sin(th / 2)]);
      const r = cosSin(th / 2, M);
      tc.push([th, Math.max(-1.8, Math.min(1.8, r.cs))]);
      ts.push([th, Math.max(-1.8, Math.min(1.8, r.sn))]);
    }
    return { ex, es, tc, ts };
  }, [M]);

  const steps: { title: string; tex: string[]; check: ReactNode }[] = [
    {
      title: 'Start from the power series',
      tex: ['e^{-i\\theta(\\vec n\\cdot\\vec\\sigma)/2} = \\sum_{k=0}^{\\infty} \\frac{1}{k!}\\Big(\\!-\\frac{i\\theta}{2}\\Big)^{k}\\,(\\hl{n}{\\vec n}\\cdot\\vec\\sigma)^{k}'],
      check: <Check ok={frobenius(matSub(series25, viaExp)) < 1e-9}>25 terms vs. exact exponential: error <Tex>{texSci(frobenius(matSub(series25, viaExp)))}</Tex></Check>,
    },
    {
      title: 'The key identity (n·σ)² = I',
      tex: [
        '(\\vec n\\cdot\\vec\\sigma)^2 = \\sum_j n_j^2\\,\\sigma_j^2 + \\sum_{j<k} n_j n_k \\underbrace{\\{\\sigma_j,\\sigma_k\\}}_{=\\,0} = |\\vec n|^2\\, I = I',
        `(\\vec n\\cdot\\vec\\sigma)^2 = ${texMatrix(NS2, { digits: 3 })}`,
      ],
      check: <Check ok={matApproxEq(NS2, I2, 1e-12)}>numerically, for the current unit vector n</Check>,
    },
    {
      title: 'So the powers alternate',
      tex: ['(\\vec n\\cdot\\vec\\sigma)^k = \\begin{cases} I & k \\text{ even} \\\\ \\vec n\\cdot\\vec\\sigma & k \\text{ odd}\\end{cases}'],
      check: (
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: 8 }, (_, k) => {
            const P = matPow(NS, k);
            const isI = matApproxEq(P, I2, 1e-10);
            const isN = matApproxEq(P, NS, 1e-10);
            return (
              <span key={k} className={`rounded px-1.5 py-0.5 text-[11.5px] ring-1 ring-inset ${isI ? 'bg-ink-750 text-ink-200 ring-ink-600' : 'bg-axis/10 text-axis ring-axis/30'}`}>
                <Tex>{`(\\vec n\\cdot\\vec\\sigma)^{${k}} = ${isI ? 'I' : isN ? '\\vec n\\cdot\\vec\\sigma' : '?'}`}</Tex>
              </span>
            );
          })}
        </div>
      ),
    },
    {
      title: 'Split the series into even and odd k',
      tex: [
        'e^{-i\\theta(\\vec n\\cdot\\vec\\sigma)/2} = \\Big[\\sum_{m} \\frac{(-i\\theta/2)^{2m}}{(2m)!}\\Big] I + \\Big[\\sum_{m} \\frac{(-i\\theta/2)^{2m+1}}{(2m+1)!}\\Big] (\\vec n\\cdot\\vec\\sigma)',
      ],
      check: <Check ok>regrouping is allowed: the series converges absolutely</Check>,
    },
    {
      title: 'Powers of −i give alternating signs',
      tex: [
        '(-i)^{2m} = (-1)^m,\\qquad (-i)^{2m+1} = -i\\,(-1)^m',
        '= \\underbrace{\\Big[\\sum_m \\frac{(-1)^m (\\theta/2)^{2m}}{(2m)!}\\Big]}_{\\cos(\\theta/2)} I \\; - \\; i\\underbrace{\\Big[\\sum_m \\frac{(-1)^m(\\theta/2)^{2m+1}}{(2m+1)!}\\Big]}_{\\sin(\\theta/2)}(\\vec n\\cdot\\vec\\sigma)',
      ],
      check: (
        <Check ok={Math.abs(cosSin(x, 12).cs - Math.cos(x)) < 1e-9}>
          the bracketed series are the Taylor series of <Tex>{'\\cos'}</Tex> and <Tex>{'\\sin'}</Tex> (plots below)
        </Check>
      ),
    },
    {
      title: 'Result: the rotation operator',
      tex: [
        `e^{-i\\theta(\\vec n\\cdot\\vec\\sigma)/2} = \\cos\\tfrac{\\theta}{2}\\, I - i\\sin\\tfrac{\\theta}{2}\\,(\\vec n\\cdot\\vec\\sigma) = R_{\\vec n}(\\theta)`,
        `= ${texMatrix(formula, { digits: 3 })}`,
      ],
      check: <Check ok={frobenius(matSub(formula, viaExp)) < 1e-10}>closed form vs. exact exponential: error <Tex>{texSci(frobenius(matSub(formula, viaExp)))}</Tex></Check>,
    },
  ];

  const viz = (
    <BlochCanvas
      overlay={
        <>
          <div className="absolute left-3 top-3 rounded-lg bg-ink-900/75 px-3 py-2 text-[13px] ring-1 ring-ink-700 backdrop-blur">
            <Tex>{`R_{\\vec n}(\\theta)\\ket0,\\quad \\theta = ${texAngle(theta, { inline: true })}`}</Tex>
            {step >= 4 && (
              <div className="mt-1 text-[12px] text-ink-300">
                truncated (m ≤ {M}): <Tex>{`\\|U_M\\ket0\\| = ${norm(psiTrunc).toFixed(4)}`}</Tex>
              </div>
            )}
          </div>
          <div className="absolute bottom-2 left-3 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px]">
            <Swatch color={COLORS.axis}>axis n</Swatch>
            <Swatch color={COLORS.state}>exact R_n(θ)|0⟩</Swatch>
            {step >= 4 && <Swatch color={COLORS.phase}>truncated series</Swatch>}
          </div>
        </>
      }
    >
      <AxisLine n={n} label="\vec n" lineWidth={active === 'n' ? 3 : 2} />
      <OrbitCircle n={n} through={b0} />
      <RotationArc n={n} from={b0} angle={theta % (2 * Math.PI)} label="\theta" />
      <PointMarker v={b0} color={COLORS.faint} size={0.03} />
      {step >= 4 && norm(psiTrunc) > 1e-9 && <Arrow v={blochVector(psiTrunc)} color={COLORS.phase} opacity={0.8} radius={0.015} headRadius={0.042} />}
      <StateArrow v={blochVector(psiExact)} />
    </BlochCanvas>
  );

  const controls = (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Rotation" kicker="angle and axis">
          <Slider tex="\theta" label="angle" value={theta} min={0} max={4 * Math.PI} onChange={(v) => { setSpin(false); setTheta(v); }} format={(v) => texAngle(v, { inline: true })} color={COLORS.state} marks={[{ value: Math.PI, tex: '\\pi' }, { value: 2 * Math.PI, tex: '2\\pi' }, { value: 4 * Math.PI, tex: '4\\pi' }]} />
          <div className="mt-2">
            <AxisControl nTheta={nT} nPhi={nP} onChange={(t, p) => { setNT(t); setNP(p); }} />
          </div>
          <div className="mt-2 flex gap-1.5">
            <Button size="sm" active={spin} onClick={() => setSpin(!spin)}>
              {spin ? Icon.pause : Icon.play} sweep θ (continuous rotation)
            </Button>
          </div>
          {Math.abs((theta % (4 * Math.PI)) - 2 * Math.PI) < 0.02 && (
            <p className="mt-2 text-[12px] text-p1">
              θ = 2π: <Tex>{'R_{\\vec n}(2\\pi) = -I'}</Tex> — back to the same point, but with a global phase −1. Only 4π gives the identity.
            </p>
          )}
        </Card>
        <Card title="Derivation" kicker={`step ${step + 1} of ${steps.length}`}>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button size="sm" onClick={() => { setAuto(false); setStep(Math.max(0, step - 1)); }} disabled={step === 0}>
              {Icon.arrowL} back
            </Button>
            <Button size="sm" variant="primary" onClick={() => { if (step >= 5) setStep(0); acc.current = 0; setAuto(!auto); }}>
              {auto ? Icon.pause : Icon.play} {auto ? 'pause' : 'animate'}
            </Button>
            <Button size="sm" onClick={() => { setAuto(false); setStep(Math.min(5, step + 1)); }} disabled={step === 5}>
              next {Icon.arrowR}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setAuto(false); setStep(0); }}>
              {Icon.reset}
            </Button>
          </div>
          <div className="mt-3 flex gap-1">
            {steps.map((s, i) => (
              <button key={i} onClick={() => { setAuto(false); setStep(i); }} title={s.title} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-state' : 'bg-ink-600'}`} />
            ))}
          </div>
          <div className="mt-2 text-[13px] font-medium text-ink-100">{steps[step].title}</div>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-400">
            The derivation appears in the panel on the right; each step is checked numerically for your current <Tex>{'\\vec n'}</Tex> and <Tex>{'\\theta'}</Tex>.
          </p>
        </Card>
      </div>
      <Card title="Pauli matrices ↔ trigonometry" kicker="the even and odd series">
        <Slider tex="M" label="keep terms m = 0 … M" value={M} min={0} max={10} step={1} onChange={(v) => setM(Math.round(v))} format={(v) => String(Math.round(v))} color={COLORS.phase} />
        <div className="mt-2 grid gap-4 lg:grid-cols-2">
          <div>
            <div className="mb-1 text-[12px] text-ink-300">
              partial sums at the current <Tex>{`\\theta/2 = ${texReal(x, { digits: 2, exact: false })}`}</Tex>
            </div>
            <LinePlot
              series={[
                { points: partial.ev, color: COLORS.p0, label: '\\sum_{m\\le M} \\tfrac{(-1)^m (\\theta/2)^{2m}}{(2m)!}' },
                { points: partial.od, color: COLORS.p1, label: '\\sum_{m\\le M} \\tfrac{(-1)^m (\\theta/2)^{2m+1}}{(2m+1)!}' },
              ]}
              xMin={0}
              xMax={10}
              yMin={yLo}
              yMax={yHi}
              height={170}
              cursorX={M}
              onScrub={(v) => setM(Math.round(v))}
              hlines={[
                { y: Math.cos(x), color: COLORS.p0, label: `cos(θ/2) = ${fmt(Math.cos(x), 3)}` },
                { y: Math.sin(x), color: COLORS.p1, label: `sin(θ/2) = ${fmt(Math.sin(x), 3)}` },
              ]}
              yTicks={[{ value: -1, label: '−1' }, { value: 0, label: '0' }, { value: 1, label: '1' }]}
              xLabel="number of kept terms M"
            />
          </div>
          <div>
            <div className="mb-1 text-[12px] text-ink-300">truncated series vs. θ (dashed), exact cos and sin (solid)</div>
            <LinePlot
              series={[
                { points: curves.ex, color: COLORS.p0, label: '\\cos(\\theta/2)' },
                { points: curves.es, color: COLORS.p1, label: '\\sin(\\theta/2)' },
                { points: curves.tc, color: COLORS.p0, dashed: true, width: 1.3 },
                { points: curves.ts, color: COLORS.p1, dashed: true, width: 1.3 },
              ]}
              xMin={0}
              xMax={4 * Math.PI}
              yMin={-1.8}
              yMax={1.8}
              height={170}
              cursorX={theta}
              onScrub={(v) => { setSpin(false); setTheta(v); }}
              yTicks={[{ value: -1, label: '−1' }, { value: 0, label: '0' }, { value: 1, label: '1' }]}
              xTicks={[1, 2, 3, 4].map((k) => ({ value: k * Math.PI, label: k === 1 ? 'π' : `${k}π` }))}
              xLabel="θ"
            />
          </div>
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-400">
          Because <Tex>{'(\\vec n\\cdot\\vec\\sigma)^2 = I'}</Tex> behaves like <Tex>{'i^2 = -1'}</Tex> after the factor <Tex>{'-i'}</Tex>, the matrix series collapses onto the scalar series of{' '}
          <Tex>{'e^{-ix} = \\cos x - i\\sin x'}</Tex>. Truncating at small <Tex>{'M'}</Tex> works for small angles but fails badly for large θ.
        </p>
      </Card>
    </>
  );

  const panel = (
    <>
      <Card title="Derivation" kicker="closed form of the rotation operator">
        <div className="space-y-2.5">
          {steps.slice(0, step + 1).map((s, i) => (
            <div key={i} className={`animate-fadein rounded-lg px-3 py-2 ring-1 ring-inset transition-colors ${i === step ? 'bg-state/[0.06] ring-state/35' : 'bg-ink-800/50 ring-ink-700 opacity-75'}`}>
              <div className="mb-0.5 flex items-center gap-2 text-[12px] font-semibold text-ink-100">
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10.5px] ${i === step ? 'bg-state text-ink-950' : 'bg-ink-600 text-ink-200'}`}>{i + 1}</span>
                {s.title}
              </div>
              {s.tex.map((t, j) => (
                <Tex key={j} display>
                  {t}
                </Tex>
              ))}
              <div className="mt-1">{s.check}</div>
            </div>
          ))}
          {step < 5 && (
            <button onClick={() => { setAuto(false); setStep(step + 1); }} className="w-full rounded-lg border border-dashed border-ink-600 py-2 text-[12.5px] text-ink-400 hover:border-ink-400 hover:text-ink-200">
              reveal step {step + 2}: {steps[step + 1].title}
            </button>
          )}
        </div>
      </Card>
      <Card title="Live numbers" kicker="for the current axis">
        <KV hl="n" k={<Tex>{'\\vec n'}</Tex>} v={`(${fmt(n[0], 3)}, ${fmt(n[1], 3)}, ${fmt(n[2], 3)})`} />
        <KV k={<Tex>{'\\cos(\\theta/2),\\ \\sin(\\theta/2)'}</Tex>} v={`${fmt(Math.cos(x), 3)}, ${fmt(Math.sin(x), 3)}`} />
        <Tex display>{`\\vec n\\cdot\\vec\\sigma = ${texMatrix(NS, { digits: 3 })}`}</Tex>
      </Card>
      <Callout tone="insight" title="Why exponentials generate rotations">
        <Tex>{'\\theta \\mapsto R_{\\vec n}(\\theta)'}</Tex> satisfies <Tex>{'R_{\\vec n}(\\alpha)R_{\\vec n}(\\beta) = R_{\\vec n}(\\alpha+\\beta)'}</Tex> and <Tex>{'\\frac{d}{d\\theta}R_{\\vec n} = -\\tfrac{i}{2}(\\vec n\\cdot\\vec\\sigma)R_{\\vec n}'}</Tex>.
        Exponentiating the fixed generator <Tex>{'-\\tfrac{i}{2}\\vec n\\cdot\\vec\\sigma'}</Tex> strings together infinitely many infinitesimal rotations about the same axis.
      </Callout>
    </>
  );

  return <>{header(viz, controls, panel)}</>;
}
