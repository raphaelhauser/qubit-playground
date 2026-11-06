import { ReactNode } from 'react';

const LETTERS = 'ABCDEFG';

/**
 * The "lab bench" page layout of a chapter.
 *
 *   ┌ chapter 03 ───────────────────────────────────────────────────────────┐
 *   │ Title                                              lede paragraph      │
 *   ├────────────────────────────────────────┬──────────────────────────────┤
 *   │                                        │ controls                     │
 *   │   figure (sticky: stays in view while  │ ──────────────────────────── │
 *   │   the notebook column scrolls)         │ mathematics (notes)          │
 *   │                                        │                              │
 *   └────────────────────────────────────────┴──────────────────────────────┘
 *
 * Wide figures (an explicit `vizHeight`, e.g. the Stern–Gerlach beam line) span the full width
 * instead, with controls and notes side by side underneath.
 */
export function ModuleShell({
  letter,
  title,
  intro,
  tabs,
  viz,
  vizHeight,
  controls,
  panel,
  below,
}: {
  letter?: string;
  title: ReactNode;
  intro?: ReactNode;
  /** optional sub-navigation shown under the header */
  tabs?: ReactNode;
  viz: ReactNode;
  vizHeight?: string;
  controls?: ReactNode;
  panel?: ReactNode;
  /** full-width content below the bench */
  below?: ReactNode;
}) {
  const idx = letter ? LETTERS.indexOf(letter) : -1;
  const num = idx >= 0 ? String(idx + 1).padStart(2, '0') : null;
  const wide = vizHeight !== undefined;

  const controlsBlock = controls && (
    <div>
      <ColumnLabel>controls</ColumnLabel>
      <div className="space-y-5">{controls}</div>
    </div>
  );
  const notesBlock = panel && (
    <div>
      <ColumnLabel>mathematics</ColumnLabel>
      <div className="space-y-5">{panel}</div>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[1560px] px-4 pb-16 pt-7 lg:px-8">
      <header className="mb-6 grid items-end gap-x-12 gap-y-3 lg:grid-cols-[minmax(0,1fr)_minmax(380px,520px)]">
        <div className="min-w-0">
          {num && <div className="font-mono text-[11px] tracking-[0.06em] text-ink-400">chapter {num}</div>}
          <h1 className="mt-1.5 text-[30px] font-semibold leading-[1.06] tracking-[-0.02em] text-ink-100 lg:text-[42px]" style={{ fontVariationSettings: '"opsz" 60' }}>
            {title}
          </h1>
        </div>
        {intro && <div className="prose-q max-w-[620px] text-ink-300 lg:pb-1">{intro}</div>}
      </header>
      {tabs && <div className="mb-6">{tabs}</div>}

      {wide ? (
        <>
          <Figure style={{ height: vizHeight }}>{viz}</Figure>
          <div className="mt-7 grid gap-x-12 gap-y-8 lg:grid-cols-2">
            <div className="notebook min-w-0">{controlsBlock}</div>
            <div className="notebook min-w-0">{notesBlock}</div>
          </div>
        </>
      ) : (
        <div className="grid gap-x-12 gap-y-7 lg:grid-cols-[minmax(0,1fr)_minmax(380px,520px)]">
          <div className="min-w-0">
            <Figure className="h-[min(92vw,460px)] sm:h-[500px] lg:sticky lg:top-[76px] lg:h-[calc(100vh-100px)] lg:max-h-[880px] lg:min-h-[480px]">{viz}</Figure>
          </div>
          <div className="notebook min-w-0 space-y-8">
            {controlsBlock}
            {notesBlock}
          </div>
        </div>
      )}
      {below && <div className="mt-8 space-y-6">{below}</div>}
    </div>
  );
}

function ColumnLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-1 flex items-center gap-3 font-mono text-[10.5px] tracking-[0.06em] text-ink-500">
      <span>{children}</span>
      <span className="h-px flex-1 bg-ink-800" />
    </div>
  );
}

/** The figure plate: a drafting field with a hairline frame. */
function Figure({ children, className = '', style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`bg-grid relative overflow-hidden rounded-[14px] ring-1 ring-inset ring-ink-750 ${className}`} style={style}>
      {children}
    </div>
  );
}

/** Tab strip for chapter sub-views. */
export function SubTabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="flex flex-wrap gap-x-1 border-b border-ink-750" role="tablist">
      {tabs.map((t, i) => {
        const on = value === t.id;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            className={`-mb-px flex items-baseline gap-2 border-b-[1.5px] px-3 pb-2.5 pt-1 text-[14.5px] transition-colors ${
              on ? 'border-ink-100 text-ink-100' : 'border-transparent text-ink-400 hover:text-ink-200'
            }`}
          >
            <span className="font-mono text-[10px] text-ink-500">{String.fromCharCode(97 + i)}</span>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
