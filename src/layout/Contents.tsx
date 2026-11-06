import { MODULES, chapterNumber } from '../modules/registry';
import { navigate } from './router';

/** The table of contents, set like the contents page of a book. */
export function Contents({ path, onNavigate, compact = false }: { path?: string; onNavigate?: () => void; compact?: boolean }) {
  const go = (p: string) => {
    navigate(p);
    onNavigate?.();
  };
  const groups = [
    { name: 'Chapters', items: MODULES.filter((m) => m.group === 'Modules') },
    { name: 'Practice', items: MODULES.filter((m) => m.group === 'Practice') },
  ];
  return (
    <div className={compact ? 'space-y-7' : 'grid gap-x-14 gap-y-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]'}>
      {groups.map((g) => (
        <section key={g.name}>
          <div className="mb-1 font-mono text-[10.5px] tracking-[0.06em] text-ink-400">{g.name.toLowerCase()}</div>
          <ol>
            {g.items.map((m) => {
              const num = chapterNumber(m);
              const on = path !== undefined && (path === m.path || path.startsWith(m.path + '/'));
              return (
                <li key={m.id} className="border-t border-ink-750 first:border-t-0">
                  <button onClick={() => go(m.path)} className="group grid w-full grid-cols-[38px_minmax(0,1fr)_auto] items-baseline gap-x-3 py-3 text-left">
                    <span className="font-mono text-[12px] text-ink-500 group-hover:text-ink-300">{num ?? (m.id === 'exercises' ? '§' : '?')}</span>
                    <span className="min-w-0">
                      <span className={`block text-[18px] font-semibold leading-snug tracking-[-0.01em] ${on ? 'text-ink-100' : 'text-ink-100 group-hover:underline decoration-ink-500 decoration-1 underline-offset-4'}`}>
                        {m.title}
                      </span>
                      <span className="mt-0.5 block text-[14px] leading-snug text-ink-300">{m.blurb}</span>
                    </span>
                    <span className="font-mono text-[12px] text-ink-500 transition-transform group-hover:translate-x-0.5 group-hover:text-ink-200">→</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
