import { ReactNode, useMemo, useState } from 'react';
import { BlochCanvas, StateArrow, Trail, AxisLine, OrbitCircle } from '../components/bloch';
import { Tex } from '../components/Tex';
import { useRaf } from '../hooks/animation';
import { navigate } from '../layout/router';
import { Contents } from '../layout/Contents';
import { evolveState, blochVector, stateFromAngles, hamiltonianAxis, HamiltonianParams, Vec3 } from '../quantum';
import { COLORS, phaseColor } from '../theme';
import { Button, Icon } from '../components/ui';

const HERO_H: HamiltonianParams = { omegaBar: 0.3, deltaOmega: 0.55, epsilon: 0.45 };
const PSI0 = stateFromAngles(0.25, 0);

function HeroSphere() {
  const [t, setT] = useState(0);
  useRaf((dt) => setT((x) => x + dt * 0.9), true);
  const { v } = hamiltonianAxis(HERO_H);
  const trail = useMemo(() => {
    const pts: Vec3[] = [];
    const t0 = Math.max(0, t - 3.4);
    for (let k = 0; k <= 90; k++) pts.push(blochVector(evolveState(HERO_H, PSI0, t0 + ((t - t0) * k) / 90)));
    return pts;
  }, [t]);
  const b = blochVector(evolveState(HERO_H, PSI0, t));
  return (
    <BlochCanvas labels="kets" interactive={false} zoom={1.02}>
      <AxisLine n={v!} label="\vec v" />
      <OrbitCircle n={v!} through={blochVector(PSI0)} />
      <Trail points={trail} lineWidth={2.6} />
      <StateArrow v={b} />
    </BlochCanvas>
  );
}

/** Tiny glyphs for the figure key. */
function Glyph({ kind }: { kind: 'ink' | 'hue' | 'dash' | 'outcome' }) {
  const ink = COLORS.text;
  const segs = useMemo(
    () =>
      Array.from({ length: 36 }, (_, k) => {
        const a0 = (2 * Math.PI * k) / 36;
        const a1 = (2 * Math.PI * (k + 1.1)) / 36;
        const r = 15;
        return { d: `M ${24 + r * Math.cos(a0)} ${24 - r * Math.sin(a0)} A ${r} ${r} 0 0 0 ${24 + r * Math.cos(a1)} ${24 - r * Math.sin(a1)}`, c: phaseColor((a0 + a1) / 2) };
      }),
    [],
  );
  return (
    <svg viewBox="0 0 48 48" className="h-12 w-12" aria-hidden>
      {kind === 'ink' && (
        <>
          <line x1="12" y1="36" x2="33" y2="13" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />
          <path d="M 36.5 9 L 27.5 13.6 L 33.6 19.3 Z" fill={ink} />
          <circle cx="12" cy="36" r="2.2" fill={ink} />
        </>
      )}
      {kind === 'hue' && segs.map((s, i) => <path key={i} d={s.d} fill="none" stroke={s.c} strokeWidth="3.2" />)}
      {kind === 'dash' && (
        <>
          <line x1="8" y1="40" x2="36" y2="12" stroke={COLORS.axis} strokeWidth="1.8" strokeDasharray="4 3.5" />
          <path d="M 40 8 L 31.5 11 L 37 16.5 Z" fill={COLORS.axis} />
        </>
      )}
      {kind === 'outcome' && (
        <>
          <circle cx="15" cy="24" r="7.5" fill={ink} />
          <circle cx="34" cy="24" r="6.8" fill="none" stroke={COLORS.p1} strokeWidth="2" />
        </>
      )}
    </svg>
  );
}

function Rule({ kind, title, children }: { kind: 'ink' | 'hue' | 'dash' | 'outcome'; title: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[48px_minmax(0,1fr)] gap-4 border-t border-ink-750 pt-4">
      <Glyph kind={kind} />
      <div>
        <div className="text-[16.5px] font-semibold leading-snug text-ink-100">{title}</div>
        <div className="mt-1 text-[14px] leading-relaxed text-ink-300">{children}</div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-[1560px] px-4 pb-10 pt-10 lg:px-8 lg:pt-14">
      <section className="grid items-center gap-x-14 gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
        <div className="min-w-0">
          <div className="font-mono text-[11px] tracking-[0.06em] text-ink-400">an interactive text on single-qubit quantum mechanics</div>
          <h1 className="mt-3 text-[46px] font-semibold leading-[0.98] tracking-[-0.03em] text-ink-100 sm:text-[60px] lg:text-[76px]" style={{ fontVariationSettings: '"opsz" 60' }}>
            Qubit
            <br />
            Playground
          </h1>
          <p className="mt-6 max-w-[540px] text-[19px] leading-[1.5] text-ink-200">
            Drag a state across the Bloch sphere, apply gates as rotations, let it evolve under a Hamiltonian and send it through Stern–Gerlach magnets.{' '}
            <em className="text-ink-100">Every figure is computed from the state vector</em> — nothing is animated by hand.
          </p>
          <div className="mt-7 max-w-[540px] border-y border-ink-750 py-3 text-[13.5px] sm:text-[17px]">
            <Tex display>{'i\\frac{d}{dt}\\ket{\\psi(t)} = H\\ket{\\psi(t)} \\quad\\Longrightarrow\\quad \\ket{\\psi(t)} = e^{-iHt}\\ket{\\psi(0)}'}</Tex>
          </div>
          <div className="mt-7 flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => navigate('/bloch')}>
              begin with chapter 01 {Icon.arrowR}
            </Button>
            <Button onClick={() => navigate('/exercises')}>guided problems</Button>
          </div>
        </div>
        <figure className="min-w-0">
          <div className="bg-grid relative h-[380px] overflow-hidden rounded-[16px] ring-1 ring-inset ring-ink-750 sm:h-[460px] lg:h-[560px]">
            <HeroSphere />
          </div>
          <figcaption className="mt-3 max-w-[620px] text-[13.5px] leading-relaxed text-ink-300">
            <span className="font-mono text-[11px] text-ink-400">fig. 1</span>&ensp;Precession under <Tex>{'H = 0.3\\,I + 0.45\\,X + 0.55\\,Z'}</Tex>. The state turns about the
            dashed axis <Tex>{'\\vec v'}</Tex>; its trail takes the hue of the relative phase, which is also the colour of the equator beneath it.
          </figcaption>
        </figure>
      </section>

      <section className="mt-20">
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <h2 className="text-[26px] font-semibold tracking-[-0.015em] text-ink-100">How to read the figures</h2>
          <span className="hidden font-mono text-[11px] text-ink-500 sm:inline">four rules, used everywhere</span>
        </div>
        <div className="grid gap-x-10 gap-y-6 md:grid-cols-2 xl:grid-cols-4">
          <Rule kind="ink" title="Ink is the state">
            The quantum state — the Bloch vector, the ket — is always drawn in full-strength ink. Drag it wherever you see it.
          </Rule>
          <Rule kind="hue" title="Hue is phase">
            Colour always means a complex phase, read on the wheel: the equator of the Bloch sphere, the rim of the complex plane.
          </Rule>
          <Rule kind="dash" title="Dashes are constructions">
            Rotation axes, measurement directions and projections are thin dashed lines — the geometry the state moves against.
          </Rule>
          <Rule kind="outcome" title="Filled or hollow is the outcome">
            Outcome + / 0 / ↑ is filled, outcome − / 1 / ↓ is hollow or hatched, in bars, beams and markers alike.
          </Rule>
        </div>
        <p className="mt-5 max-w-[760px] text-[14px] leading-relaxed text-ink-400">
          Highlighted symbols in equations carry a dotted underline: hover one to light up the matching part of the figure. Conventions throughout:{' '}
          <Tex>{'\\ket{0} = +z'}</Tex>, <Tex>{'\\ket{+} = +x'}</Tex>, <Tex>{'\\ket{+i} = +y'}</Tex>, <Tex>{'R_{\\vec n}(\\theta) = e^{-i\\theta\\,\\vec n\\cdot\\vec\\sigma/2}'}</Tex>,{' '}
          <Tex>{'\\hbar = 1'}</Tex>.
        </p>
      </section>

      <section className="mt-20">
        <h2 className="mb-5 text-[26px] font-semibold tracking-[-0.015em] text-ink-100">Contents</h2>
        <Contents />
      </section>
    </div>
  );
}
