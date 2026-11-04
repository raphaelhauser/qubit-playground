import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { COLORS } from '../theme';
import { Tex } from './Tex';
import { useHighlight, useHoverKey } from './Highlight';

// ---------------------------------------------------------------------------
// Probability bars
// ---------------------------------------------------------------------------

export interface ProbItem {
  /** KaTeX label */
  label: string;
  p: number;
  color: string;
  hl?: string;
  /** optional secondary value shown faintly (e.g. a simulated frequency) */
  compare?: number;
}

export function ProbabilityBars({ items, digits = 3 }: { items: ProbItem[]; digits?: number }) {
  const { active } = useHighlight();
  const hover = useHoverKey();
  return (
    <div className="space-y-1.5">
      {items.map((it, i) => {
        const hot = active !== null && active === it.hl;
        const p = Math.max(0, Math.min(1, it.p));
        return (
          <div key={i} className="grid grid-cols-[minmax(52px,auto)_1fr_52px] items-center gap-2.5" {...(it.hl ? hover(it.hl) : {})}>
            <div className="text-[13px] text-ink-200">
              <Tex>{it.label}</Tex>
            </div>
            <div className={`relative h-[14px] overflow-hidden rounded-[4px] bg-ink-750 ring-1 ring-inset ${hot ? 'ring-ink-400' : 'ring-ink-700'}`}>
              <div className="absolute inset-y-0 left-0 rounded-[3px] transition-[width] duration-150 ease-out" style={{ width: `${p * 100}%`, background: it.color, opacity: 0.85 }} />
              {it.compare !== undefined && (
                <div className="absolute inset-y-0 w-[2px] bg-ink-100" style={{ left: `calc(${Math.max(0, Math.min(1, it.compare)) * 100}% - 1px)` }} title="simulated" />
              )}
            </div>
            <div className="text-right font-mono text-[12px] tabular-nums text-ink-100">{p.toFixed(digits)}</div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Responsive width hook
// ---------------------------------------------------------------------------

export function useElementWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    setW(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

// ---------------------------------------------------------------------------
// Time-series / function plot
// ---------------------------------------------------------------------------

export interface Series {
  points: [number, number][];
  color: string;
  width?: number;
  dashed?: boolean;
  /** KaTeX label for the legend */
  label?: string;
  opacity?: number;
  hl?: string;
}

export interface HLine {
  y: number;
  color: string;
  label?: string;
}

export function LinePlot({
  series,
  xMin,
  xMax,
  yMin = 0,
  yMax = 1,
  height = 180,
  cursorX,
  onScrub,
  xLabel,
  yTicks,
  xTicks,
  hlines = [],
  logY = false,
  legend = true,
  children,
}: {
  series: Series[];
  xMin: number;
  xMax: number;
  yMin?: number;
  yMax?: number;
  height?: number;
  cursorX?: number;
  onScrub?: (x: number) => void;
  xLabel?: string;
  yTicks?: { value: number; label: string }[];
  xTicks?: { value: number; label: string }[];
  hlines?: HLine[];
  logY?: boolean;
  legend?: boolean;
  children?: ReactNode;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const { active } = useHighlight();
  const pad = { l: 34, r: 10, t: 8, b: xLabel ? 30 : 20 };
  const W = Math.max(50, width);
  const iw = W - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const ty = (y: number) => {
    if (logY) {
      const ly = Math.log10(Math.max(y, 10 ** yMin));
      return pad.t + ih * (1 - (ly - yMin) / (yMax - yMin));
    }
    return pad.t + ih * (1 - (y - yMin) / (yMax - yMin));
  };
  const tx = (x: number) => pad.l + (iw * (x - xMin)) / (xMax - xMin);
  const scrubbing = useRef(false);
  const toX = useCallback(
    (clientX: number, el: SVGSVGElement) => {
      const r = el.getBoundingClientRect();
      const f = (clientX - r.left - pad.l) / iw;
      return xMin + Math.max(0, Math.min(1, f)) * (xMax - xMin);
    },
    [iw, xMin, xMax, pad.l],
  );
  const yt = yTicks ?? (logY ? [] : [0, 0.5, 1].map((v) => ({ value: yMin + v * (yMax - yMin), label: (yMin + v * (yMax - yMin)).toFixed(1) })));
  return (
    <div ref={ref} className="relative w-full select-none">
      {width > 0 && (
        <svg
          width={W}
          height={height}
          className={onScrub ? 'cursor-ew-resize' : ''}
          onPointerDown={(e) => {
            if (!onScrub) return;
            scrubbing.current = true;
            (e.currentTarget as Element).setPointerCapture(e.pointerId);
            onScrub(toX(e.clientX, e.currentTarget));
          }}
          onPointerMove={(e) => scrubbing.current && onScrub?.(toX(e.clientX, e.currentTarget))}
          onPointerUp={() => (scrubbing.current = false)}
        >
          {yt.map((t) => (
            <g key={t.value}>
              <line x1={pad.l} x2={W - pad.r} y1={ty(t.value)} y2={ty(t.value)} stroke={COLORS.grid} />
              <text x={pad.l - 6} y={ty(t.value) + 3.5} fill={COLORS.faint} fontSize={10} textAnchor="end" fontFamily="JetBrains Mono">
                {t.label}
              </text>
            </g>
          ))}
          {(xTicks ?? []).map((t) => (
            <g key={t.value}>
              <line x1={tx(t.value)} x2={tx(t.value)} y1={pad.t} y2={pad.t + ih} stroke={COLORS.grid} strokeDasharray="2 3" />
              <text x={tx(t.value)} y={pad.t + ih + 13} fill={COLORS.faint} fontSize={10} textAnchor="middle" fontFamily="JetBrains Mono">
                {t.label}
              </text>
            </g>
          ))}
          <line x1={pad.l} x2={pad.l} y1={pad.t} y2={pad.t + ih} stroke={COLORS.gridStrong} />
          <line x1={pad.l} x2={W - pad.r} y1={pad.t + ih} y2={pad.t + ih} stroke={COLORS.gridStrong} />
          {hlines.map((h, i) => (
            <g key={i}>
              <line x1={pad.l} x2={W - pad.r} y1={ty(h.y)} y2={ty(h.y)} stroke={h.color} strokeDasharray="4 4" strokeOpacity={0.7} />
              {h.label && (
                <text x={W - pad.r - 4} y={ty(h.y) - 4} fill={h.color} fontSize={10} textAnchor="end">
                  {h.label}
                </text>
              )}
            </g>
          ))}
          {series.map((s, i) => {
            if (s.points.length < 2) return null;
            const d = s.points.map((p, k) => `${k === 0 ? 'M' : 'L'}${tx(p[0]).toFixed(2)},${ty(p[1]).toFixed(2)}`).join(' ');
            const hot = s.hl && active === s.hl;
            return (
              <path
                key={i}
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth={(s.width ?? 1.8) * (hot ? 1.6 : 1)}
                strokeDasharray={s.dashed ? '5 4' : undefined}
                strokeOpacity={s.opacity ?? 1}
                strokeLinejoin="round"
              />
            );
          })}
          {cursorX !== undefined && cursorX >= xMin && cursorX <= xMax && (
            <g>
              <line x1={tx(cursorX)} x2={tx(cursorX)} y1={pad.t} y2={pad.t + ih} stroke={COLORS.text} strokeOpacity={0.5} />
              {series
                .filter((s) => !s.dashed)
                .map((s, i) => {
                  const pt = nearest(s.points, cursorX);
                  return pt ? <circle key={i} cx={tx(pt[0])} cy={ty(pt[1])} r={3.5} fill={s.color} stroke={COLORS.bg} strokeWidth={1.5} /> : null;
                })}
            </g>
          )}
          {xLabel && (
            <text x={pad.l + iw / 2} y={height - 4} fill={COLORS.faint} fontSize={10.5} textAnchor="middle">
              {xLabel}
            </text>
          )}
        </svg>
      )}
      {legend && series.some((s) => s.label) && (
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 pl-8">
          {series
            .filter((s) => s.label)
            .map((s, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 text-[12px] text-ink-300">
                <svg width="18" height="6">
                  <line x1="0" y1="3" x2="18" y2="3" stroke={s.color} strokeWidth="2" strokeDasharray={s.dashed ? '4 3' : undefined} />
                </svg>
                <Tex>{s.label!}</Tex>
              </span>
            ))}
        </div>
      )}
      {children}
    </div>
  );
}

function nearest(points: [number, number][], x: number): [number, number] | null {
  if (points.length === 0) return null;
  // points are sorted by x
  let lo = 0;
  let hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid][0] < x) lo = mid;
    else hi = mid;
  }
  return Math.abs(points[lo][0] - x) < Math.abs(points[hi][0] - x) ? points[lo] : points[hi];
}

// ---------------------------------------------------------------------------
// Histogram (simulated counts vs. theory)
// ---------------------------------------------------------------------------

export function Histogram({
  bins,
  height = 140,
}: {
  bins: { label: string; count: number; expected: number; color: string }[];
  height?: number;
}) {
  const total = bins.reduce((s, b) => s + b.count, 0);
  const maxF = Math.max(0.0001, ...bins.map((b) => (total ? b.count / total : 0)), ...bins.map((b) => b.expected));
  const H = (f: number) => `${(f / maxF) * 92}%`;
  return (
    <div>
      <div className="flex gap-4 px-2">
        {bins.map((b, i) => {
          const f = total ? b.count / total : 0;
          return (
            <div key={i} className="flex flex-1 flex-col items-center">
              {/* bar area: bar and theory line share one coordinate system */}
              <div className="relative w-full max-w-[88px]" style={{ height }}>
                <div className="absolute inset-x-2 bottom-0 rounded-t-[4px] transition-[height] duration-150" style={{ height: H(f), background: b.color, opacity: 0.85 }} />
                {b.expected > 0 && (
                  <div className="absolute inset-x-0 border-t-2 border-dashed border-ink-100/70" style={{ bottom: H(b.expected) }} title={`theory ${(100 * b.expected).toFixed(1)}%`} />
                )}
              </div>
              <div className="mt-1.5 flex items-baseline gap-1.5 text-[12.5px] text-ink-300">
                <Tex>{b.label}</Tex>
                <span className="font-mono text-[11px] tabular-nums text-ink-100">{total ? (100 * f).toFixed(1) + '%' : '—'}</span>
              </div>
              <div className="font-mono text-[10.5px] tabular-nums text-ink-500">theory {(100 * b.expected).toFixed(1)}%</div>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex items-center justify-between px-1 text-[11px] text-ink-400">
        <span>
          N = <span className="font-mono text-ink-200">{total}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-4 border-t-2 border-dashed border-ink-100/70" /> Born-rule prediction
        </span>
      </div>
    </div>
  );
}
