import { ReactNode, useMemo, useState } from 'react';
import { BlochCanvas, StateArrow, AxisLine, OrbitCircle, Trail, PointMarker } from '../../components/bloch';
import { LinePlot } from '../../components/charts';
import { Tex } from '../../components/Tex';
import { Card, Slider, Button, KV, Callout, Label, Swatch, Icon } from '../../components/ui';
import { useRaf } from '../../hooks/animation';
import { COLORS } from '../../theme';
import {
  Mat2,
  Vec2,
  Vec3,
  c,
  I2,
  abs,
  expi,
  approxEq,
  matAdd,
  matMul,
  matScale,
  matSub,
  matPow,
  dagger,
  det,
  trace,
  hamiltonianMatrix,
  hamiltonianAxis,
  expm,
  frobenius,
  apply,
  norm,
  blochVector,
  stateFromAngles,
  PRESETS,
  texMatrix,
  texComplex,
  fmt,
  HamiltonianParams,
} from '../../quantum';
import { Check, texSci } from './common';
import { eulerProduct, lossyHamiltonian } from './math';

const NMAX = 64;

export function GroupTab({ header }: { header: (viz: ReactNode, controls: ReactNode, panel: ReactNode) => ReactNode }) {
  const [p, setP] = useState<HamiltonianParams>({ omegaBar: 0.2, deltaOmega: 0.5, epsilon: 0.7 });
  const [s, setS] = useState(1.1);
  const [tt, setTT] = useState(0.9);
  const [N, setN] = useState(6);
  const [kappa, setKappa] = useState(0);
  const [init, setInit] = useState({ theta: 0, phi: 0 });
  const [sweep, setSweep] = useState(false);

  useRaf((dt) => setS((x) => (x + dt * 0.6) % (2 * Math.PI)), sweep);

  // H_κ = H − iκ|1⟩⟨1| is Hermitian only for κ = 0
  const Hk: Mat2 = useMemo(() => lossyHamiltonian(hamiltonianMatrix(p), kappa), [p, kappa]);
  const hermitian = kappa === 0;
  const U = (x: number) => expm(matScale(Hk, c(0, -x)));
  const psi0: Vec2 = useMemo(() => stateFromAngles(init.theta, init.phi), [init]);
  const Us = U(s);
  const Ut = U(tt);
  const Ust = U(s + tt);
  const psiS = apply(Us, psi0);
  const psiTS = apply(Ut, psiS);
  const psiST = apply(Ust, psi0);
  const groupErr = frobenius(matSub(matMul(Ut, Us), Ust));
  const unitErr = frobenius(matSub(matMul(dagger(Ust), Ust), I2));
  const dU = det(Ust);
  const dPred = expi(-trace(hamiltonianMatrix(p)).re * (s + tt));
  const invErr = frobenius(matSub(U(-tt), dagger(Ut)));
  const { v } = hamiltonianAxis(p);

  const arc1 = useMemo(() => {
    const pts: Vec3[] = [];
    for (let k = 0; k <= 60; k++) pts.push(blochVector(apply(expm(matScale(Hk, c(0, (-s * k) / 60))), psi0)));
    return pts;
  }, [Hk, s, psi0]);
  const arc2 = useMemo(() => {
    const pts: Vec3[] = [];
    for (let k = 0; k <= 60; k++) pts.push(blochVector(apply(expm(matScale(Hk, c(0, (-tt * k) / 60))), psiS)));
    return pts;
  }, [Hk, tt, psiS]);

  // Euler product (I − iH T/N)^N
  const T = s + tt;
  const euler = useMemo(() => {
    const step = matAdd(I2, matScale(Hk, c(0, -T / N)));
    const pts: Vec3[] = [];
    let v2: Vec2 = psi0;
    pts.push(blochVector(v2));
    for (let k = 0; k < N; k++) {
      v2 = apply(step, v2);
      pts.push(blochVector(v2));
    }
    return { pts, final: v2, M: matPow(step, N) };
  }, [Hk, T, N, psi0]);
  const eulerErrs = useMemo(() => {
    const UT = expm(matScale(Hk, c(0, -T)));
    const out: [number, number][] = [];
    for (let k = 1; k <= NMAX; k++) {
      out.push([k, Math.max(1e-17, frobenius(matSub(eulerProduct(Hk, T, k), UT)))]);
    }
    return out;
  }, [Hk, T]);
  const normCurve = useMemo(() => {
    const out: [number, number][] = [];
    for (let k = 0; k <= 160; k++) {
      const x = (4 * Math.PI * k) / 160;
      out.push([x, norm(apply(expm(matScale(Hk, c(0, -x))), psi0))]);
    }
    return out;
  }, [Hk, psi0]);

  const viz = (
    <BlochCanvas
      overlay={
        <>
          <div className="absolute left-3 top-3 rounded-lg bg-ink-900/75 px-3 py-2 text-[13px] ring-1 ring-ink-700 backdrop-blur">
            <Tex>{'U(t)\\,U(s)\\ket{\\psi_0} \\;\\overset{?}{=}\\; U(s+t)\\ket{\\psi_0}'}</Tex>
            <div className="mt-1 text-[12px] text-ink-300">
              <Tex>{`\\|(I - iHT/N)^N\\ket{\\psi_0}\\| = ${norm(euler.final).toFixed(4)}`}</Tex>
            </div>
          </div>
          <div className="absolute bottom-2 left-3 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px]">
            <Swatch color={COLORS.state}>U(s)</Swatch>
            <Swatch color={COLORS.phase}>then U(t)</Swatch>
            <Swatch color={COLORS.muted}>U(s+t) in one go</Swatch>
            <Swatch color={COLORS.p1}>N Euler steps I − iH·T/N</Swatch>
          </div>
          {!hermitian && (
            <div className="absolute right-3 top-3 rounded-lg bg-p1/10 px-3 py-1.5 text-[12px] text-p1 ring-1 ring-p1/30">
              κ &gt; 0: H not Hermitian · ‖ψ(s+t)‖ = {norm(psiST).toFixed(3)}
            </div>
          )}
        </>
      }
    >
      {v && hermitian && <AxisLine n={v} dashed opacity={0.75} label="\vec v" />}
      {v && hermitian && <OrbitCircle n={v} through={blochVector(psi0)} opacity={0.3} />}
      <PointMarker v={blochVector(psi0)} color={COLORS.faint} size={0.03} label="\psi_0" />
      <Trail points={arc1} fade={false} lineWidth={2.4} />
      <Trail points={arc2} color={COLORS.phase} fade={false} lineWidth={2.4} />
      <Trail points={euler.pts} color={COLORS.p1} fade={false} lineWidth={1.3} dashed />
      {euler.pts.map((q, i) => (
        <PointMarker key={i} v={q} color={COLORS.p1} size={0.022} opacity={0.8} />
      ))}
      <StateArrow v={blochVector(psiST)} color={COLORS.muted} opacity={0.5} />
      <StateArrow v={blochVector(psiTS)} />
    </BlochCanvas>
  );

  const controls = (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="Composition of evolutions" kicker="two evolution times">
        <div className="space-y-2.5">
          <Slider tex="s" label="first evolution time" value={s} min={0} max={2 * Math.PI} step={0.001} onChange={(x) => { setSweep(false); setS(x); }} format={(x) => x.toFixed(2)} color={COLORS.state} />
          <Slider tex="t" label="second evolution time" value={tt} min={0} max={2 * Math.PI} step={0.001} onChange={setTT} format={(x) => x.toFixed(2)} color={COLORS.phase} />
          <Button size="sm" active={sweep} onClick={() => setSweep(!sweep)}>
            {sweep ? Icon.pause : Icon.play} sweep s
          </Button>
          <div className="grid grid-cols-3 gap-2 border-t border-ink-800 pt-2.5">
            <Slider tex="\bar\omega" value={p.omegaBar} min={-2} max={2} step={0.01} onChange={(x) => setP({ ...p, omegaBar: x })} format={(x) => x.toFixed(1)} color={COLORS.phase} />
            <Slider tex="\Delta\omega" value={p.deltaOmega} min={-2} max={2} step={0.01} onChange={(x) => setP({ ...p, deltaOmega: x })} format={(x) => x.toFixed(1)} color={COLORS.axis} />
            <Slider tex="\epsilon" value={p.epsilon} min={-2} max={2} step={0.01} onChange={(x) => setP({ ...p, epsilon: x })} format={(x) => x.toFixed(1)} color={COLORS.axis} />
          </div>
          <div>
            <Label className="mb-1">initial state</Label>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((q) => (
                <Button key={q.id} size="sm" active={Math.abs(init.theta - q.theta) < 1e-6 && (Math.abs(init.phi - q.phi) < 1e-6 || Math.sin(q.theta) < 1e-9)} onClick={() => setInit({ theta: q.theta, phi: q.phi })}>
                  <Tex>{q.tex}</Tex>
                </Button>
              ))}
            </div>
          </div>
        </div>
      </Card>
      <Card title="Many small steps" kicker="Euler steps → exponential">
        <Slider tex="N" label="Euler steps" value={N} min={1} max={NMAX} step={1} onChange={(x) => setN(Math.round(x))} format={(x) => String(Math.round(x))} color={COLORS.p1} />
        <div className="mt-2">
          <LinePlot
            series={[{ points: eulerErrs, color: COLORS.p1, label: '\\|(I - iHT/N)^N - e^{-iHT}\\|' }]}
            xMin={1}
            xMax={NMAX}
            yMin={-3.5}
            yMax={1}
            logY
            yTicks={[{ value: 1e-3, label: '1e-3' }, { value: 1e-2, label: '1e-2' }, { value: 0.1, label: '0.1' }, { value: 1, label: '1' }]}
            height={150}
            cursorX={N}
            onScrub={(x) => setN(Math.max(1, Math.min(NMAX, Math.round(x))))}
            xLabel="N"
          />
        </div>
        <p className="mt-1 text-[11.5px] leading-relaxed text-ink-400">
          Each step <Tex>{'I - iH\\,\\delta t'}</Tex> is a tiny rotation that slightly increases the norm; composing <Tex>{'N'}</Tex> of them approaches the exact rotation with error <Tex>{'\\propto 1/N'}</Tex>. The exponential is the
          continuous limit of compounding infinitesimal rotations.
        </p>
        <div className="mt-3 border-t border-ink-800 pt-2.5">
          <Slider tex="\kappa" label="non-Hermitian part  H − iκ|1⟩⟨1|" value={kappa} min={0} max={0.6} step={0.01} onChange={setKappa} format={(x) => x.toFixed(2)} color={COLORS.bad} />
          <LinePlot
            series={[{ points: normCurve, color: hermitian ? COLORS.good : COLORS.bad, label: '\\|e^{-iH_\\kappa t}\\ket{\\psi_0}\\|' }]}
            xMin={0}
            xMax={4 * Math.PI}
            yMin={0}
            yMax={1.1}
            height={110}
            yTicks={[{ value: 0, label: '0' }, { value: 0.5, label: '0.5' }, { value: 1, label: '1' }]}
            xLabel="t"
          />
        </div>
      </Card>
    </div>
  );

  const panel = (
    <>
      <Card title="Hermitian generator ⇒ unitary evolution" kicker={hermitian ? 'Hermitian' : 'non-Hermitian'}>
        <Tex display>{'\\big(e^{-iHt}\\big)^\\dagger = e^{(-iHt)^\\dagger} = e^{iH^\\dagger t} = e^{iHt} = \\big(e^{-iHt}\\big)^{-1}'}</Tex>
        <Tex display>{`U(s+t) = ${texMatrix(Ust, { digits: 3, exact: false })}`}</Tex>
        <div className="space-y-1">
          <Check ok={unitErr < 1e-9}>
            <Tex>{'\\|U^\\dagger U - I\\|'}</Tex> = <Tex>{texSci(unitErr)}</Tex>
          </Check>
          <Check ok={Math.abs(abs(dU) - 1) < 1e-9}>
            <Tex>{`|\\det U| = ${fmt(abs(dU), 4)}`}</Tex>
          </Check>
          {hermitian && (
            <Check ok={approxEq(dU, dPred, 1e-9)}>
              <Tex>{`\\det U = e^{-i\\,\\mathrm{tr}(H)(s+t)} = ${texComplex(dPred, { digits: 3, exact: false })}`}</Tex>
            </Check>
          )}
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-ink-400">
          <Tex>{'\\det e^{A} = e^{\\mathrm{tr}A}'}</Tex>, and <Tex>{'\\mathrm{tr}(-iHt)'}</Tex> is purely imaginary when <Tex>{'H'}</Tex> is Hermitian — so <Tex>{'|\\det U| = 1'}</Tex>. Only{' '}
          <Tex>{'\\mathrm{tr}H = 2\\bar\\omega'}</Tex> enters: the global phase again.
        </p>
      </Card>
      <Card title="A one-parameter group" kicker="continuous rotations">
        <Tex display>{'U(s)\\,U(t) = U(s+t),\\qquad U(0) = I'}</Tex>
        <Tex display>{'U(-t) = U(t)^{-1} = U(t)^\\dagger'}</Tex>
        <div className="space-y-1">
          <Check ok={groupErr < 1e-9}>
            <Tex>{'\\|U(t)U(s) - U(s+t)\\|'}</Tex> = <Tex>{texSci(groupErr)}</Tex>
          </Check>
          <Check ok={hermitian ? invErr < 1e-9 : invErr > 1e-9}>
            <Tex>{'\\|U(-t) - U(t)^\\dagger\\|'}</Tex> = <Tex>{texSci(invErr)}</Tex> {!hermitian && '(fails: not unitary)'}
          </Check>
        </div>
        <KV k="both arcs end at the faint arrow" v={groupErr < 1e-9 ? 'yes' : 'no'} />
        <p className="mt-1.5 text-[12px] leading-relaxed text-ink-400">
          The group law holds for every exponent (even non-Hermitian): <Tex>{'sA'}</Tex> and <Tex>{'tA'}</Tex> commute, so <Tex>{'e^{sA}e^{tA} = e^{(s+t)A}'}</Tex>. For non-commuting exponents{' '}
          <Tex>{'e^{A}e^{B} \\ne e^{A+B}'}</Tex> in general — see the Pauli algebra module.
        </p>
      </Card>
      <Callout tone="insight" title="Why exponentials generate continuous rotations">
        The Schrödinger equation says <Tex>{'\\tfrac{d}{dt}U = -iH\\,U'}</Tex>: over a short time, <Tex>{'U(\\delta t) \\approx I - iH\\delta t'}</Tex>. Because <Tex>{'-iH'}</Tex> is anti-Hermitian, this is an
        infinitesimal rotation of the Bloch sphere, and the exponential stacks infinitely many identical ones — always about the same axis <Tex>{'\\vec v'}</Tex>.
      </Callout>
      {!hermitian && (
        <Callout tone="warn" title="Breaking Hermiticity">
          With <Tex>{'\\kappa > 0'}</Tex> the |1⟩ amplitude leaks away: the norm decays (red curve) and probabilities no longer sum to 1. Closed quantum systems never do this — loss requires coupling to an
          environment.
        </Callout>
      )}
    </>
  );

  return <>{header(viz, controls, panel)}</>;
}

