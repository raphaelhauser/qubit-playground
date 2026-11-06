import { useId, useMemo } from 'react';
import { Complex, abs, arg } from '../quantum';
import { COLORS, phaseColor } from '../theme';
import { useHighlight } from './Highlight';
import { renderTex } from './Tex';

export interface Amplitude {
  z: Complex;
  /** used only when colorBy = 'given' (by default an amplitude is coloured by its phase) */
  color: string;
  /** KaTeX label, e.g. '\\alpha' */
  label: string;
  /** highlight key */
  hl?: string;
}

const R = 1.32; // half-extent of the view box (unit circle radius = 1)
const TAU = 2 * Math.PI;

function arcPath(r: number, a0: number, a1: number): string {
  // SVG y axis points down: draw with y → −y
  const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
  const sweep = a1 > a0 ? 0 : 1;
  return `M ${r * Math.cos(a0)} ${-r * Math.sin(a0)} A ${r} ${r} 0 ${large} ${sweep} ${r * Math.cos(a1)} ${-r * Math.sin(a1)}`;
}

/** The unit circle drawn as a phase wheel: the colour at angle φ is the colour of phase φ. */
function PhaseRim({ width = 0.032 }: { width?: number }) {
  const segs = useMemo(() => {
    const n = 90;
    return Array.from({ length: n }, (_, k) => {
      const a0 = (TAU * k) / n;
      const a1 = (TAU * (k + 1.06)) / n;
      return { d: arcPath(1, a0, a1), c: phaseColor((a0 + a1) / 2) };
    });
  }, []);
  return (
    <g>
      {segs.map((s, i) => (
        <path key={i} d={s.d} fill="none" stroke={s.c} strokeWidth={width} />
      ))}
    </g>
  );
}

/**
 * Complex plane: magnitude is length, phase is both the angle and the hue. Optionally shows the
 * relative phase between the first two amplitudes as an arc in the hue of that phase difference.
 */
export function ComplexPlane({
  amplitudes,
  showRelative = true,
  showComponents = true,
  className = '',
  ghosts = [],
  colorBy = 'phase',
}: {
  amplitudes: Amplitude[];
  showRelative?: boolean;
  showComponents?: boolean;
  className?: string;
  /** faint reference arrows (e.g. amplitudes before a global phase) */
  ghosts?: Amplitude[];
  colorBy?: 'phase' | 'given';
}) {
  const uid = useId().replace(/:/g, '');
  const { active } = useHighlight();
  const colorOf = (a: Amplitude) => (colorBy === 'given' ? a.color : abs(a.z) < 1e-6 ? COLORS.faint : phaseColor(arg(a.z)));
  const rel = useMemo(() => {
    if (!showRelative || amplitudes.length < 2) return null;
    const [a, b] = amplitudes;
    if (abs(a.z) < 1e-3 || abs(b.z) < 1e-3) return null;
    const pa = arg(a.z);
    let pb = arg(b.z);
    while (pb < pa) pb += TAU;
    while (pb - pa >= TAU) pb -= TAU;
    return { pa, pb, d: pb - pa };
  }, [amplitudes, showRelative]);

  return (
    <div className={`relative aspect-square w-full ${className}`}>
      <svg viewBox={`${-R} ${-R} ${2 * R} ${2 * R}`} className="h-full w-full overflow-visible">
        <defs>
          {amplitudes.concat(ghosts).map((a, i) => (
            <marker key={i} id={`cp-${uid}-${i}`} viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="4.6" markerHeight="4.6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={colorOf(a)} />
            </marker>
          ))}
        </defs>
        {/* drafting grid */}
        {[-1, -0.5, 0.5, 1].map((g) => (
          <g key={g}>
            <line x1={g} y1={-R} x2={g} y2={R} stroke={COLORS.grid} strokeWidth={0.005} strokeDasharray="0.012 0.03" />
            <line x1={-R} y1={g} x2={R} y2={g} stroke={COLORS.grid} strokeWidth={0.005} strokeDasharray="0.012 0.03" />
          </g>
        ))}
        <line x1={-R} y1={0} x2={R} y2={0} stroke={COLORS.gridStrong} strokeWidth={0.006} />
        <line x1={0} y1={-R} x2={0} y2={R} stroke={COLORS.gridStrong} strokeWidth={0.006} />
        <PhaseRim />
        {[
          [1.13, 0.0, '1'],
          [0, -1.13, 'i'],
          [-1.13, 0, '−1'],
          [0, 1.15, '−i'],
        ].map(([x, y, t]) => (
          <text key={t as string} x={x as number} y={(y as number) + 0.03} fill={COLORS.faint} fontSize={0.085} textAnchor="middle" fontFamily="IBM Plex Mono, monospace">
            {t}
          </text>
        ))}

        {ghosts.map((a, i) => (
          <line key={`g${i}`} x1={0} y1={0} x2={a.z.re} y2={-a.z.im} stroke={colorOf(a)} strokeOpacity={0.45} strokeWidth={0.012} strokeDasharray="0.03 0.025" />
        ))}

        {rel && rel.d > 1e-3 && (
          <path
            d={arcPath(0.3, rel.pa, rel.pb)}
            fill="none"
            stroke={phaseColor(rel.d)}
            strokeWidth={active === 'phi' ? 0.026 : 0.016}
            strokeLinecap="round"
          />
        )}

        {amplitudes.map((a, i) => {
          const hot = active !== null && (active === a.hl || active === 'gamma');
          const m = abs(a.z);
          const ph = arg(a.z);
          const col = colorOf(a);
          return (
            <g key={i}>
              {showComponents && (hot || active === 're' || active === 'im') && (
                <>
                  <line x1={a.z.re} y1={-a.z.im} x2={a.z.re} y2={0} stroke={col} strokeOpacity={0.7} strokeWidth={0.007} strokeDasharray="0.02 0.02" />
                  <line x1={a.z.re} y1={-a.z.im} x2={0} y2={-a.z.im} stroke={col} strokeOpacity={0.7} strokeWidth={0.007} strokeDasharray="0.02 0.02" />
                </>
              )}
              {m > 0.02 && !rel && Math.abs(ph) > 1e-3 && (
                <path d={arcPath(0.15 + 0.07 * i, 0, ph < 0 ? ph + TAU : ph)} fill="none" stroke={col} strokeOpacity={0.75} strokeWidth={0.012} />
              )}
              {m > 1e-3 && (
                <line
                  x1={0}
                  y1={0}
                  x2={a.z.re * (1 - 0.035 / Math.max(m, 0.035))}
                  y2={-a.z.im * (1 - 0.035 / Math.max(m, 0.035))}
                  stroke={col}
                  strokeWidth={hot ? 0.03 : 0.02}
                  strokeLinecap="round"
                  markerEnd={`url(#cp-${uid}-${i})`}
                />
              )}
              <circle cx={0} cy={0} r={0.018} fill={COLORS.text} />
              {m <= 1e-3 && <circle cx={0} cy={0} r={0.035} fill="none" stroke={COLORS.faint} strokeWidth={0.01} />}
            </g>
          );
        })}
      </svg>
      {amplitudes.map((a, i) => {
        const m = abs(a.z);
        const ph = arg(a.z);
        const lr = m + 0.17;
        const x = (lr * Math.cos(ph) + R) / (2 * R);
        const y = (-lr * Math.sin(ph) + R) / (2 * R);
        return (
          <div
            key={i}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-[13.5px]"
            style={{ left: `${x * 100}%`, top: `${y * 100}%`, color: colorOf(a), textShadow: `0 0 4px ${COLORS.bg}, 0 0 2px ${COLORS.bg}` }}
            dangerouslySetInnerHTML={{ __html: renderTex(a.label, false) }}
          />
        );
      })}
      {rel && rel.d > 1e-3 && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-[12px]"
          style={{
            left: `${((0.47 * Math.cos((rel.pa + rel.pb) / 2) + R) / (2 * R)) * 100}%`,
            top: `${((-0.47 * Math.sin((rel.pa + rel.pb) / 2) + R) / (2 * R)) * 100}%`,
            color: phaseColor(rel.d),
          }}
          dangerouslySetInnerHTML={{ __html: renderTex('\\varphi', false) }}
        />
      )}
    </div>
  );
}
