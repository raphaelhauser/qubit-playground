import { ReactNode } from 'react';

/**
 * Standard page layout for a learning module:
 *   ┌──────────── header (letter, title, intro) ────────────┐
 *   │  visualization (large, grid background)  │  math     │
 *   │  controls                                │  panel    │
 *   └──────────────────────────────────────────┴───────────┘
 */
export function ModuleShell({
  letter,
  title,
  intro,
  tabs,
  viz,
  vizHeight = 'clamp(360px, 58vh, 720px)',
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
  /** full-width content below the main grid */
  below?: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 pb-16 pt-5 lg:px-6">
      <header className="mb-4">
        {letter && <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-state/80">Module {letter}</div>}
        <h1 className="text-[22px] font-semibold tracking-tight text-ink-100 lg:text-[26px]">{title}</h1>
        {intro && <div className="prose-q mt-2 max-w-[880px] text-ink-300">{intro}</div>}
        {tabs && <div className="mt-4">{tabs}</div>}
      </header>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="min-w-0 space-y-4">
          <div className="bg-grid relative overflow-hidden rounded-2xl border border-ink-700/80" style={{ height: vizHeight }}>
            {viz}
          </div>
          {controls && <div className="space-y-4">{controls}</div>}
        </div>
        {panel && <aside className="min-w-0 space-y-4">{panel}</aside>}
      </div>
      {below && <div className="mt-4 space-y-4">{below}</div>}
    </div>
  );
}

/** Tab strip for module sub-views. */
export function SubTabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-ink-700">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`-mb-px border-b-2 px-3 pb-2 pt-1 text-[13px] font-medium transition-colors ${
            value === t.id ? 'border-state text-ink-100' : 'border-transparent text-ink-400 hover:text-ink-200'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
