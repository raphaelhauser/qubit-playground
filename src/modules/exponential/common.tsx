import { ReactNode } from 'react';
import { Tex } from '../../components/Tex';
import { Button, Slider } from '../../components/ui';
import { COLORS } from '../../theme';
import {
  Mat2,
  Vec3,
  Rn,
  c,
  expi,
  mat,
  matScale,
  fromPauli,
  axisFromAngles,
  anglesFromBloch,
  randomUnitVector,
  texAngle,
  texMatrix,
  Rng,
} from '../../quantum';

export { texSci } from '../hamiltonian/widgets';

/** Haar-ish random unitary: random rotation times random global phase. */
export function randomUnitary(rng: Rng = Math.random): Mat2 {
  return matScale(Rn(randomUnitVector(rng), 2 * Math.PI * rng()), expi(2 * Math.PI * rng()));
}

export function randomHermitian(rng: Rng = Math.random, scale = 1.5): Mat2 {
  const u = () => scale * (2 * rng() - 1);
  return fromPauli(c(u()), c(u()), c(u()), c(u()));
}

export function randomComplexMatrix(rng: Rng = Math.random, scale = 1): Mat2 {
  const z = () => c(scale * (2 * rng() - 1), scale * (2 * rng() - 1));
  return mat(z(), z(), z(), z());
}

const AXIS_PRESETS: { id: string; tex: string; n: Vec3 }[] = [
  { id: 'x', tex: '\\hat x', n: [1, 0, 0] },
  { id: 'y', tex: '\\hat y', n: [0, 1, 0] },
  { id: 'z', tex: '\\hat z', n: [0, 0, 1] },
  { id: 'h', tex: '\\tfrac{\\hat x+\\hat z}{\\sqrt2}', n: [Math.SQRT1_2, 0, Math.SQRT1_2] },
];

/** Choose a unit axis n by presets or spherical angles. */
export function AxisControl({ nTheta, nPhi, onChange }: { nTheta: number; nPhi: number; onChange: (theta: number, phi: number) => void }) {
  const n = axisFromAngles(nTheta, nPhi);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[12px] text-ink-400">axis</span>
        {AXIS_PRESETS.map((p) => {
          const on = Math.abs(n[0] - p.n[0]) < 1e-6 && Math.abs(n[1] - p.n[1]) < 1e-6 && Math.abs(n[2] - p.n[2]) < 1e-6;
          return (
            <Button
              key={p.id}
              size="sm"
              active={on}
              onClick={() => {
                const a = anglesFromBloch(p.n);
                onChange(a.theta, a.phi);
              }}
            >
              <Tex>{p.tex}</Tex>
            </Button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Slider tex="\vartheta_n" label="tilt" value={nTheta} min={0} max={Math.PI} onChange={(v) => onChange(v, nPhi)} format={(v) => texAngle(v, { inline: true })} color={COLORS.axis} hl="n" />
        <Slider tex="\phi_n" label="azimuth" value={nPhi} min={0} max={2 * Math.PI} onChange={(v) => onChange(nTheta, v)} format={(v) => texAngle(v, { inline: true })} color={COLORS.axis} hl="n" />
      </div>
    </div>
  );
}

/** A labelled matrix: "label = (…)". */
export function MatBox({ label, M, digits = 3, note, className = '' }: { label: string; M: Mat2; digits?: number; note?: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg bg-ink-800/70 px-2.5 py-1.5 ring-1 ring-inset ring-ink-700 ${className}`}>
      <Tex display>{`${label} = ${texMatrix(M, { digits, exact: true })}`}</Tex>
      {note && <div className="-mt-1 pb-0.5 text-center text-[11px] text-ink-400">{note}</div>}
    </div>
  );
}

/** ✓ / ✗ badge for a numerical identity check. */
export function Check({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <div className={`flex items-center justify-between gap-2 rounded-md px-2.5 py-1 text-[12px] ring-1 ring-inset ${ok ? 'bg-good/[0.07] text-ink-200 ring-good/25' : 'bg-bad/[0.08] text-ink-200 ring-bad/30'}`}>
      <span className="min-w-0">{children}</span>
      <span className={`shrink-0 font-semibold ${ok ? 'text-good' : 'text-bad'}`}>{ok ? '✓' : '✗'}</span>
    </div>
  );
}

export const LOG_TICKS = [
  { value: 1e-15, label: '1e-15' },
  { value: 1e-10, label: '1e-10' },
  { value: 1e-5, label: '1e-5' },
  { value: 1, label: '1' },
  { value: 1e3, label: '1e3' },
];
