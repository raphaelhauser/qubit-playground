import { useMemo, useState } from 'react';
import { ModuleShell } from '../../layout/ModuleShell';
import { BlochCanvas, StateArrow, AngleGuides, DragHandle, PointMarker } from '../../components/bloch';
import { ComplexPlane } from '../../components/ComplexPlane';
import { ProbabilityBars } from '../../components/charts';
import { Tex } from '../../components/Tex';
import { Card, Slider, Button, KV, Callout, Label, Swatch, Icon } from '../../components/ui';
import { PredictionCard } from '../../components/Prediction';
import { useHighlight } from '../../components/Highlight';
import { useRaf } from '../../hooks/animation';
import { COLORS, phaseColor } from '../../theme';
import {
  PRESETS,
  stateFromAngles,
  blochVector,
  anglesFromBloch,
  vscale,
  expi,
  abs,
  abs2,
  arg,
  texComplex,
  texAngle,
  texKet,
  fmt,
  fmtAngle,
  Vec3,
} from '../../quantum';

const TWO_PI = 2 * Math.PI;
const wrap = (x: number) => ((x % TWO_PI) + TWO_PI) % TWO_PI;

type Anim = null | 'phi' | 'gamma';

export default function BlochModule(_props: { subpath: string }) {
  const [theta, setTheta] = useState(Math.PI / 3);
  const [phi, setPhi] = useState(Math.PI / 4);
  const [gamma, setGamma] = useState(0);
  const [anim, setAnim] = useState<Anim>(null);
  const [speed] = useState(0.9); // rad / s
  const { active } = useHighlight();

  // physics: |ψ⟩ = e^{iγ} (cos θ/2 |0⟩ + e^{iφ} sin θ/2 |1⟩)
  const base = useMemo(() => stateFromAngles(theta, phi), [theta, phi]);
  const psi = useMemo(() => vscale(base, expi(gamma)), [base, gamma]);
  const r = useMemo(() => blochVector(psi), [psi]);
  const [alpha, beta] = psi;
  const p0 = abs2(alpha);
  const p1 = abs2(beta);
  const pPlus = (1 + r[0]) / 2;

  useRaf((dt) => {
    if (anim === 'phi') setPhi((p) => wrap(p + speed * dt));
    if (anim === 'gamma') setGamma((g) => wrap(g + speed * dt));
  }, anim !== null);

  const setFromBloch = (v: Vec3) => {
    const a = anglesFromBloch(v);
    setTheta(a.theta);
    // keep φ meaningful when dragging through a pole
    if (Math.hypot(v[0], v[1]) > 1e-3) setPhi(a.phi);
  };

  const presetActive = (t: number, p: number) => Math.abs(theta - t) < 1e-6 && (Math.abs(wrap(phi - p)) < 1e-6 || Math.abs(Math.sin(t)) < 1e-9);

  const viz = (
    <BlochCanvas
      overlay={
        <>
          <div className="absolute left-3 top-3 rounded-lg bg-ink-900/75 px-3 py-2 ring-1 ring-ink-700 backdrop-blur">
            <Label className="mb-0.5">current state</Label>
            <div className="text-[16px]">
              <Tex>{`\\ket{\\psi} = ${texKet(psi, { digits: 3 })}`}</Tex>
            </div>
          </div>
          <div className="absolute bottom-2 left-3 text-[11.5px] text-ink-400">Drag the glowing tip, or click anywhere on the sphere. Drag the background to orbit.</div>
          {anim === 'gamma' && (
            <div className="absolute right-3 top-3 animate-fadein rounded-lg bg-good/10 px-3 py-1.5 text-[12px] text-good ring-1 ring-good/30">
              global phase γ = {fmtAngle(gamma)} · Bloch vector unchanged
            </div>
          )}
        </>
      }
    >
      <AngleGuides v={r} highlight={active} />
      <StateArrow v={r} emphasized={active === 'psi' || active === 'bloch'} />
      <DragHandle
        v={r}
        onChange={setFromBloch}
        onDragStart={() => setAnim(null)}
      />
      {active === 'p0' && <PointMarker v={[0, 0, 1]} color={COLORS.p0} ring />}
      {active === 'p1' && <PointMarker v={[0, 0, -1]} color={COLORS.p1} ring />}
    </BlochCanvas>
  );

  const controls = (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="State parameters" kicker="drive the state">
        <div className="space-y-3">
          <Slider tex="\theta" label="polar angle" value={theta} min={0} max={Math.PI} onChange={(v) => { setTheta(v); }} format={(v) => texAngle(v, { inline: true })} hl="theta" color={COLORS.text} />
          <Slider tex="\varphi" label="relative phase" value={phi} min={0} max={TWO_PI} onChange={(v) => { setAnim(null); setPhi(v); }} format={(v) => texAngle(v, { inline: true })} hl="phi" color={phaseColor(phi)} />
          <div>
            <Label className="mb-1.5">presets</Label>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <Button
                  key={p.id}
                  size="sm"
                  active={presetActive(p.theta, p.phi)}
                  title={p.description}
                  onClick={() => {
                    setAnim(null);
                    setTheta(p.theta);
                    setPhi(p.phi);
                  }}
                >
                  <Tex>{p.tex}</Tex>
                </Button>
              ))}
            </div>
          </div>
        </div>
      </Card>
      <Card title="Phase lab" kicker="global vs relative phase">
        <div className="space-y-3">
          <Slider tex="\gamma" label="global phase" value={gamma} min={0} max={TWO_PI} onChange={(v) => { setAnim(null); setGamma(v); }} format={(v) => texAngle(v, { inline: true })} hl="gamma" color={phaseColor(gamma)} />
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" active={anim === 'phi'} onClick={() => setAnim(anim === 'phi' ? null : 'phi')}>
              {anim === 'phi' ? Icon.pause : Icon.play} sweep relative phase φ
            </Button>
            <Button size="sm" active={anim === 'gamma'} onClick={() => setAnim(anim === 'gamma' ? null : 'gamma')}>
              {anim === 'gamma' ? Icon.pause : Icon.play} sweep global phase γ
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setAnim(null); setGamma(0); }}>
              {Icon.reset} γ = 0
            </Button>
          </div>
          <p className="text-[12.5px] leading-relaxed text-ink-400">
            Sweeping <Tex>{'\\varphi'}</Tex> precesses the arrow about the z axis — a physical change. Sweeping{' '}
            <Tex>{'\\gamma'}</Tex> spins both amplitudes in the complex plane together, but the arrow does not move at all.
          </p>
        </div>
      </Card>
    </div>
  );

  const panel = (
    <>
      <Card title="The state" kicker="parametrization">
        <Tex display>
          {'\\ket{\\hl{psi}{\\psi}} = \\hl{alpha}{\\alpha}\\ket{0} + \\hl{beta}{\\beta}\\ket{1} = e^{i\\hl{gamma}{\\gamma}}\\Big(\\cos\\tfrac{\\hl{theta}{\\theta}}{2}\\ket{0} + e^{i\\hl{phi}{\\varphi}}\\sin\\tfrac{\\hl{theta}{\\theta}}{2}\\ket{1}\\Big)'}
        </Tex>
        <div className="mt-1 grid grid-cols-3 gap-2 text-center text-[12px]">
          <div className="rounded-md bg-ink-800 py-1"><Tex>{`\\theta = ${texAngle(theta)}`}</Tex></div>
          <div className="rounded-md bg-ink-800 py-1"><Tex>{`\\varphi = ${texAngle(phi)}`}</Tex></div>
          <div className="rounded-md bg-ink-800 py-1"><Tex>{`\\gamma = ${texAngle(gamma)}`}</Tex></div>
        </div>
        <div className="mt-3 space-y-1 text-[13px]">
          <Tex display>{`\\hl{alpha}{\\alpha} = e^{i\\gamma}\\cos\\tfrac{\\theta}{2} = ${texComplex(alpha)}`}</Tex>
          <Tex display>{`\\hl{beta}{\\beta} = e^{i(\\gamma+\\varphi)}\\sin\\tfrac{\\theta}{2} = ${texComplex(beta)}`}</Tex>
        </div>
      </Card>

      <Card title="Amplitudes in the complex plane" kicker="what the numbers look like" right={<div className="flex gap-3"><Swatch color={COLORS.p0}>α</Swatch><Swatch color={COLORS.p1}>β</Swatch></div>}>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-center gap-3">
          <ComplexPlane
            amplitudes={[
              { z: alpha, color: COLORS.p0, label: '\\alpha', hl: 'alpha' },
              { z: beta, color: COLORS.p1, label: '\\beta', hl: 'beta' },
            ]}
          />
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-ink-400">
                <th className="text-left font-normal"></th>
                <th className="text-right font-normal">α</th>
                <th className="text-right font-normal">β</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums text-ink-100">
              {[
                ['Re', fmt(alpha.re), fmt(beta.re)],
                ['Im', fmt(alpha.im), fmt(beta.im)],
                ['|·|', fmt(abs(alpha)), fmt(abs(beta))],
                ['arg', abs(alpha) > 1e-6 ? fmtAngle(wrap(arg(alpha))) : '—', abs(beta) > 1e-6 ? fmtAngle(wrap(arg(beta))) : '—'],
                ['|·|²', fmt(p0), fmt(p1)],
              ].map(([k, a, b]) => (
                <tr key={k} className="border-t border-ink-800">
                  <td className="py-1 font-sans text-ink-400">{k}</td>
                  <td className="py-1 text-right">{a}</td>
                  <td className="py-1 text-right">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 text-[12px] text-ink-400">
          Relative phase <Tex>{'\\arg\\beta - \\arg\\alpha'}</Tex> = <span className="font-mono" style={{ color: phaseColor(phi) }}>{fmtAngle(phi)}</span> — the arc drawn in the hue of that phase, the same hue as the state's tip on the sphere. It is the only phase the Bloch sphere sees.
        </div>
      </Card>

      <Card title="Measurement probabilities" kicker="Born rule">
        <Tex display>{'P(0) = |\\alpha|^2 = \\cos^2\\tfrac{\\theta}{2}, \\qquad P(1) = |\\beta|^2 = \\sin^2\\tfrac{\\theta}{2}'}</Tex>
        <Label className="mb-1 mt-2">computational (Z) basis</Label>
        <ProbabilityBars
          items={[
            { label: 'P(0)', p: p0, color: COLORS.p0, hl: 'p0' },
            { label: 'P(1)', p: p1, color: COLORS.p1, hl: 'p1' },
          ]}
        />
        <Label className="mb-1 mt-3">X basis — sensitive to the relative phase</Label>
        <ProbabilityBars
          items={[
            { label: 'P({+})', p: pPlus, color: COLORS.p0 },
            { label: 'P({-})', p: 1 - pPlus, color: COLORS.p1 },
          ]}
        />
        <p className="mt-2 text-[12px] leading-relaxed text-ink-400">
          Changing <Tex>{'\\varphi'}</Tex> leaves the Z-basis probabilities fixed but changes the X-basis ones: a relative phase is observable, just not in every basis.
        </p>
      </Card>

      <Card title="Bloch vector" kicker="geometry">
        <Tex display>{'\\vec r = (\\sin\\theta\\cos\\varphi,\\ \\sin\\theta\\sin\\varphi,\\ \\cos\\theta) = (\\langle X\\rangle, \\langle Y\\rangle, \\langle Z\\rangle)'}</Tex>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {(['x', 'y', 'z'] as const).map((k, i) => (
            <div key={k} className="rounded-md bg-ink-800 px-2 py-1.5 text-center">
              <div className="text-[11px] italic" style={{ color: COLORS[k] }}>{k}</div>
              <div className="font-mono text-[13px] tabular-nums text-ink-100">{fmt(r[i])}</div>
            </div>
          ))}
        </div>
        <div className="mt-2 space-y-0.5">
          <KV k={<Tex>{'2\\,\\mathrm{Re}(\\bar\\alpha\\beta)'}</Tex>} v={fmt(2 * (alpha.re * beta.re + alpha.im * beta.im))} />
          <KV k={<Tex>{'2\\,\\mathrm{Im}(\\bar\\alpha\\beta)'}</Tex>} v={fmt(2 * (alpha.re * beta.im - alpha.im * beta.re))} />
          <KV k={<Tex>{'|\\alpha|^2 - |\\beta|^2'}</Tex>} v={fmt(p0 - p1)} />
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-ink-400">
          Each component only involves <Tex>{'\\bar\\alpha\\beta'}</Tex> or <Tex>{'|\\alpha|^2,|\\beta|^2'}</Tex>. Multiplying both amplitudes by <Tex>{'e^{i\\gamma}'}</Tex> leaves all of them unchanged —
          that is why a global phase is invisible.
        </p>
      </Card>

      <PredictionCard
        question={
          <>
            Multiply the whole state by <Tex>{'e^{i\\gamma}'}</Tex> and sweep <Tex>{'\\gamma'}</Tex> from 0 to <Tex>{'2\\pi'}</Tex>. What does the Bloch vector do?
          </>
        }
        options={[
          { id: 'rot', label: 'It rotates once around the z axis.' },
          { id: 'still', label: 'It does not move at all.' },
          { id: 'flip', label: 'It flips to the opposite point when γ = π.' },
          { id: 'shrink', label: 'Its length oscillates.' },
        ]}
        answer="still"
        onRun={() => {
          setGamma(0);
          setAnim('gamma');
        }}
        onReset={() => {
          setAnim(null);
          setGamma(0);
        }}
        explanation={
          <>
            <p>
              Watch the complex plane: <Tex>{'\\alpha'}</Tex> and <Tex>{'\\beta'}</Tex> both rotate, but <em>rigidly together</em>, so the angle between them —
              the relative phase — never changes. All measurement probabilities <Tex>{'|\\langle\\phi|\\psi\\rangle|^2'}</Tex> are unchanged for every
              basis <Tex>{'\\ket\\phi'}</Tex>, because <Tex>{'|e^{i\\gamma}z|^2 = |z|^2'}</Tex>.
            </p>
            <p>
              States that differ by a global phase are physically identical. The Bloch sphere is precisely the set of states with this redundancy removed —
              two real parameters <Tex>{'(\\theta,\\varphi)'}</Tex> instead of four.
            </p>
          </>
        }
      />

      <Callout tone="insight" title="Why θ/2?">
        <Tex>{'\\ket0'}</Tex> and <Tex>{'\\ket1'}</Tex> are orthogonal (<Tex>{'\\langle 0|1\\rangle = 0'}</Tex>) yet sit at opposite poles, 180° apart. In general the overlap of two
        states is <Tex>{'|\\langle\\psi|\\chi\\rangle|^2 = \\cos^2(\\Theta/2)'}</Tex> where <Tex>{'\\Theta'}</Tex> is their angle on the sphere: Hilbert-space angles are halved on
        the Bloch sphere.
      </Callout>
    </>
  );

  return (
    <ModuleShell
      letter="A"
      title="Qubits, complex amplitudes & the Bloch sphere"
      intro={
        <p>
          A qubit is a unit vector <Tex>{'\\alpha\\ket0 + \\beta\\ket1'}</Tex> in <Tex>{'\\mathbb C^2'}</Tex>. After discarding the unobservable global phase, every state is a point
          on a sphere. Hover the symbols in the equations to see where they live in the picture.
        </p>
      }
      viz={viz}
      controls={controls}
      panel={panel}
    />
  );
}
