import { useEffect, useRef } from 'react';
import { COLORS } from '../../theme';
import type { ChainPrediction } from '../../quantum';
import { SGEngine, Layout, StageCfg, SourceCfg, Stats, VW, VH, CY, OVEN, SCREEN, BOX, outcomeLabels, axisName } from './sim';

const UNMEASURED = '#cfd6e4';

function pathD(pts: [number, number][]): string {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
}

const pctText = (p: number) => (Number.isFinite(p) ? `${(100 * p).toFixed(p > 0.999 || p < 0.001 ? 0 : 1)}%` : '—');

/**
 * The beam line: an SVG schematic (beams below, magnets/stoppers/labels above) with a canvas in
 * between on which the atoms are drawn. The engine advances on every animation frame.
 */
export function BeamLine({
  engine,
  layout,
  stages,
  source,
  theory,
  stats,
  selected,
  onSelect,
  onToggleBeam,
  onStats,
  showClassical,
  drawKey,
}: {
  engine: SGEngine;
  layout: Layout;
  stages: StageCfg[];
  source: SourceCfg;
  theory: ChainPrediction;
  stats: Stats;
  selected: number;
  onSelect: (k: number) => void;
  onToggleBeam: (k: number, sign: 1 | -1) => void;
  onStats: (s: Stats) => void;
  showClassical: boolean;
  /** bump to force a redraw of the canvas (after reset / instant runs) */
  drawKey: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const forceDraw = useRef(true);
  const statsCb = useRef(onStats);
  statsCb.current = onStats;

  useEffect(() => {
    forceDraw.current = true;
  }, [drawKey, layout]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => (forceDraw.current = true));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastPublish = 0;
    let wasActive = false;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const active = engine.particles.length > 0 || engine.queue > 0 || engine.streaming;
      if (active) engine.step(dt);
      if (active || wasActive || forceDraw.current) {
        draw();
        forceDraw.current = false;
      }
      if ((active || wasActive) && now - lastPublish > 110) {
        lastPublish = now;
        statsCb.current(engine.snapshot());
      }
      wasActive = active;
      raf = requestAnimationFrame(loop);
    };
    const draw = () => {
      const cv = canvasRef.current;
      if (!cv) return;
      const ctx = cv.getContext('2d');
      if (!ctx) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = cv.clientWidth;
      const H = cv.clientHeight;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
        cv.width = Math.round(W * dpr);
        cv.height = Math.round(H * dpr);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      const sc = Math.min(W / VW, H / VH);
      const ox = (W - VW * sc) / 2;
      const oy = (H - VH * sc) / 2;
      ctx.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * ox, dpr * oy);
      // detector spots
      for (const plus of [true, false]) {
        ctx.beginPath();
        for (const s of engine.spots) {
          if (s.plus !== plus) continue;
          ctx.moveTo(s.x + 1.7, s.y);
          ctx.arc(s.x, s.y, 1.7, 0, 2 * Math.PI);
        }
        ctx.fillStyle = plus ? COLORS.p0 : COLORS.p1;
        ctx.globalAlpha = 0.5;
        ctx.fill();
      }
      // atoms: soft halo + core, batched per colour
      const pos = engine.positions();
      const groups: [0 | 1 | -1, string][] = [
        [0, UNMEASURED],
        [1, COLORS.p0],
        [-1, COLORS.p1],
      ];
      for (const [g, col] of groups) {
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.18;
        ctx.beginPath();
        for (const p of pos) {
          if (p.last !== g) continue;
          ctx.moveTo(p.x + 5.5, p.y);
          ctx.arc(p.x, p.y, 5.5, 0, 2 * Math.PI);
        }
        ctx.fill();
        ctx.globalAlpha = 0.95;
        ctx.beginPath();
        for (const p of pos) {
          if (p.last !== g) continue;
          ctx.moveTo(p.x + 2.6, p.y);
          ctx.arc(p.x, p.y, 2.6, 0, 2 * Math.PI);
        }
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  const n = stages.length;
  const beamOpacity = (f: number) => 0.12 + 0.88 * Math.sqrt(Math.max(0, Math.min(1, f)));
  const lastK = n - 1;
  const emitted = Math.max(1, stats.emitted);

  return (
    <div ref={wrapRef} className="absolute inset-0">
      {/* beams */}
      <svg viewBox={`0 0 ${VW} ${VH}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="sg-classical" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={COLORS.muted} stopOpacity="0.05" />
            <stop offset="0.5" stopColor={COLORS.muted} stopOpacity="0.35" />
            <stop offset="1" stopColor={COLORS.muted} stopOpacity="0.05" />
          </linearGradient>
        </defs>
        {/* incoming beam from the oven */}
        <path d={pathD(layout.inPath.pts)} stroke={UNMEASURED} strokeOpacity={0.12} strokeWidth={9} fill="none" strokeLinecap="round" />
        <path d={pathD(layout.inPath.pts)} stroke={UNMEASURED} strokeOpacity={0.5} strokeWidth={1.4} fill="none" />
        {layout.out.map((pair, k) =>
          pair.map((o, j) => {
            const frac = j === 0 ? theory.outPlus[k] : theory.outMinus[k];
            const col = j === 0 ? COLORS.p0 : COLORS.p1;
            const op = beamOpacity(frac);
            return (
              <g key={`${k}-${j}`}>
                <path d={pathD(o.path.pts)} stroke={col} strokeOpacity={0.1 * op} strokeWidth={9} fill="none" strokeLinecap="round" />
                <path d={pathD(o.path.pts)} stroke={col} strokeOpacity={0.65 * op} strokeWidth={1.5} fill="none" />
              </g>
            );
          }),
        )}
        {/* screen */}
        <rect x={SCREEN.x} y={SCREEN.y0} width={SCREEN.w} height={SCREEN.y1 - SCREEN.y0} rx={2} fill="#151922" stroke={COLORS.gridStrong} />
        {showClassical && (
          <g>
            <rect x={SCREEN.x - 3} y={layout.hitY.plus - 12} width={SCREEN.w + 6} height={layout.hitY.minus - layout.hitY.plus + 24} fill="url(#sg-classical)" rx={3} />
            <text x={SCREEN.x - 8} y={CY + 4} fill={COLORS.muted} fontSize={13} textAnchor="end">
              classical: smear
            </text>
          </g>
        )}
      </svg>

      {/* atoms */}
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />

      {/* hardware + labels */}
      <svg viewBox={`0 0 ${VW} ${VH}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet">
        {/* oven */}
        <g>
          <rect x={OVEN.x} y={OVEN.y} width={OVEN.w} height={OVEN.h} rx={8} fill="#1a1f2a" stroke={COLORS.gridStrong} strokeWidth={1.2} />
          <text x={OVEN.x + OVEN.w / 2} y={CY - 4} fill={COLORS.text} fontSize={16} textAnchor="middle" fontWeight={600}>
            {source.kind === 'unpolarized' ? 'oven' : 'source'}
          </text>
          <text x={OVEN.x + OVEN.w / 2} y={CY + 16} fill={COLORS.muted} fontSize={13.5} textAnchor="middle" fontFamily="KaTeX_Math, serif" fontStyle="italic">
            {source.kind === 'unpolarized' ? 'ρ = I/2' : '|ψ⟩'}
          </text>
        </g>
        {/* magnets */}
        {layout.boxes.map((b, k) => {
          const st = stages[k];
          const nm = axisName(st);
          const sel = k === selected;
          return (
            <g key={k} className="cursor-pointer" onClick={() => onSelect(k)}>
              <text x={b.xc} y={b.y0 - 10} fill={sel ? COLORS.text : COLORS.muted} fontSize={12} textAnchor="middle" letterSpacing={1.2}>
                MAGNET {k + 1}
              </text>
              <rect
                x={b.x0}
                y={b.y0}
                width={BOX.w}
                height={BOX.h}
                rx={9}
                fill={sel ? '#1d2230' : '#171b25'}
                stroke={sel ? COLORS.axis : COLORS.gridStrong}
                strokeWidth={sel ? 2 : 1.2}
              />
              {/* pole pieces hint */}
              <path d={`M ${b.x0 + 12} ${b.y0 + 12} h ${BOX.w - 24} l -8 12 h ${-(BOX.w - 40)} z`} fill={COLORS.axis} fillOpacity={0.16} />
              <rect x={b.x0 + 14} y={b.y1 - 20} width={BOX.w - 28} height={8} rx={2} fill={COLORS.axis} fillOpacity={0.16} />
              <text x={b.xc} y={CY + 12} fill={COLORS.text} fontSize={34} textAnchor="middle" fontFamily="KaTeX_Math, serif" fontStyle="italic">
                {nm.main}
              </text>
              {nm.sub && (
                <text x={b.xc} y={b.y1 + 18} fill={COLORS.axis} fontSize={12.5} textAnchor="middle">
                  {nm.sub}
                </text>
              )}
            </g>
          );
        })}
        {/* beam labels, stoppers */}
        {layout.out.map((pair, k) => {
          const st = stages[k];
          const lab = outcomeLabels(st);
          const cond = theory.enter[k] > 1e-12 ? (j: number) => (j === 0 ? theory.outPlus[k] : theory.outMinus[k]) / theory.enter[k] : () => NaN;
          return pair.map((o, j) => {
            const col = j === 0 ? COLORS.p0 : COLORS.p1;
            const sym = j === 0 ? lab.plus : lab.minus;
            const blocked = o.end === 'stop';
            return (
              <g key={`l${k}-${j}`} className="cursor-pointer" onClick={() => onToggleBeam(k, j === 0 ? 1 : -1)}>
                {o.stop && (
                  <rect x={o.stop[0] - 1} y={o.stop[1] - 8} width={9} height={16} rx={1.5} fill="#0b0d12" stroke={COLORS.muted} strokeWidth={1.2} />
                )}
                <rect x={o.labelAt[0] - 24} y={o.labelAt[1] - 13} width={sym.length > 1 ? 84 : 76} height={24} rx={7} fill="#0b0d12" fillOpacity={0.7} stroke={col} strokeOpacity={0.25} />
                <text x={o.labelAt[0] - 16} y={o.labelAt[1] + 5} fill={col} fontSize={15} fontWeight={700}>
                  {sym}
                </text>
                <text x={o.labelAt[0] + (sym.length > 1 ? 10 : 2)} y={o.labelAt[1] + 4.5} fill={blocked ? COLORS.faint : COLORS.text} fontSize={13} fontFamily="JetBrains Mono, monospace">
                  {blocked ? 'block' : pctText(cond(j))}
                </text>
              </g>
            );
          });
        })}
        {/* screen counts */}
        {(['plus', 'minus'] as const).map((which) => {
          const y = which === 'plus' ? layout.hitY.plus : layout.hitY.minus;
          const lab = outcomeLabels(stages[lastK]);
          const cnt = which === 'plus' ? stats.detPlus : stats.detMinus;
          const th = which === 'plus' ? theory.finalPlus : theory.finalMinus;
          return (
            <g key={which}>
              <text x={SCREEN.x + SCREEN.w + 8} y={y - 4} fill={which === 'plus' ? COLORS.p0 : COLORS.p1} fontSize={16} fontWeight={700}>
                {which === 'plus' ? lab.plus : lab.minus}
              </text>
              <text x={SCREEN.x + SCREEN.w + 8} y={y + 13} fill={COLORS.text} fontSize={13} fontFamily="JetBrains Mono, monospace">
                {cnt}
              </text>
              <text x={SCREEN.x + SCREEN.w + 8} y={y + 28} fill={COLORS.muted} fontSize={11.5} fontFamily="JetBrains Mono, monospace">
                {stats.emitted ? pctText(cnt / emitted) : pctText(th)}
              </text>
            </g>
          );
        })}
        <text x={SCREEN.x + SCREEN.w / 2} y={SCREEN.y1 + 18} fill={COLORS.muted} fontSize={12} textAnchor="middle">
          screen
        </text>
        {/* coordinate hint: beam along y, field gradient along the magnet axis */}
        <g transform={`translate(${OVEN.x + 22}, ${VH - 22})`}>
          <line x1={0} y1={0} x2={0} y2={-26} stroke={COLORS.faint} strokeWidth={1.2} />
          <line x1={0} y1={0} x2={30} y2={0} stroke={COLORS.faint} strokeWidth={1.2} />
          <line x1={0} y1={0} x2={-12} y2={10} stroke={COLORS.faint} strokeWidth={1.2} />
          <text x={-4} y={-31} fill={COLORS.muted} fontSize={13} fontFamily="KaTeX_Math, serif" fontStyle="italic">z</text>
          <text x={35} y={5} fill={COLORS.muted} fontSize={13} fontFamily="KaTeX_Math, serif" fontStyle="italic">y</text>
          <text x={-24} y={20} fill={COLORS.muted} fontSize={13} fontFamily="KaTeX_Math, serif" fontStyle="italic">x</text>
          <text x={48} y={5} fill={COLORS.faint} fontSize={12}>beam along y</text>
        </g>
      </svg>
    </div>
  );
}
