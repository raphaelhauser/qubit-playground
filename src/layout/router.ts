import { useEffect, useState } from 'react';

/** Minimal hash router: "#/hamiltonian" → "/hamiltonian". Works from file:// and static hosting. */
export function useHashPath(): string {
  const read = () => {
    const h = window.location.hash.replace(/^#/, '');
    return h.startsWith('/') ? h : '/';
  };
  const [path, setPath] = useState(read);
  useEffect(() => {
    const on = () => setPath(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return path;
}

export function navigate(path: string) {
  if (window.location.hash !== '#' + path) window.location.hash = path;
}
