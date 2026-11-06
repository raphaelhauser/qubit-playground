import { useCallback, useEffect, useState } from 'react';
import { HighlightProvider } from './components/Highlight';
import { TopBar, BrandMark } from './layout/TopBar';
import { Contents } from './layout/Contents';
import { useHashPath } from './layout/router';
import { findModule } from './modules/registry';
import Home from './modules/Home';
import { Icon } from './components/ui';
import { applyTheme, getTheme, storeTheme, ThemeName } from './theme';

export default function App() {
  const path = useHashPath();
  const [sheet, setSheet] = useState(false);
  const [theme, setTheme] = useState<ThemeName>(getTheme());
  // figures read colours at render time; remounting the page redraws every canvas in the new theme
  const [themeEpoch, setThemeEpoch] = useState(0);
  const found = findModule(path);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [path]);

  useEffect(() => {
    document.title = found ? `${found.mod.title} — Qubit Playground` : 'Qubit Playground';
  }, [found?.mod.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSheet(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheet]);

  const toggleTheme = useCallback(() => {
    const next: ThemeName = getTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    storeTheme(next);
    setTheme(next);
    setThemeEpoch((e) => e + 1);
  }, []);

  const Page = found?.mod.component;
  return (
    <HighlightProvider>
      <div className="min-h-full">
        <TopBar key={`bar-${themeEpoch}`} path={path} theme={theme} onToggleTheme={toggleTheme} onOpenContents={() => setSheet(true)} />
        <main id="main-scroll" className="relative" style={{ overflowX: 'clip' }} key={`page-${themeEpoch}`}>
          {Page ? <Page key={found!.mod.id} subpath={found!.subpath} /> : <Home />}
        </main>
        <footer className="mx-auto max-w-[1560px] px-4 pb-10 pt-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-750 pt-4 font-mono text-[11px] text-ink-500">
            <span>Qubit Playground · units with ħ = 1 · every figure is computed from the state vector</span>
            <span>ink = state · hue = phase · dashes = constructions · filled/hollow = outcome</span>
          </div>
        </footer>
      </div>
      {sheet && (
        <div className="fixed inset-0 z-50 animate-fadein overflow-y-auto bg-ink-900" role="dialog" aria-label="Contents">
          <div className="mx-auto max-w-[760px] px-5 pb-16 pt-4">
            <div className="mb-6 flex items-center justify-between">
              <span className="flex items-center gap-2.5">
                <BrandMark />
                <span className="text-[16.5px] font-semibold text-ink-100">Contents</span>
              </span>
              <button className="rounded-[6px] p-1.5 text-ink-300 ring-1 ring-inset ring-ink-700 hover:text-ink-100" onClick={() => setSheet(false)} aria-label="Close contents">
                {Icon.close}
              </button>
            </div>
            <Contents path={path} compact onNavigate={() => setSheet(false)} />
          </div>
        </div>
      )}
    </HighlightProvider>
  );
}
