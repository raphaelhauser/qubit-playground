import { useMemo } from 'react';
import { Complex, abs, arg } from '../quantum';
import { COLORS } from '../theme';
import { useHighlight } from './Highlight';
import { renderTex } from './Tex';

export interface Amplitude {
  z: Complex;
  color: string;
  /** KaTeX label, e.g. '\\alpha' */
  label: string;
  /** highlight key */
  hl?: string;
}

const R = 1.3; // half-extent of the view box (unit circle radius = 1)

function arcPath(r: number, a0: number, a1: number): string {
  // SVG y axis points down: draw with y → −y
  const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
  const sweep = a1 > a0 ? 0 : 1;
  const x0 = r * Math.cos(a0);
  const y0 = -r * Math.sin(a0);
  const x1 = r * Math.cos(a1);
  const y1 = -r * Math.sin(a1);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} ${sweep} ${x1} ${y1}`;
}

/**
 * Complex plane with the unit circle and one arrow per amplitude. Shows magnitude (length),
 * phase (angle from the real axis) and, optionally, the relative phase between the first two.
 */
export function ComplexPlane({
  amplitudes,
  showRelative = true,
  showComponents = true,
  className = '',
  ghosts = [],
}: {
  amplitudes: Amplitude[];
  showRelative?: boolean;
  showComponents?: boolean;
  className?: string;
  /** faint reference arrows (e.g. amplitudes before a global phase) */
  ghosts?: Amplitude[];
}) {
  const { active } = useHighlight();
  const rel = useMemo(() => {
    if (!showRelative || amplitudes.length < 2) return null;
    const [a, b] = amplitudes;
    if (abs(a.z) < 1e-3 || abs(b.z) < 1e-3) return null;
    const pa = arg(a.z);
    let pb = arg(b.z);
    // draw the arc counter-clockwise from α to β (relative phase in [0, 2π))
    while (pb < pa) pb += 2 * Math.PI;
    while (pb - pa >= 2 * Math.PI) pb -= 2 * Math.PI;
    return { pa, pb };
  }, [amplitudes, showRelative]);

  return (
    <div className={`relative aspect-square w-full ${className}`}>
      <svg viewBox={`${-R} ${-R} ${2 * R} ${2 * R}`} className="h-full w-full overflow-visible">
        <defs>
          {amplitudes.concat(ghosts).map((a, i) => (
            <marker key={i} id={`cp-head-${a.color.slice(1)}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={a.color} />
            </marker>
          ))}
        </defs>
        {/* grid */}
        {[-1, -0.5, 0.5, 1].map((g) => (
          <g key={g}>
            <line x1={g} y1={-R} x2={g} y2={R} stroke={COLORS.grid} strokeWidth={0.006} />
            <line x1={-R} y1={g} x2={R} y2={g} stroke={COLORS.grid} strokeWidth={0.006} />
          </g>
        ))}
        <line x1={-R} y1={0} x2={R} y2={0} stroke={COLORS.gridStrong} strokeWidth={0.008} />
        <line x1={0} y1={-R} x2={0} y2={R} stroke={COLORS.gridStrong} strokeWidth={0.008} />
        <circle cx={0} cy={0} r={1} fill="none" stroke={COLORS.faint} strokeWidth={0.008} strokeDasharray="0.03 0.025" />
        <text x={R - 0.04} y={-0.05} fill={COLORS.faint} fontSize={0.09} textAnchor="end">Re</text>
        <text x={0.05} y={-R + 0.11} fill={COLORS.faint} fontSize={0.09}>Im</text>
        <text x={1.02} y={0.12} fill={COLORS.faint} fontSize={0.075}>1</text>

        {ghosts.map((a, i) => (
          <line key={`g${i}`} x1={0} y1={0} x2={a.z.re} y2={-a.z.im} stroke={a.color} strokeOpacity={0.35} strokeWidth={0.012} strokeDasharray="0.03 0.02" />
        ))}

        {rel && (
          <path
            d={arcPath(0.34, rel.pa, rel.pb)}
            fill="none"
            stroke={COLORS.phase}
            strokeWidth={active === 'phi' ? 0.022 : 0.012}
            strokeOpacity={active === 'phi' ? 1 : 0.8}
          />
        )}

        {amplitudes.map((a, i) => {
          const hot = active !== null && (active === a.hl || active === 'gamma');
          const m = abs(a.z);
          const ph = arg(a.z);
          return (
            <g key={i}>
              {showComponents && (hot || active === 're' || active === 'im') && (
                <>
                  <line x1={a.z.re} y1={-a.z.im} x2={a.z.re} y2={0} stroke={a.color} strokeOpacity={0.6} strokeWidth={0.008} strokeDasharray="0.02 0.02" />
                  <line x1={a.z.re} y1={-a.z.im} x2={0} y2={-a.z.im} stroke={a.color} strokeOpacity={0.6} strokeWidth={0.008} strokeDasharray="0.02 0.02" />
                </>
              )}
              {m > 0.02 && !rel && (
                <path d={arcPath(0.16 + 0.07 * i, 0, ph)} fill="none" stroke={a.color} strokeOpacity={0.5} strokeWidth={0.01} />
              )}
              {m > 1e-3 && (
                <line
                  x1={0}
                  y1={0}
                  x2={a.z.re * (1 - 0.04 / Math.max(m, 0.04))}
                  y2={-a.z.im * (1 - 0.04 / Math.max(m, 0.04))}
                  stroke={a.color}
                  strokeWidth={hot ? 0.034 : 0.022}
                  strokeLinecap="round"
                  markerEnd={`url(#cp-head-${a.color.slice(1)})`}
                />
              )}
              <circle cx={a.z.re} cy={-a.z.im} r={hot ? 0.035 : 0.022} fill={a.color} />
            </g>
          );
        })}
      </svg>
      {/* KaTeX labels as HTML overlay */}
      {amplitudes.map((a, i) => {
        const m = abs(a.z);
        const ph = arg(a.z);
        const lr = m + 0.17;
        const x = (lr * Math.cos(ph) + R) / (2 * R);
        const y = (-lr * Math.sin(ph) + R) / (2 * R);
        return (
          <div
            key={i}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-[13px]"
            style={{ left: `${x * 100}%`, top: `${y * 100}%`, color: a.color }}
            dangerouslySetInnerHTML={{ __html: renderTex(a.label, false) }}
          />
        );
      })}
      {rel && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-[11.5px]"
          style={{
            left: `${((0.5 * Math.cos((rel.pa + rel.pb) / 2) + R) / (2 * R)) * 100}%`,
            top: `${((-0.5 * Math.sin((rel.pa + rel.pb) / 2) + R) / (2 * R)) * 100}%`,
            color: COLORS.phase,
          }}
          dangerouslySetInnerHTML={{ __html: renderTex('\\varphi', false) }}
        />
      )}
    </div>
  );
}
