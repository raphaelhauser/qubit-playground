import { useEffect, useState } from 'react';
import { HighlightProvider } from './components/Highlight';
import { Sidebar } from './layout/Sidebar';
import { useHashPath } from './layout/router';
import { findModule } from './modules/registry';
import Home from './modules/Home';
import { Icon } from './components/ui';

export default function App() {
  const path = useHashPath();
  const [drawer, setDrawer] = useState(false);
  const found = findModule(path);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    document.getElementById('main-scroll')?.scrollTo({ top: 0 });
  }, [found?.mod.id]);

  const Page = found?.mod.component;
  return (
    <HighlightProvider>
      <div className="flex h-full">
        {/* desktop sidebar */}
        <aside className="hidden w-[264px] shrink-0 border-r border-ink-800 bg-ink-950/60 lg:block">
          <div className="sticky top-0 h-screen">
            <Sidebar path={path} />
          </div>
        </aside>
        {/* mobile drawer */}
        {drawer && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setDrawer(false)} />
            <div className="absolute inset-y-0 left-0 w-[280px] border-r border-ink-700 bg-ink-900 shadow-2xl">
              <button className="absolute right-2 top-3 p-2 text-ink-300" onClick={() => setDrawer(false)} aria-label="Close menu">
                {Icon.close}
              </button>
              <Sidebar path={path} onNavigate={() => setDrawer(false)} />
            </div>
          </div>
        )}
        <main id="main-scroll" className="relative min-w-0 flex-1 overflow-y-auto">
          <div className="sticky top-0 z-40 flex items-center gap-3 border-b border-ink-800 bg-ink-900/90 px-4 py-2.5 backdrop-blur lg:hidden">
            <button onClick={() => setDrawer(true)} className="text-ink-200" aria-label="Open menu">
              {Icon.menu}
            </button>
            <span className="text-[14px] font-semibold text-ink-100">{found?.mod.title ?? 'Qubit Playground'}</span>
          </div>
          {Page ? <Page key={found!.mod.id} subpath={found!.subpath} /> : <Home />}
        </main>
      </div>
    </HighlightProvider>
  );
}
