import { ReactNode } from 'react';
import { useHighlight, useHoverKey } from '../../components/Highlight';
import { Tex } from '../../components/Tex';
import { COLORS } from '../../theme';
import { HamiltonianParams, hamiltonianAxis, PauliCoeffs, fmt } from '../../quantum';

/** Scientific notation for tiny numerical residuals, as KaTeX. */
export function texSci(x: number, digits = 1): string {
  if (!Number.isFinite(x)) return '\\infty';
  if (x === 0) return '0';
  const e = Math.floor(Math.log10(Math.abs(x)));
  if (e >= -2 && e <= 2) return x.toFixed(3);
  const m = x / 10 ** e;
  return `${m.toFixed(digits)}\\times 10^{${e}}`;
}

/** Wrapper that lights up when its highlight key is active (e.g. the slider that drives a symbol). */
export function HlRing({ hl, children, className = '' }: { hl: string | string[]; children: ReactNode; className?: string }) {
  const { active } = useHighlight();
  const keys = Array.isArray(hl) ? hl : [hl];
  const on = active !== null && keys.includes(active);
  return (
    <div className={`-mx-2 rounded-lg px-2 py-0.5 transition-colors ${on ? 'bg-state/[0.08] ring-1 ring-inset ring-state/40' : ''} ${className}`}>
      {children}
    </div>
  );
}

/**
 * Pauli coefficients of a Hamiltonian as diverging bars. The identity bar is drawn in the phase
 * colour (it only produces a global phase); X, Y, Z in the axis colour (they rotate the Bloch vector).
 */
export function PauliBars({ coeffs, max = 2.5 }: { coeffs: PauliCoeffs; max?: number }) {
  const hover = useHoverKey();
  const { active } = useHighlight();
  const rows: { name: string; tex: string; val: number; color: string; hl?: string }[] = [
    { name: 'I', tex: 'I', val: coeffs[0].re, color: COLORS.phase, hl: 'omegabar' },
    { name: 'X', tex: 'X', val: coeffs[1].re, color: COLORS.axis, hl: 'epsilon' },
    { name: 'Y', tex: 'Y', val: coeffs[2].re, color: COLORS.axis },
    { name: 'Z', tex: 'Z', val: coeffs[3].re, color: COLORS.axis, hl: 'deltaomega' },
  ];
  return (
    <div className="space-y-1">
      {rows.map((r) => {
        const f = Math.max(-1, Math.min(1, r.val / max));
        const hot = r.hl && active === r.hl;
        return (
          <div key={r.name} className="grid grid-cols-[22px_1fr_52px] items-center gap-2" {...(r.hl ? hover(r.hl) : {})}>
            <span className="text-[13px] text-ink-200">
              <Tex>{r.tex}</Tex>
            </span>
            <div className={`relative h-[12px] rounded-[3px] bg-ink-750 ring-1 ring-inset ${hot ? 'ring-ink-400' : 'ring-ink-700'}`}>
              <div className="absolute inset-y-[-2px] left-1/2 w-px bg-ink-500" />
              <div
                className="absolute inset-y-0 rounded-[3px] transition-all duration-150"
                style={{
                  left: f >= 0 ? '50%' : `${50 + 50 * f}%`,
                  width: `${50 * Math.abs(f)}%`,
                  background: r.color,
                  opacity: 0.85,
                }}
              />
            </div>
            <span className="text-right font-mono text-[12px] tabular-nums text-ink-100">{fmt(r.val, 2)}</span>
          </div>
        );
      })}
      <div className="flex justify-between pt-1 text-[11px] text-ink-400">
        <span>
          <span style={{ color: COLORS.phase }}>■</span> identity → global phase only
        </span>
        <span>
          <span style={{ color: COLORS.axis }}>■</span> Pauli part → rotation
        </span>
      </div>
    </div>
  );
}

/**
 * Energy levels: the unperturbed diagonal entries ω₁, ω₂ (left) and the eigenvalues
 * E± = ω̄ ± r of the full Hamiltonian (right). The coupling ε pushes the levels apart.
 */
export function EnergyDiagram({ p }: { p: HamiltonianParams }) {
  const { r } = hamiltonianAxis(p);
  const { active } = useHighlight();
  const w1 = p.omegaBar + p.deltaOmega;
  const w2 = p.omegaBar - p.deltaOmega;
  const Ep = p.omegaBar + r;
  const Em = p.omegaBar - r;
  const lo = Math.min(Em, w1, w2);
  const hi = Math.max(Ep, w1, w2);
  const span = Math.max(hi - lo, 1.2);
  const mid = (hi + lo) / 2;
  const H = 150;
  const y = (E: number) => 86 - ((E - mid) / span) * 88;
  const wHi = Math.max(w1, w2);
  const wLo = Math.min(w1, w2);
  const degenerate = r < 1e-9;
  const hotR = active === 'r';
  const hotW = active === 'omegabar';
  return (
    <svg viewBox={`0 0 320 ${H}`} className="w-full">
      <text x={70} y={12} fill={COLORS.faint} fontSize={10} textAnchor="middle">
        diagonal part (ε = 0)
      </text>
      <text x={215} y={12} fill={COLORS.faint} fontSize={10} textAnchor="middle">
        eigenvalues of H
      </text>
      {/* mean energy */}
      <line x1={112} x2={176} y1={y(p.omegaBar)} y2={y(p.omegaBar)} stroke={COLORS.phase} strokeOpacity={hotW ? 0.9 : 0.45} strokeDasharray="3 4" />
      <text x={144} y={y(p.omegaBar) - 4} fill={COLORS.phase} fontSize={10} textAnchor="middle" fillOpacity={hotW ? 1 : 0.8}>
        ω̄ = {fmt(p.omegaBar, 2)}
      </text>
      {/* unperturbed */}
      <line x1={35} x2={105} y1={y(w1)} y2={y(w1)} stroke={COLORS.muted} strokeWidth={2} />
      <line x1={35} x2={105} y1={y(w2)} y2={y(w2)} stroke={COLORS.muted} strokeWidth={2} />
      {Math.abs(y(w1) - y(w2)) < 12 ? (
        <text x={30} y={y(w1) + 3.5} fill={COLORS.muted} fontSize={10} textAnchor="end">
          ω₁=ω₂
        </text>
      ) : (
        <>
          <text x={30} y={y(w1) + 3.5} fill={COLORS.muted} fontSize={10} textAnchor="end">
            ω₁
          </text>
          <text x={30} y={y(w2) + 3.5} fill={COLORS.muted} fontSize={10} textAnchor="end">
            ω₂
          </text>
        </>
      )}
      {/* connectors */}
      <line x1={105} x2={180} y1={y(wHi)} y2={y(Ep)} stroke={COLORS.faint} strokeDasharray="2 3" />
      <line x1={105} x2={180} y1={y(wLo)} y2={y(Em)} stroke={COLORS.faint} strokeDasharray="2 3" />
      {/* perturbed */}
      <line x1={180} x2={250} y1={y(Ep)} y2={y(Ep)} stroke={COLORS.axis} strokeWidth={2.2} />
      <line x1={180} x2={250} y1={y(Em)} y2={y(Em)} stroke={COLORS.axis} strokeWidth={2.2} />
      <text x={215} y={y(Ep) - 5} fill={COLORS.text} fontSize={10} textAnchor="middle">
        E₊ = {fmt(Ep, 2)}
      </text>
      <text x={215} y={y(Em) + 13} fill={COLORS.text} fontSize={10} textAnchor="middle">
        E₋ = {fmt(Em, 2)}
      </text>
      {/* gap 2r */}
      {!degenerate && (
        <g>
          <line x1={272} x2={272} y1={y(Ep)} y2={y(Em)} stroke={COLORS.axis} strokeWidth={hotR ? 2 : 1} />
          <line x1={268} x2={276} y1={y(Ep)} y2={y(Ep)} stroke={COLORS.axis} />
          <line x1={268} x2={276} y1={y(Em)} y2={y(Em)} stroke={COLORS.axis} />
          <text x={281} y={(y(Ep) + y(Em)) / 2 + 3.5} fill={COLORS.axis} fontSize={10.5}>
            2r
          </text>
        </g>
      )}
      {degenerate && (
        <text x={215} y={y(Ep) + 26} fill={COLORS.p1} fontSize={10} textAnchor="middle">
          degenerate: E₊ = E₋ = ω̄
        </text>
      )}
    </svg>
  );
}
