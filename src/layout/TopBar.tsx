import { useMemo } from 'react';
import { MODULES, chapterNumber } from '../modules/registry';
import { navigate } from './router';
import { Icon } from '../components/ui';
import { phaseColor, ThemeName } from '../theme';

/** Brand mark: the phase wheel with a state arrow — the two ideas every figure is built from. */
export function BrandMark({ size = 26 }: { size?: number }) {
  const segs = useMemo(() => {
    const n = 48;
    const r = 10.5;
    return Array.from({ length: n }, (_, k) => {
      const a0 = (2 * Math.PI * k) / n;
      const a1 = (2 * Math.PI * (k + 1.08)) / n;
      return {
        d: `M ${16 + r * Math.cos(a0)} ${16 - r * Math.sin(a0)} A ${r} ${r} 0 0 0 ${16 + r * Math.cos(a1)} ${16 - r * Math.sin(a1)}`,
        c: phaseColor((a0 + a1) / 2),
      };
    });
  }, []);
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden>
      {segs.map((s, i) => (
        <path key={i} d={s.d} fill="none" stroke={s.c} strokeWidth={2.6} />
      ))}
      <line x1="16" y1="16" x2="21.6" y2="8.4" className="stroke-ink-100" strokeWidth="2.1" strokeLinecap="round" />
      <circle cx="21.6" cy="8.4" r="2" fill={phaseColor(Math.atan2(16 - 8.4, 21.6 - 16))} />
      <circle cx="16" cy="16" r="1.6" className="fill-ink-100" />
    </svg>
  );
}

export function TopBar({
  path,
  theme,
  onToggleTheme,
  onOpenContents,
}: {
  path: string;
  theme: ThemeName;
  onToggleTheme: () => void;
  onOpenContents: () => void;
}) {
  const chapters = MODULES.filter((m) => m.group === 'Modules');
  const practice = MODULES.filter((m) => m.group === 'Practice');
  const isOn = (p: string) => path === p || path.startsWith(p + '/');
  const item = (m: (typeof MODULES)[number]) => {
    const on = isOn(m.path);
    const num = chapterNumber(m);
    return (
      <button
        key={m.id}
        onClick={() => navigate(m.path)}
        title={m.title}
        className={`group relative flex h-14 items-center gap-1.5 px-2 text-[14px] transition-colors 2xl:px-2.5 ${on ? 'text-ink-100' : 'text-ink-300 hover:text-ink-100'}`}
      >
        {num && <span className={`font-mono text-[10px] ${on ? 'text-ink-300' : 'text-ink-500 group-hover:text-ink-400'}`}>{num}</span>}
        <span>{m.nav}</span>
        <span className={`absolute inset-x-2 bottom-0 h-[1.5px] transition-colors ${on ? 'bg-ink-100' : 'bg-transparent'}`} />
      </button>
    );
  };
  return (
    <div className="sticky top-0 z-40 border-b border-ink-750 bg-ink-900/[0.86] backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1560px] items-center gap-3 px-4 lg:px-8">
        <button onClick={() => navigate('/')} className="flex shrink-0 items-center gap-2.5" aria-label="Qubit Playground — contents">
          <BrandMark />
          <span className="text-[16.5px] font-semibold tracking-[-0.01em] text-ink-100">Qubit Playground</span>
        </button>
        <nav className="ml-auto hidden items-center xl:flex" aria-label="Chapters">
          {chapters.map(item)}
          <span className="mx-2 h-5 w-px bg-ink-700" aria-hidden />
          {practice.map(item)}
        </nav>
        <div className="ml-auto flex items-center gap-1 xl:ml-2">
          <button
            onClick={onToggleTheme}
            className="flex h-8 w-8 items-center justify-center rounded-[6px] text-ink-300 ring-1 ring-inset ring-ink-700 hover:text-ink-100 hover:ring-ink-500"
            title={theme === 'dark' ? 'Switch to paper (light)' : 'Switch to graphite (dark)'}
            aria-label="Toggle colour theme"
          >
            {theme === 'dark' ? Icon.sun : Icon.moon}
          </button>
          <button
            onClick={onOpenContents}
            className="flex h-8 items-center gap-1.5 rounded-[6px] px-2.5 font-mono text-[12px] text-ink-200 ring-1 ring-inset ring-ink-700 hover:text-ink-100 hover:ring-ink-500 xl:hidden"
            aria-label="Open contents"
          >
            {Icon.menu}
            <span className="hidden sm:inline">contents</span>
          </button>
        </div>
      </div>
    </div>
  );
}
