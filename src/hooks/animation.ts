import { useCallback, useEffect, useRef, useState } from 'react';

/** Calls `cb(dtSeconds)` on every animation frame while `active`. */
export function useRaf(cb: (dt: number) => void, active: boolean) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    if (!active) return;
    let id = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      ref.current(dt);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [active]);
}

export const easeInOutCubic = (s: number) => (s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2);

/**
 * A 0→1 tween driven by requestAnimationFrame. Used to animate gates as continuous rotations:
 * the displayed state at progress s is R_n(s·θ)|ψ⟩ — real quantum mechanics at every frame.
 */
export function useTween() {
  const [progress, setProgress] = useState(1);
  const [running, setRunning] = useState(false);
  const raf = useRef(0);
  const done = useRef<(() => void) | null>(null);

  const cancel = useCallback(() => {
    cancelAnimationFrame(raf.current);
    setRunning(false);
  }, []);

  const start = useCallback((durationMs: number, onDone?: () => void, ease = easeInOutCubic) => {
    cancelAnimationFrame(raf.current);
    done.current = onDone ?? null;
    const t0 = performance.now();
    setRunning(true);
    setProgress(0);
    const step = (now: number) => {
      const s = Math.min(1, (now - t0) / durationMs);
      setProgress(ease(s));
      if (s < 1) raf.current = requestAnimationFrame(step);
      else {
        setRunning(false);
        const d = done.current;
        done.current = null;
        d?.();
      }
    };
    raf.current = requestAnimationFrame(step);
  }, []);

  /** jump to the end immediately (runs the completion callback) */
  const finish = useCallback(() => {
    cancelAnimationFrame(raf.current);
    setProgress(1);
    setRunning(false);
    const d = done.current;
    done.current = null;
    d?.();
  }, []);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  return { progress, running, start, cancel, finish };
}

/** Respect the user's reduced-motion preference. */
export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** localStorage-backed state that silently falls back to memory. */
export function usePersistentState<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      const s = window.localStorage.getItem(key);
      return s ? (JSON.parse(s) as T) : initial;
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (nv: T | ((p: T) => T)) => {
      setV((prev) => {
        const next = typeof nv === 'function' ? (nv as (p: T) => T)(prev) : nv;
        try {
          window.localStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* storage unavailable */
        }
        return next;
      });
    },
    [key],
  );
  return [v, set];
}
