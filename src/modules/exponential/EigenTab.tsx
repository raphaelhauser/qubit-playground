import { ReactNode, useEffect, useMemo, useState } from 'react';
import { BlochCanvas, StateArrow, AxisLine, OrbitCircle, Trail, PointMarker } from '../../components/bloch';
import { ComplexPlane } from '../../components/ComplexPlane';
import { Tex } from '../../components/Tex';
import { Card, Slider, Button, KV, Callout, Label, Segmented, Swatch } from '../../components/ui';
import { PlaybackBar } from '../../components/Playback';
import { useRaf } from '../../hooks/animation';
import { COLORS } from '../../theme';
import {
  Mat2,
  Vec3,
  c,
  mul,
  expi,
  matScale,
  matSub,
  matProd,
  matPow,
  dagger,
  det,
  abs,
  hamiltonianMatrix,
  eigHermitian,
  expm,
  frobenius,
  apply,
  inner,
  blochVector,
  stateFromAngles,
  PRESETS,
  texMatrix,
  fmt,
  HamiltonianParams,
} from '../../quantum';
import { MatBox, Check, randomUnitary, randomComplexMatrix, texSci } from './common';
import { spectralEvolution } from './math';

const TMAX = 4 * Math.PI;

export function EigenTab({ header }: { header: (viz: ReactNode, controls: ReactNode, panel: ReactNode) => ReactNode }) {
  const [p, setP] = useState<HamiltonianParams>({ omegaBar: 0.4, deltaOmega: 0.6, epsilon: 0.45 });
  const [t, setT] = useState(1.2);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [init, setInit] = useState({ theta: Math.PI / 2, phi: 0 });
  const [U, setU] = useState<Mat2>(() => randomUnitary());
  const [aKind, setAKind] = useState<'ham' | 'random'>('ham');
  const [Ar, setAr] = useState<Mat2>(() => randomComplexMatrix());

  useRaf((dt) => setT((x) => Math.min(TMAX, x + dt * speed)), playing);
  useEffect(() => {
    if (playing && t >= TMAX) setPlaying(false);
  }, [t, playing]);

  const H = useMemo(() => hamiltonianMatrix(p), [p]);
  const eig = useMemo(() => eigHermitian(H), [H]);
  const [Em, Ep] = eig.values;
  const [vm, vp] = eig.vectors;
  // V has the eigenvectors as columns: H = V Λ V†
  const { V, Lambda: Lam, expLambda: expL, U: Ueig } = spectralEvolution(H, t);
  const Uexp = expm(matScale(H, c(0, -t)));
  const errEig = frobenius(matSub(Ueig, Uexp));
  const errRecon = frobenius(matSub(matProd(V, Lam, dagger(V)), H));

  const psi0 = useMemo(() => stateFromAngles(init.theta, init.phi), [init]);
  const cm = inner(vm, psi0);
  const cp = inner(vp, psi0);
  const cmT = mul(cm, expi(-Em * t));
  const cpT = mul(cp, expi(-Ep * t));
  const psi = apply(Uexp, psi0);
  const b = blochVector(psi);
  const b0 = blochVector(psi0);
  const axis: Vec3 | null = eig.axis;
  const trail = useMemo(() => {
    const pts: Vec3[] = [];
    const n = Math.max(2, Math.ceil((t / TMAX) * 300));
    for (let k = 0; k <= n; k++) pts.push(blochVector(apply(expm(matScale(H, c(0, (-t * k) / n))), psi0)));
    return pts;
  }, [H, psi0, t]);

  // conjugation identity: e^{U†AU} = U† e^A U
  const A = aKind === 'ham' ? matScale(H, c(0, -t)) : Ar;
  const lhs = expm(matProd(dagger(U), A, U));
  const rhs = matProd(dagger(U), expm(A), U);
  const err31c = frobenius(matSub(lhs, rhs));
  const powErr = [2, 3].map((k) => frobenius(matSub(matPow(matProd(dagger(U), A, U), k), matProd(dagger(U), matPow(A, k), U))));

  const viz = (
    <BlochCanvas
      overlay={
        <>
          <div className="absolute left-3 top-3 rounded-lg bg-ink-900/75 px-3 py-2 text-[13px] ring-1 ring-ink-700 backdrop-blur">
            <Label className="mb-0.5">expansion in the eigenbasis of H</Label>
            <Tex>{`\\ket{\\psi(t)} = c_+e^{-iE_+t}\\ket{v_+} + c_-e^{-iE_-t}\\ket{v_-}`}</Tex>
          </div>
          <div className="absolute bottom-2 left-3 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px]">
            <Swatch color={COLORS.p0}>|v₊⟩ (energy E₊)</Swatch>
            <Swatch color={COLORS.p1}>|v₋⟩ (energy E₋)</Swatch>
            <Swatch color={COLORS.state}>ψ(t)</Swatch>
          </div>
          {!axis && (
            <div className="absolute right-3 top-3 rounded-lg bg-p1/10 px-3 py-1.5 text-[12px] text-p1 ring-1 ring-p1/30">degenerate: every basis is an eigenbasis</div>
          )}
        </>
      }
    >
      {axis && <AxisLine n={axis} dashed opacity={0.7} />}
      {axis && <OrbitCircle n={axis} through={b0} />}
      {axis && <PointMarker v={axis} color={COLORS.p0} label="v_+" ring />}
      {axis && <PointMarker v={[-axis[0], -axis[1], -axis[2]]} color={COLORS.p1} label="v_-" ring />}
      <Trail points={trail} />
      <PointMarker v={b0} color={COLORS.faint} size={0.03} />
      <StateArrow v={b} />
    </BlochCanvas>
  );

  const controls = (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="Hermitian H and time t" kicker="parameters">
        <div className="space-y-2.5">
          <Slider tex="\bar\omega" value={p.omegaBar} min={-2} max={2} step={0.01} onChange={(v) => setP({ ...p, omegaBar: v })} format={(v) => v.toFixed(2)} color={COLORS.phase} hl="omegabar" />
          <Slider tex="\Delta\omega" value={p.deltaOmega} min={-2} max={2} step={0.01} onChange={(v) => setP({ ...p, deltaOmega: v })} format={(v) => v.toFixed(2)} color={COLORS.axis} hl="deltaomega" />
          <Slider tex="\epsilon" value={p.epsilon} min={-2} max={2} step={0.01} onChange={(v) => setP({ ...p, epsilon: v })} format={(v) => v.toFixed(2)} color={COLORS.axis} hl="epsilon" />
          <Slider tex="t" value={t} min={0} max={TMAX} step={0.001} onChange={(v) => { setPlaying(false); setT(v); }} format={(v) => v.toFixed(2)} hl="t" />
          <PlaybackBar
            playing={playing}
            onToggle={() => { if (t >= TMAX) setT(0); setPlaying(!playing); }}
            onReset={() => { setPlaying(false); setT(0); }}
            onReplay={() => { setT(0); setPlaying(true); }}
            speed={speed}
            onSpeed={setSpeed}
          />
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
      <Card title="Eigen-amplitudes just rotate" kicker="complex plane">
        <div className="mx-auto max-w-[240px]">
          <ComplexPlane
            amplitudes={[
              { z: cpT, color: COLORS.p0, label: 'c_+e^{-iE_+t}' },
              { z: cmT, color: COLORS.p1, label: 'c_-e^{-iE_-t}' },
            ]}
          />
        </div>
        <div className="mt-1 space-y-0.5">
          <KV k={<Tex>{'|c_+|^2,\\ |c_-|^2'}</Tex>} v={`${fmt(cp.re ** 2 + cp.im ** 2, 3)}, ${fmt(cm.re ** 2 + cm.im ** 2, 3)}  (constant)`} />
          <KV k="relative phase rate E₊ − E₋ = 2r" v={fmt(Ep - Em, 3)} />
        </div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-ink-400">
          In the eigenbasis nothing mixes: each component only turns at its own frequency <Tex>{'E_\\pm'}</Tex>. Their phase difference grows at rate <Tex>{'E_+-E_-'}</Tex>, which is exactly the precession
          about <Tex>{'\\vec v'}</Tex>.
        </p>
      </Card>
    </div>
  );

  const panel = (
    <>
      <Card title="Spectral decomposition" kicker="H = V Λ V†">
        <div className="grid grid-cols-1 gap-1.5">
          <MatBox label="V" M={V} note="columns: normalized eigenvectors |v₋⟩, |v₊⟩" />
          <MatBox label="\Lambda" M={Lam} note="eigenvalues E± = ω̄ ± r on the diagonal" />
        </div>
        <div className="mt-2">
          <Check ok={errRecon < 1e-10}>
            <Tex>{'V\\Lambda V^\\dagger = H'}</Tex>: error <Tex>{texSci(errRecon)}</Tex>
          </Check>
        </div>
      </Card>
      <Card title="Exponentiate in the eigenbasis" kicker="diagonal ⇒ entrywise">
        <Tex display>{'e^{-iHt} = V\\,e^{-i\\Lambda t}\\,V^\\dagger,\\qquad e^{-i\\Lambda t} = \\begin{pmatrix} e^{-iE_-t} & 0 \\\\ 0 & e^{-iE_+t}\\end{pmatrix}'}</Tex>
        <MatBox label={"e^{-i\\Lambda t}"} M={expL} />
        <Tex display>{`V e^{-i\\Lambda t}V^\\dagger = ${texMatrix(Ueig, { digits: 3, exact: false })}`}</Tex>
        <Check ok={errEig < 1e-10}>
          agrees with the series <Tex>{'e^{-iHt}'}</Tex>: error <Tex>{texSci(errEig)}</Tex>
        </Check>
        <p className="mt-2 text-[12px] leading-relaxed text-ink-400">
          Why it works: <Tex>{'(V\\Lambda V^\\dagger)^k = V\\Lambda^k V^\\dagger'}</Tex> because <Tex>{'V^\\dagger V = I'}</Tex>, and <Tex>{'\\Lambda^k'}</Tex> is diagonal. This is the conjugation identity below with{' '}
          <Tex>{'U = V^\\dagger'}</Tex>.
        </p>
      </Card>
      <Card
        title={<>Conjugation identity: <Tex>{'e^{U^\\dagger AU} = U^\\dagger e^A U'}</Tex></>}
        kicker="for any A and unitary U"
        right={
          <div className="flex gap-1">
            <Button size="sm" onClick={() => setU(randomUnitary())}>random U</Button>
            {aKind === 'random' && <Button size="sm" onClick={() => setAr(randomComplexMatrix())}>random A</Button>}
          </div>
        }
      >
        <Segmented
          size="sm"
          value={aKind}
          onChange={setAKind}
          options={[
            { value: 'ham', label: 'A = −iHt' },
            { value: 'random', label: 'A random complex' },
          ]}
        />
        <div className="mt-2 grid grid-cols-1 gap-1.5">
          <MatBox label="U" M={U} digits={2} note={`unitary: U†U = I, |det U| = ${fmt(abs(det(U)), 3)}`} />
          <MatBox label="e^{U^\dagger A U}" M={lhs} digits={3} />
          <MatBox label="U^\dagger e^{A} U" M={rhs} digits={3} />
        </div>
        <div className="mt-2 space-y-1">
          <Check ok={err31c < 1e-9}>
            <Tex>{'\\|e^{U^\\dagger AU} - U^\\dagger e^A U\\|'}</Tex> = <Tex>{texSci(err31c)}</Tex>
          </Check>
          {powErr.map((e, i) => (
            <Check key={i} ok={e < 1e-9}>
              <Tex>{`(U^\\dagger A U)^{${i + 2}} = U^\\dagger A^{${i + 2}} U`}</Tex>: <Tex>{texSci(e)}</Tex>
            </Check>
          ))}
        </div>
        <Callout tone="info" title="Proof idea">
          <Tex>{'(U^\\dagger AU)^k = U^\\dagger A\\,(UU^\\dagger)\\,A\\,(UU^\\dagger)\\cdots A U = U^\\dagger A^k U'}</Tex>; insert into the series and pull <Tex>{'U^\\dagger'}</Tex> and <Tex>{'U'}</Tex> out of
          every term.
        </Callout>
      </Card>
    </>
  );

  return <>{header(viz, controls, panel)}</>;
}
