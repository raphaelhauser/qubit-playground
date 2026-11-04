import { useMemo, useState } from 'react';
import { BlochCanvas, Arrow, AxisLine, PointMarker, Trail, StateArrow } from '../../components/bloch';
import { LinePlot } from '../../components/charts';
import { Tex } from '../../components/Tex';
import { Card, Slider, Button, KV, Callout, Icon } from '../../components/ui';
import { PredictionCard } from '../../components/Prediction';
import { useTween } from '../../hooks/animation';
import { COLORS } from '../../theme';
import {
  Vec2,
  Vec3,
  PRESETS,
  KET0,
  stateFromAngles,
  blochVector,
  apply,
  matMul,
  dagger,
  axisAngle,
  fidelity,
  angleBetween,
  texMatrix,
  texAngle,
  fmt,
  fmtAngle,
  equalUpToGlobalPhase,
} from '../../quantum';
import { xThenY, yThenX, orderDiscrepancy, twoStepPath, twoStepState, groupCommutator } from './pauliMath';

const XA: Vec3 = [1, 0, 0];
const YA: Vec3 = [0, 1, 0];
const fmtVec = (v: readonly number[]) => `(${fmt(v[0], 2)}, ${fmt(v[1], 2)}, ${fmt(v[2], 2)})`;

export function useRotationOrder() {
  const [alpha, setAlpha] = useState(Math.PI / 2);
  const [beta, setBeta] = useState(Math.PI / 2);
  const [psi, setPsi] = useState<Vec2>(KET0);
  const tween = useTween();
  return { alpha, setAlpha, beta, setBeta, psi, setPsi, tween };
}
type RO = ReturnType<typeof useRotationOrder>;

export function RotationOrderViz({ ro }: { ro: RO }) {
  const { alpha, beta, psi, tween } = ro;
  const p = tween.progress;
  const path1 = useMemo(() => twoStepPath(psi, XA, alpha, YA, beta, p), [psi, alpha, beta, p]);
  const path2 = useMemo(() => twoStepPath(psi, YA, beta, XA, alpha, p), [psi, alpha, beta, p]);
  const r1 = blochVector(twoStepState(psi, XA, alpha, YA, beta, p));
  const r2 = blochVector(twoStepState(psi, YA, beta, XA, alpha, p));
  const r0 = blochVector(psi);
  return (
    <BlochCanvas
      overlay={
        <div className="absolute left-3 top-3 space-y-1 rounded-lg bg-ink-900/75 px-3 py-2 text-[12.5px] ring-1 ring-ink-700 backdrop-blur">
          <div className="flex items-center gap-2"><span className="h-0.5 w-4" style={{ background: COLORS.p0 }} /> <Tex>{'R_x(\\alpha)'}</Tex> first, then <Tex>{'R_y(\\beta)'}</Tex></div>
          <div className="flex items-center gap-2"><span className="h-0.5 w-4" style={{ background: COLORS.p1 }} /> <Tex>{'R_y(\\beta)'}</Tex> first, then <Tex>{'R_x(\\alpha)'}</Tex></div>
          <div className="text-[11.5px] text-ink-400">final states {fmtAngle(angleBetween(blochVector(apply(xThenY(alpha, beta), psi)), blochVector(apply(yThenX(alpha, beta), psi))))} apart</div>
        </div>
      }
    >
      <AxisLine n={XA} color={COLORS.axis} dashed opacity={0.6} lineWidth={1.4} />
      <AxisLine n={YA} color={COLORS.axis} dashed opacity={0.6} lineWidth={1.4} />
      <PointMarker v={r0} color={COLORS.state} size={0.04} label="\psi" />
      <Arrow v={r0} color={COLORS.state} opacity={0.3} radius={0.014} />
      <Trail points={path1} color={COLORS.p0} lineWidth={2.2} fade={false} />
      <Trail points={path2} color={COLORS.p1} lineWidth={2.2} fade={false} />
      <StateArrow v={r1} color={COLORS.p0} />
      <StateArrow v={r2} color={COLORS.p1} />
    </BlochCanvas>
  );
}

export function RotationOrderControls({ ro }: { ro: RO }) {
  const { alpha, setAlpha, beta, setBeta, psi, setPsi, tween } = ro;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="Two rotations, two orders" kicker="non-commuting generators">
        <div className="space-y-3">
          <Slider tex="\alpha" label="angle about x" value={alpha} min={0} max={Math.PI} onChange={setAlpha} format={(v) => texAngle(v, { inline: true })} color={COLORS.axis} />
          <Slider tex="\beta" label="angle about y" value={beta} min={0} max={Math.PI} onChange={setBeta} format={(v) => texAngle(v, { inline: true })} color={COLORS.axis} />
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="primary" onClick={() => tween.start(2600, undefined, (s) => s)} disabled={tween.running}>
              {Icon.play} animate both orders
            </Button>
            <Button size="sm" onClick={() => { setAlpha(0.35); setBeta(0.35); }}>small angles (0.35)</Button>
            <Button size="sm" onClick={() => { setAlpha(Math.PI / 2); setBeta(Math.PI / 2); }}>
              <Tex>{'\\pi/2,\\ \\pi/2'}</Tex>
            </Button>
          </div>
        </div>
      </Card>
      <Card title="Test state" kicker="input">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((pr) => (
            <Button key={pr.id} size="sm" active={equalUpToGlobalPhase(psi, stateFromAngles(pr.theta, pr.phi))} onClick={() => setPsi(stateFromAngles(pr.theta, pr.phi))}>
              <Tex>{pr.tex}</Tex>
            </Button>
          ))}
          <Button size="sm" onClick={() => setPsi(stateFromAngles(0.9, 0.6))}>generic</Button>
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-400">
          Watch the order convention: “first <Tex>{'R_x'}</Tex>, then <Tex>{'R_y'}</Tex>” is the matrix <Tex>{'R_y(\\beta)R_x(\\alpha)'}</Tex> — operators act on the ket from
          right to left.
        </p>
      </Card>
    </div>
  );
}

export function RotationOrderPanel({ ro }: { ro: RO }) {
  const { alpha, beta, psi, setAlpha, setBeta, setPsi, tween } = ro;
  const U1 = xThenY(alpha, beta);
  const U2 = yThenX(alpha, beta);
  const disc = orderDiscrepancy(alpha, beta);
  const exact = 2 * Math.SQRT2 * Math.sin(alpha / 2) * Math.sin(beta / 2);
  const lead = (alpha * beta) / Math.SQRT2;
  const rel = axisAngle(matMul(U1, dagger(U2)));
  const gc = axisAngle(groupCommutator(alpha, beta));
  const psi1 = apply(U1, psi);
  const psi2 = apply(U2, psi);
  const scaling = useMemo(() => {
    const exactS: [number, number][] = [];
    const leadS: [number, number][] = [];
    for (let k = 0; k <= 80; k++) {
      const l = k / 80;
      exactS.push([l, orderDiscrepancy(l * alpha, l * beta)]);
      leadS.push([l, (l * l * alpha * beta) / Math.SQRT2]);
    }
    return { exactS, leadS, yMax: Math.max(0.05, ...exactS.map((p) => p[1]), ...leadS.map((p) => p[1])) * 1.1 };
  }, [alpha, beta]);
  return (
    <>
      <Card title="The two products" kicker="computed">
        <Tex display>{`R_y(\\beta)R_x(\\alpha) = ${texMatrix(U1, { digits: 2 })}`}</Tex>
        <Tex display>{`R_x(\\alpha)R_y(\\beta) = ${texMatrix(U2, { digits: 2 })}`}</Tex>
        <div className="space-y-0.5">
          <KV k={<Tex>{'\\|R_yR_x - R_xR_y\\|_F'}</Tex>} v={fmt(disc, 4)} />
          <KV k={<Tex>{'2\\sqrt2\\,\\sin\\tfrac{\\alpha}{2}\\sin\\tfrac{\\beta}{2}'}</Tex>} v={fmt(exact, 4)} />
          <KV k={<span>leading order <Tex>{'\\alpha\\beta/\\sqrt2'}</Tex></span>} v={fmt(lead, 4)} />
          <KV k="fidelity of the two final states" v={fmt(fidelity(psi1, psi2), 4)} />
        </div>
      </Card>
      <Card title="Quadratic in the angles" kicker="shrink both angles by λ">
        <LinePlot
          series={[
            { points: scaling.exactS, color: COLORS.state, label: '\\|[R_x(\\lambda\\alpha), R_y(\\lambda\\beta)]\\|' },
            { points: scaling.leadS, color: COLORS.phase, dashed: true, label: '\\lambda^2\\alpha\\beta/\\sqrt2' },
          ]}
          xMin={0}
          xMax={1}
          yMin={0}
          yMax={scaling.yMax}
          height={150}
          cursorX={1}
          xLabel="λ"
          yTicks={[0, 0.5, 1].map((f) => ({ value: f * scaling.yMax, label: (f * scaling.yMax).toFixed(2) }))}
          xTicks={[0, 0.5, 1].map((v) => ({ value: v, label: String(v) }))}
        />
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-400">
          Expanding <Tex>{'R_x(\\alpha) \\approx I - \\tfrac{i\\alpha}{2}X'}</Tex>, <Tex>{'R_y(\\beta) \\approx I - \\tfrac{i\\beta}{2}Y'}</Tex>, the first-order terms cancel and
        </p>
        <Tex display>{'R_x R_y - R_y R_x \\approx \\left(-\\tfrac{i\\alpha}{2}\\right)\\left(-\\tfrac{i\\beta}{2}\\right)[X,Y] = -\\tfrac{\\alpha\\beta}{4}\\cdot 2iZ'}</Tex>
        <p className="text-[12.5px] leading-relaxed text-ink-400">
          — the order dependence is <em>generated by the commutator</em> <Tex>{'[X,Y] = 2iZ'}</Tex>, so it is second order and points along z.
        </p>
      </Card>
      <Card title="The mismatch is a z rotation" kicker="what separates the two endings">
        <div className="space-y-0.5">
          <KV k={<Tex>{'U_1U_2^\\dagger'}</Tex>} v={rel.trivial ? 'identity' : `${fmtAngle(rel.angle)} about ${fmtVec(rel.axis)}`} />
          <KV k={<span>prediction <Tex>{'\\approx R_z(-\\alpha\\beta)'}</Tex></span>} v={`${fmt(alpha * beta, 3)} rad about (0, 0, −1)`} />
          <KV k={<Tex>{'R_x(\\alpha)R_y(\\beta)R_x(-\\alpha)R_y(-\\beta)'}</Tex>} v={gc.trivial ? 'identity' : `${fmt(gc.angle, 3)} rad about ${fmtVec(gc.axis)}`} />
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-400">
          The “group commutator” of two small rotations about x and y is a small rotation about z by <Tex>{'\\approx\\alpha\\beta'}</Tex>. This is how a Rubik's-cube style
          sequence of two rotations creates motion about the third axis.
        </p>
      </Card>
      <PredictionCard
        question={
          <>
            Start in <Tex>{'\\ket0'}</Tex>. Do <Tex>{'R_x(\\pi/2)'}</Tex> then <Tex>{'R_y(\\pi/2)'}</Tex>, versus the reverse order. Do both orders end in the same state?
          </>
        }
        options={[
          { id: 'same', label: 'Yes, rotations commute.' },
          { id: 'phase', label: 'They differ only by a global phase.' },
          { id: 'diff', label: 'No — they end at different points of the sphere.' },
        ]}
        answer="diff"
        onRun={() => {
          setAlpha(Math.PI / 2);
          setBeta(Math.PI / 2);
          setPsi(KET0);
          window.setTimeout(() => tween.start(2600, undefined, (s) => s), 50);
        }}
        explanation={
          <p>
            <Tex>{'R_x(\\pi/2)'}</Tex> takes <Tex>{'\\ket0'}</Tex> to <Tex>{'\\ket{-i}'}</Tex>, which lies on the y axis, so the following <Tex>{'R_y'}</Tex> does nothing: the teal
            path ends at <Tex>{'-y'}</Tex>. In the other order <Tex>{'R_y(\\pi/2)'}</Tex> takes <Tex>{'\\ket0'}</Tex> to <Tex>{'\\ket{+}'}</Tex> on the x axis and <Tex>{'R_x'}</Tex>{' '}
            leaves it there: the coral path ends at <Tex>{'+x'}</Tex>. Orthogonal-on-the-sphere endings (fidelity 1/2). Finite rotations about different axes do not commute,
            because <Tex>{'X'}</Tex> and <Tex>{'Y'}</Tex> do not.
          </p>
        }
      />
      <Callout tone="info" title="Commuting operators, commuting rotations">
        <Tex>{'R_z(\\alpha)'}</Tex> and <Tex>{'R_z(\\beta)'}</Tex> always commute (same generator <Tex>{'Z'}</Tex>). In general{' '}
        <Tex>{'e^{-i\\alpha A}e^{-i\\beta B} = e^{-i\\beta B}e^{-i\\alpha A}'}</Tex> for all angles iff <Tex>{'[A,B] = 0'}</Tex>.
      </Callout>
    </>
  );
}
