import { useMemo, useState } from 'react';
import { BlochCanvas, StateArrow, Trail, AxisLine, OrbitCircle } from '../components/bloch';
import { Tex } from '../components/Tex';
import { useRaf } from '../hooks/animation';
import { MODULES } from './registry';
import { navigate } from '../layout/router';
import { evolveState, blochVector, stateFromAngles, hamiltonianAxis, HamiltonianParams, Vec3 } from '../quantum';
import { COLORS } from '../theme';

const HERO_H: HamiltonianParams = { omegaBar: 0.3, deltaOmega: 0.55, epsilon: 0.45 };
const PSI0 = stateFromAngles(0.25, 0);

function HeroSphere() {
  const [t, setT] = useState(0);
  useRaf((dt) => setT((x) => x + dt * 0.9), true);
  const { v } = hamiltonianAxis(HERO_H);
  const trail = useMemo(() => {
    const pts: Vec3[] = [];
    const t0 = Math.max(0, t - 3.2);
    for (let k = 0; k <= 80; k++) pts.push(blochVector(evolveState(HERO_H, PSI0, t0 + ((t - t0) * k) / 80)));
    return pts;
  }, [t]);
  const b = blochVector(evolveState(HERO_H, PSI0, t));
  return (
    <BlochCanvas labels="kets" interactive={false} zoom={1.02}>
      <AxisLine n={v!} color={COLORS.axis} dashed opacity={0.8} />
      <OrbitCircle n={v!} through={blochVector(PSI0)} />
      <Trail points={trail} />
      <StateArrow v={b} />
    </BlochCanvas>
  );
}

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-[1300px] px-4 pb-16 pt-6 lg:px-8">
      <div className="grid items-center gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="min-w-0">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-state/80">Interactive single-qubit quantum mechanics</div>
          <h1 className="text-[30px] font-semibold leading-tight tracking-tight text-ink-100 lg:text-[40px]">
            Build intuition for the qubit by <span className="text-state">touching</span> the mathematics.
          </h1>
          <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-ink-300">
            Drag a state across the Bloch sphere, apply gates as rotations, evolve it under a Hamiltonian, and send it through
            Stern–Gerlach magnets. Every arrow, curve and histogram is computed from the state vector and the operators acting on it.
          </p>
          <div className="mt-5 rounded-xl border border-ink-700 bg-ink-850/80 px-4 py-3">
            <Tex display>{'i\\frac{d}{dt}\\ket{\\psi(t)} = H\\ket{\\psi(t)} \\quad\\Longrightarrow\\quad \\ket{\\psi(t)} = e^{-iHt}\\ket{\\psi(0)}'}</Tex>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={() => navigate('/bloch')} className="rounded-lg bg-state/90 px-4 py-2 text-[13.5px] font-semibold text-ink-950 hover:bg-state">
              Start with the Bloch sphere
            </button>
            <button onClick={() => navigate('/exercises')} className="rounded-lg px-4 py-2 text-[13.5px] font-medium text-ink-200 ring-1 ring-inset ring-ink-600 hover:bg-ink-800">
              Try the guided exercises
            </button>
          </div>
        </div>
        <div className="bg-grid relative h-[360px] overflow-hidden rounded-2xl border border-ink-700/80 lg:h-[440px]">
          <HeroSphere />
          <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-ink-900/70 px-2 py-1 text-[11.5px] text-ink-300 ring-1 ring-ink-700">
            <Tex>{'H = 0.3\\,I + 0.45\\,X + 0.55\\,Z'}</Tex>
          </div>
        </div>
      </div>

      <div className="mt-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {MODULES.map((m) => (
          <button
            key={m.id}
            onClick={() => navigate(m.path)}
            className="group rounded-xl border border-ink-700/80 bg-ink-850/70 p-4 text-left transition-colors hover:border-ink-500 hover:bg-ink-800"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ink-750 text-[12px] font-semibold text-state">{m.letter ?? (m.id === 'exercises' ? '✎' : '?')}</span>
              <span className="text-[14.5px] font-semibold text-ink-100">{m.title}</span>
            </div>
            <div className="mt-2 text-[13px] text-ink-400">{m.short}</div>
          </button>
        ))}
      </div>

      <div className="mt-10 grid gap-4 text-[13px] leading-relaxed text-ink-300 md:grid-cols-3">
        <div>
          <div className="mb-1 text-[12px] font-semibold text-ink-100">Colour language</div>
          <div className="space-y-1">
            <Legend c={COLORS.state}>quantum state |ψ⟩</Legend>
            <Legend c={COLORS.axis}>rotation axes, generators</Legend>
            <Legend c={COLORS.phase}>complex phases</Legend>
            <Legend c={COLORS.p0}>outcome 0 / ↑ / +</Legend>
            <Legend c={COLORS.p1}>outcome 1 / ↓ / −</Legend>
          </div>
        </div>
        <div>
          <div className="mb-1 text-[12px] font-semibold text-ink-100">Linked representations</div>
          Hover any highlighted symbol in an equation to see the matching part of the picture light up, and read what it means.
        </div>
        <div>
          <div className="mb-1 text-[12px] font-semibold text-ink-100">Conventions</div>
          <Tex>{'\\ket{0} = +z'}</Tex>, <Tex>{'\\ket{+} = +x'}</Tex>, <Tex>{'\\ket{+i} = +y'}</Tex>,{' '}
          <Tex>{'R_{\\vec n}(\\theta) = e^{-i\\theta\\,\\vec n\\cdot\\vec\\sigma/2}'}</Tex>, and <Tex>{'\\hbar = 1'}</Tex>.
        </div>
      </div>
    </div>
  );
}

function Legend({ c, children }: { c: string; children: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2 w-2 rounded-full" style={{ background: c }} />
      {children}
    </div>
  );
}
