import { ReactNode, useId } from 'react';
import { Tex } from './Tex';
import { useHoverKey } from './Highlight';

// ---------------------------------------------------------------------------
// Card / section
// ---------------------------------------------------------------------------

export function Card({
  title,
  kicker,
  right,
  children,
  className = '',
  bodyClassName = '',
}: {
  title?: ReactNode;
  kicker?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`rounded-xl border border-ink-700/80 bg-ink-850/90 shadow-panel ${className}`}>
      {(title || right || kicker) && (
        <header className="flex items-start justify-between gap-3 px-4 pt-3">
          <div className="min-w-0">
            {kicker && <div className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-400">{kicker}</div>}
            {title && <h3 className="text-[13.5px] font-semibold text-ink-100">{title}</h3>}
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </header>
      )}
      <div className={`px-4 pb-4 pt-2 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

export function Label({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-400 ${className}`}>{children}</div>;
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  children,
  onClick,
  variant = 'secondary',
  size = 'md',
  disabled,
  active,
  title,
  className = '',
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: Variant;
  size?: 'sm' | 'md';
  disabled?: boolean;
  active?: boolean;
  title?: string;
  className?: string;
  type?: 'button' | 'submit';
}) {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-state/50 disabled:cursor-not-allowed disabled:opacity-40 select-none';
  const sizes = size === 'sm' ? 'h-7 px-2.5 text-[12px]' : 'h-8 px-3 text-[13px]';
  const variants: Record<Variant, string> = {
    primary: 'bg-state/90 text-ink-950 hover:bg-state',
    secondary: active
      ? 'bg-ink-600 text-ink-100 ring-1 ring-inset ring-state/50'
      : 'bg-ink-750 text-ink-200 ring-1 ring-inset ring-ink-600 hover:bg-ink-700 hover:text-ink-100',
    ghost: active ? 'bg-ink-700 text-ink-100' : 'text-ink-300 hover:bg-ink-750 hover:text-ink-100',
    danger: 'bg-bad/15 text-bad ring-1 ring-inset ring-bad/30 hover:bg-bad/25',
  };
  return (
    <button type={type} title={title} disabled={disabled} onClick={onClick} className={`${base} ${sizes} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

/** A row of mutually exclusive options. Labels may be KaTeX when `tex` is set. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  className = '',
}: {
  options: { value: T; label: ReactNode; tex?: string; title?: string }[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div role="radiogroup" className={`inline-flex flex-wrap gap-0.5 rounded-lg bg-ink-800 p-0.5 ring-1 ring-inset ring-ink-700 ${className}`}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={on}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={`rounded-md px-2.5 ${size === 'sm' ? 'h-6 text-[12px]' : 'h-7 text-[12.5px]'} font-medium transition-colors ${
              on ? 'bg-ink-600 text-ink-100 shadow-sm' : 'text-ink-300 hover:text-ink-100'
            }`}
          >
            {o.tex ? <Tex>{o.tex}</Tex> : o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-2 text-[12.5px] text-ink-200">
      <span
        role="switch"
        aria-checked={checked}
        tabIndex={0}
        onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && (e.preventDefault(), onChange(!checked))}
        onClick={() => onChange(!checked)}
        className={`relative inline-block h-[18px] w-8 rounded-full transition-colors ${checked ? 'bg-state/80' : 'bg-ink-600'}`}
      >
        <span className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-ink-100 transition-all ${checked ? 'left-[16px]' : 'left-[2px]'}`} />
      </span>
      <span onClick={() => onChange(!checked)}>{label}</span>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Slider
// ---------------------------------------------------------------------------

export function Slider({
  label,
  tex,
  value,
  min,
  max,
  step = 0.001,
  onChange,
  format,
  color,
  hl,
  hint,
  marks,
}: {
  label?: ReactNode;
  /** KaTeX label, e.g. '\\theta' */
  tex?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  /** KaTeX for the readout */
  format?: (v: number) => string;
  color?: string;
  /** highlight key set while hovering */
  hl?: string;
  hint?: string;
  /** quick-set values with KaTeX labels */
  marks?: { value: number; tex: string }[];
}) {
  const id = useId();
  const hover = useHoverKey();
  const pct = ((value - min) / (max - min)) * 100;
  const hoverProps = hl ? hover(hl, hint) : {};
  return (
    <div className="group" {...hoverProps}>
      <div className="mb-0.5 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[12.5px] text-ink-300">
          {tex ? <Tex>{tex}</Tex> : label}
          {tex && label ? <span className="ml-1.5 text-ink-400">{label}</span> : null}
        </label>
        <span className="font-mono text-[12px] tabular-nums text-ink-100">
          {format ? <Tex>{format(value)}</Tex> : value.toFixed(2)}
        </span>
      </div>
      <input
        id={id}
        type="range"
        className="qslider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ ['--pct' as string]: `${Math.max(0, Math.min(100, pct))}%`, ['--fill' as string]: color ?? '#7cc4ff' }}
      />
      {marks && (
        <div className="mt-0.5 flex flex-wrap gap-1">
          {marks.map((m) => (
            <button
              key={m.tex}
              onClick={() => onChange(m.value)}
              className="rounded px-1.5 py-0.5 text-[11px] text-ink-400 ring-1 ring-inset ring-ink-700 hover:bg-ink-750 hover:text-ink-100"
            >
              <Tex>{m.tex}</Tex>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Readouts
// ---------------------------------------------------------------------------

/** label : value row for numerical readouts. */
export function KV({ k, v, hl, className = '' }: { k: ReactNode; v: ReactNode; hl?: string; className?: string }) {
  const hover = useHoverKey();
  return (
    <div className={`flex items-baseline justify-between gap-3 py-0.5 text-[12.5px] ${className}`} {...(hl ? hover(hl) : {})}>
      <span className="text-ink-300">{k}</span>
      <span className="font-mono tabular-nums text-ink-100">{v}</span>
    </div>
  );
}

export function Callout({ tone = 'info', title, children }: { tone?: 'info' | 'insight' | 'warn' | 'good'; title?: ReactNode; children: ReactNode }) {
  const tones = {
    info: 'border-state/25 bg-state/[0.06]',
    insight: 'border-phase/25 bg-phase/[0.06]',
    warn: 'border-p1/30 bg-p1/[0.07]',
    good: 'border-good/25 bg-good/[0.06]',
  } as const;
  const dot = { info: 'bg-state', insight: 'bg-phase', warn: 'bg-p1', good: 'bg-good' }[tone];
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${tones[tone]}`}>
      {title && (
        <div className="mb-1 flex items-center gap-2 text-[12px] font-semibold text-ink-100">
          <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
          {title}
        </div>
      )}
      <div className="prose-q text-[13px] leading-relaxed text-ink-200">{children}</div>
    </div>
  );
}

/** Small colored legend chip. */
export function Swatch({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-300">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Icons (inline, stroke-based)
// ---------------------------------------------------------------------------

const ic = 'h-4 w-4';
export const Icon = {
  play: <svg viewBox="0 0 16 16" className={ic} fill="currentColor"><path d="M4.5 2.8v10.4c0 .5.6.8 1 .5l8-5.2a.6.6 0 0 0 0-1l-8-5.2c-.4-.3-1 0-1 .5Z" /></svg>,
  pause: <svg viewBox="0 0 16 16" className={ic} fill="currentColor"><rect x="3.5" y="2.5" width="3" height="11" rx=".8" /><rect x="9.5" y="2.5" width="3" height="11" rx=".8" /></svg>,
  reset: <svg viewBox="0 0 16 16" className={ic} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 8a5 5 0 1 0 1.6-3.7" /><path d="M3 2.5v2.8h2.8" /></svg>,
  replay: <svg viewBox="0 0 16 16" className={ic} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M13 8a5 5 0 1 1-1.6-3.7" /><path d="M13 2.5v2.8h-2.8" /><path d="M6.8 5.8v4.4l3.4-2.2z" fill="currentColor" stroke="none" /></svg>,
  stepF: <svg viewBox="0 0 16 16" className={ic} fill="currentColor"><path d="M3 3.2v9.6c0 .4.5.7.9.4L10 9V12.5h2v-9h-2V7L3.9 2.8c-.4-.3-.9 0-.9.4Z" /></svg>,
  stepB: <svg viewBox="0 0 16 16" className={ic} fill="currentColor"><path d="M13 3.2v9.6c0 .4-.5.7-.9.4L6 9V12.5H4v-9h2V7l6.1-4.2c.4-.3.9 0 .9.4Z" /></svg>,
  undo: <svg viewBox="0 0 16 16" className={ic} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5.5 3 2.5 6l3 3" /><path d="M2.5 6h7a4 4 0 0 1 0 8h-2" /></svg>,
  menu: <svg viewBox="0 0 16 16" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2.5 4h11M2.5 8h11M2.5 12h11" /></svg>,
  close: <svg viewBox="0 0 16 16" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="m4 4 8 8M12 4l-8 8" /></svg>,
  check: <svg viewBox="0 0 16 16" className={ic} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3.5 8.5 3 3 6-7" /></svg>,
  bulb: <svg viewBox="0 0 16 16" className={ic} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 12.5h4M6.5 14.5h3M8 1.5a4.5 4.5 0 0 0-2.6 8.2c.4.3.6.7.6 1.2v.6h4v-.6c0-.5.2-.9.6-1.2A4.5 4.5 0 0 0 8 1.5Z" /></svg>,
  eye: <svg viewBox="0 0 16 16" className={ic} fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z" /><circle cx="8" cy="8" r="2" /></svg>,
  arrowR: <svg viewBox="0 0 16 16" className={ic} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8h10M9 4l4 4-4 4" /></svg>,
  arrowL: <svg viewBox="0 0 16 16" className={ic} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M13 8H3M7 4 3 8l4 4" /></svg>,
};
