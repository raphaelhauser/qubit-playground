import { ReactNode, useId } from 'react';
import { Tex } from './Tex';
import { useHighlight, useHoverKey } from './Highlight';
import { COLORS } from '../theme';

/** Outcome "−/1/↓" colours are drawn hollow (rule 4 of the visual grammar). */
export const isHollow = (color?: string) => !!color && color.toLowerCase() === COLORS.p1.toLowerCase();

// ---------------------------------------------------------------------------
// Section ("Card"): a hairline-ruled section of the notebook, not a box
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
    <section className={`border-t border-ink-700 ${className}`}>
      {(title || right || kicker) && (
        <header className="flex items-baseline justify-between gap-3 pt-3">
          <div className="min-w-0">
            {kicker && right && <div className="mb-0.5 font-mono text-[10.5px] tracking-[0.04em] text-ink-400">{kicker}</div>}
            {title && <h3 className="text-[16px] font-semibold leading-snug tracking-[-0.005em] text-ink-100">{title}</h3>}
          </div>
          {right ? (
            <div className="shrink-0">{right}</div>
          ) : (
            kicker && <div className="shrink-0 text-right font-mono text-[10.5px] tracking-[0.04em] text-ink-400">{kicker}</div>
          )}
        </header>
      )}
      <div className={`pb-5 pt-2.5 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/** Small instrument label. */
export function Label({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`font-mono text-[10.5px] tracking-[0.05em] text-ink-400 ${className}`}>{children}</div>;
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
    'inline-flex select-none items-center justify-center gap-1.5 rounded-[5px] font-mono tracking-[0.01em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-300 disabled:cursor-not-allowed disabled:opacity-35';
  const sizes = size === 'sm' ? 'h-[26px] px-2.5 text-[11.5px]' : 'h-[30px] px-3 text-[12.5px]';
  const variants: Record<Variant, string> = {
    primary: 'bg-ink-100 text-ink-900 hover:bg-ink-200',
    secondary: active
      ? 'bg-ink-100 text-ink-900 ring-1 ring-inset ring-ink-100'
      : 'text-ink-200 ring-1 ring-inset ring-ink-600 hover:text-ink-100 hover:ring-ink-400',
    ghost: active ? 'bg-ink-750 text-ink-100' : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100',
    danger: 'text-bad ring-1 ring-inset ring-bad/40 hover:bg-bad/10',
  };
  return (
    <button type={type} title={title} disabled={disabled} onClick={onClick} className={`${base} ${sizes} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

/** Mutually exclusive options: a hairline strip with the active option inverted. */
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
    <div role="radiogroup" className={`inline-flex flex-wrap gap-px rounded-[6px] p-px ring-1 ring-inset ring-ink-600 ${className}`}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={on}
            aria-label={o.title ?? (typeof o.label === 'string' ? o.label : o.tex ?? o.value)}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={`rounded-[5px] px-2.5 font-mono ${size === 'sm' ? 'h-[24px] text-[11.5px]' : 'h-[28px] text-[12px]'} transition-colors ${
              on ? 'bg-ink-100 text-ink-900' : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100'
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
    <label className="inline-flex cursor-pointer select-none items-center gap-2 text-[13px] text-ink-200">
      <span
        role="switch"
        aria-checked={checked}
        tabIndex={0}
        onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && (e.preventDefault(), onChange(!checked))}
        onClick={() => onChange(!checked)}
        className={`relative inline-block h-[16px] w-[28px] rounded-full ring-1 ring-inset transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-300 ${
          checked ? 'bg-ink-100 ring-ink-100' : 'bg-transparent ring-ink-500'
        }`}
      >
        <span className={`absolute top-[3px] h-[10px] w-[10px] rounded-full transition-all ${checked ? 'left-[15px] bg-ink-900' : 'left-[3px] bg-ink-400'}`} />
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
  const { setActive, showTip, showText, hideTip } = useHighlight();
  const pct = ((value - min) / (max - min)) * 100;
  // Hovering anywhere on the slider links it to the figure (highlight only). The explanatory
  // tooltip appears only over the label, above it, so it never covers the track being dragged.
  const groupProps = hl
    ? {
        onMouseEnter: () => setActive(hl),
        onMouseLeave: () => {
          setActive(null);
          hideTip();
        },
      }
    : {};
  const hasTip = !!(hint || hl);
  const labelTipProps = hasTip
    ? {
        onMouseEnter: (e: React.MouseEvent) => {
          // anchor spans label → track: the bubble goes above the label, or (no room) below the track
          const lr = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const gr = ((e.currentTarget as HTMLElement).closest('.group') as HTMLElement | null)?.getBoundingClientRect() ?? lr;
          const r = new DOMRect(gr.left, lr.top, gr.width, gr.bottom - lr.top);
          if (hint) showText(hint, r);
          else showTip(hl!, r);
        },
        onMouseLeave: hideTip,
      }
    : {};
  // the "text" ink is the default bead colour; other colours (e.g. a phase hue) are kept
  const fill = color && color.toLowerCase() !== COLORS.text.toLowerCase() ? color : undefined;
  return (
    <div className="group" {...groupProps}>
      <div className="mb-0.5 flex items-baseline justify-between gap-2">
        <label
          htmlFor={id}
          {...labelTipProps}
          className={`text-[13.5px] text-ink-200 ${hasTip ? 'cursor-help decoration-ink-500 decoration-dotted underline-offset-[5px] hover:underline' : ''}`}
        >
          {tex ? <Tex>{tex}</Tex> : label}
          {tex && label ? <span className="ml-2 font-mono text-[10.5px] tracking-[0.04em] text-ink-400">{label}</span> : null}
        </label>
        <span className="font-mono text-[12px] tabular-nums text-ink-100">{format ? <Tex>{format(value)}</Tex> : value.toFixed(2)}</span>
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
        onPointerDown={hideTip}
        style={{ ['--pct' as string]: `${Math.max(0, Math.min(100, pct))}%`, ...(fill ? { ['--fill' as string]: fill } : {}) }}
      />
      {marks && (
        <div className="mt-0.5 flex flex-wrap gap-1">
          {marks.map((m) => (
            <button
              key={m.tex}
              onClick={() => onChange(m.value)}
              className="rounded-[4px] px-1.5 py-0.5 text-[11.5px] text-ink-400 ring-1 ring-inset ring-ink-700 hover:text-ink-100 hover:ring-ink-500"
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

/** "label ·········· value" — a ledger row. */
export function KV({ k, v, hl, className = '' }: { k: ReactNode; v: ReactNode; hl?: string; className?: string }) {
  const hover = useHoverKey();
  return (
    <div className={`flex items-baseline gap-2 py-[3px] text-[13px] ${className}`} {...(hl ? hover(hl) : {})}>
      <span className="shrink-0 text-ink-300">{k}</span>
      <span aria-hidden className="min-w-[12px] flex-1 translate-y-[-3px] border-b border-dotted border-ink-600" />
      <span className="shrink-0 font-mono text-[12.5px] tabular-nums text-ink-100">{v}</span>
    </div>
  );
}

const TONE_WORD = { info: 'Note', insight: 'Remark', warn: 'Caution', good: 'Result' } as const;

/** A marginal remark in textbook style. */
export function Callout({ tone = 'info', title, children }: { tone?: 'info' | 'insight' | 'warn' | 'good'; title?: ReactNode; children: ReactNode }) {
  const rule = { info: 'border-ink-500', insight: 'border-ink-300', warn: 'border-bad/70', good: 'border-good/70' }[tone];
  return (
    <aside className={`border-l-2 py-0.5 pl-3.5 ${rule}`}>
      <div className="mb-1 flex items-baseline gap-2">
        <span className="font-mono text-[10.5px] tracking-[0.05em] text-ink-400">{TONE_WORD[tone].toLowerCase()}</span>
        {title && <span className="text-[14px] font-semibold italic text-ink-100">{title}</span>}
      </div>
      <div className="prose-q text-[14px] leading-[1.6] text-ink-200">{children}</div>
    </aside>
  );
}

/** Legend entry; outcome-− colours are shown hollow. */
export function Swatch({ color, children }: { color: string; children: ReactNode }) {
  const hollow = isHollow(color);
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-300">
      <span className="h-[9px] w-[9px] rounded-full" style={hollow ? { boxShadow: `inset 0 0 0 1.5px ${color}` } : { background: color }} />
      {children}
    </span>
  );
}

/** A small phase-wheel disc (hue = complex phase). */
export function PhaseWheel({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={`phase-wheel inline-block shrink-0 rounded-full ${className}`}
      style={{ width: size, height: size, WebkitMask: `radial-gradient(circle, transparent ${size * 0.26}px, #000 ${size * 0.28}px)`, mask: `radial-gradient(circle, transparent ${size * 0.26}px, #000 ${size * 0.28}px)` }}
    />
  );
}

// ---------------------------------------------------------------------------
// Icons (inline, stroke-based)
// ---------------------------------------------------------------------------

const ic = 'h-[15px] w-[15px]';
export const Icon = {
  play: <svg viewBox="0 0 16 16" className={ic} fill="currentColor"><path d="M4.5 2.8v10.4c0 .5.6.8 1 .5l8-5.2a.6.6 0 0 0 0-1l-8-5.2c-.4-.3-1 0-1 .5Z" /></svg>,
  pause: <svg viewBox="0 0 16 16" className={ic} fill="currentColor"><rect x="3.5" y="2.5" width="3" height="11" rx=".8" /><rect x="9.5" y="2.5" width="3" height="11" rx=".8" /></svg>,
  reset: <svg viewBox="0 0 16 16" className={ic} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 8a5 5 0 1 0 1.6-3.7" /><path d="M3 2.5v2.8h2.8" /></svg>,
  replay: <svg viewBox="0 0 16 16" className={ic} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 8a5 5 0 1 1-1.6-3.7" /><path d="M13 2.5v2.8h-2.8" /><path d="M6.8 5.8v4.4l3.4-2.2z" fill="currentColor" stroke="none" /></svg>,
  stepF: <svg viewBox="0 0 16 16" className={ic} fill="currentColor"><path d="M3 3.2v9.6c0 .4.5.7.9.4L10 9V12.5h2v-9h-2V7L3.9 2.8c-.4-.3-.9 0-.9.4Z" /></svg>,
  stepB: <svg viewBox="0 0 16 16" className={ic} fill="currentColor"><path d="M13 3.2v9.6c0 .4-.5.7-.9.4L6 9V12.5H4v-9h2V7l6.1-4.2c.4-.3.9 0 .9.4Z" /></svg>,
  undo: <svg viewBox="0 0 16 16" className={ic} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5.5 3 2.5 6l3 3" /><path d="M2.5 6h7a4 4 0 0 1 0 8h-2" /></svg>,
  menu: <svg viewBox="0 0 16 16" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" /></svg>,
  close: <svg viewBox="0 0 16 16" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="m4 4 8 8M12 4l-8 8" /></svg>,
  check: <svg viewBox="0 0 16 16" className={ic} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m3.5 8.5 3 3 6-7" /></svg>,
  bulb: <svg viewBox="0 0 16 16" className={ic} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 12.5h4M6.5 14.5h3M8 1.5a4.5 4.5 0 0 0-2.6 8.2c.4.3.6.7.6 1.2v.6h4v-.6c0-.5.2-.9.6-1.2A4.5 4.5 0 0 0 8 1.5Z" /></svg>,
  eye: <svg viewBox="0 0 16 16" className={ic} fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z" /><circle cx="8" cy="8" r="2" /></svg>,
  arrowR: <svg viewBox="0 0 16 16" className={ic} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8h10M9 4l4 4-4 4" /></svg>,
  arrowL: <svg viewBox="0 0 16 16" className={ic} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 8H3M7 4 3 8l4 4" /></svg>,
  sun: <svg viewBox="0 0 16 16" className={ic} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><circle cx="8" cy="8" r="3" /><path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" /></svg>,
  moon: <svg viewBox="0 0 16 16" className={ic} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"><path d="M13.2 10.2A5.8 5.8 0 0 1 5.8 2.8a5.8 5.8 0 1 0 7.4 7.4Z" /></svg>,
};
