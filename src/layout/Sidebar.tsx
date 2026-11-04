import { MODULES } from '../modules/registry';
import { navigate } from './router';
import { Tex } from '../components/Tex';

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="h-7 w-7">
      <circle cx="16" cy="16" r="12.5" fill="none" stroke="#7cc4ff" strokeWidth="1.6" />
      <ellipse cx="16" cy="16" rx="12.5" ry="4.2" fill="none" stroke="#3b4458" strokeWidth="1.1" />
      <line x1="16" y1="16" x2="23.5" y2="7.5" stroke="#f2c14e" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="16" r="1.6" fill="#e3e6ec" />
    </svg>
  );
}

export function Sidebar({ path, onNavigate }: { path: string; onNavigate?: () => void }) {
  const groups = ['Modules', 'Practice'] as const;
  const go = (p: string) => {
    navigate(p);
    onNavigate?.();
  };
  return (
    <nav className="flex h-full flex-col">
      <button onClick={() => go('/')} className="flex items-center gap-2.5 px-4 pb-4 pt-4 text-left">
        <Logo />
        <div>
          <div className="text-[14px] font-semibold leading-tight text-ink-100">Qubit Playground</div>
          <div className="text-[11px] leading-tight text-ink-400">single-qubit quantum mechanics</div>
        </div>
      </button>
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {groups.map((g) => (
          <div key={g} className="mb-4">
            <div className="px-2.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-500">{g}</div>
            {MODULES.filter((m) => m.group === g).map((m) => {
              const on = path === m.path || path.startsWith(m.path + '/');
              return (
                <button
                  key={m.id}
                  onClick={() => go(m.path)}
                  className={`group mb-0.5 flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
                    on ? 'bg-ink-750 ring-1 ring-inset ring-ink-600' : 'hover:bg-ink-800'
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11.5px] font-semibold ${
                      on ? 'bg-state/20 text-state' : 'bg-ink-800 text-ink-400 group-hover:text-ink-200'
                    }`}
                  >
                    {m.letter ?? (m.id === 'exercises' ? '✎' : '?')}
                  </span>
                  <span className="min-w-0">
                    <span className={`block truncate text-[13px] font-medium ${on ? 'text-ink-100' : 'text-ink-200'}`}>{m.title}</span>
                    <span className="block truncate text-[11px] text-ink-400">{m.short}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="border-t border-ink-800 px-4 py-3 text-[11px] leading-relaxed text-ink-500">
        Units with <Tex>{'\\hbar = 1'}</Tex>. Every picture is computed from the state vector.
      </div>
    </nav>
  );
}
