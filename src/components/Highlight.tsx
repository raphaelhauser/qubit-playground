import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Global "linked highlighting": equations, sliders and visualizations share one active key
 * (e.g. 'theta', 'phi', 'axis', 'p1'). Hovering an equation symbol highlights the matching part of
 * every visualization, and vice-versa. Modules register tooltip text per key.
 */

export const DEFAULT_TIPS: Record<string, string> = {
  theta: 'θ — polar angle from the +z axis (|0⟩). Controls the populations: P(0) = cos²(θ/2).',
  phi: 'φ — azimuthal angle around z. The relative phase between the |0⟩ and |1⟩ amplitudes.',
  alpha: 'α — complex amplitude of |0⟩. P(0) = |α|².',
  beta: 'β — complex amplitude of |1⟩. P(1) = |β|².',
  gamma: 'γ — global phase e^{iγ}. Multiplies every amplitude; unobservable.',
  p0: 'Probability of outcome 0 (Born rule: squared magnitude of the amplitude).',
  p1: 'Probability of outcome 1 (Born rule: squared magnitude of the amplitude).',
  psi: '|ψ⟩ — the quantum state; drawn as the Bloch vector.',
  bloch: 'Bloch vector r = (⟨X⟩, ⟨Y⟩, ⟨Z⟩).',
  axis: 'Rotation axis n of the operation on the Bloch sphere.',
  angle: 'Rotation angle on the Bloch sphere.',
  omegabar: 'ω̄ — mean energy, coefficient of the identity. Only produces a global phase.',
  deltaomega: 'Δω — half the energy splitting of the unperturbed levels, coefficient of Z.',
  epsilon: 'ε — perturbation strength, coefficient of X. Couples |0⟩ and |1⟩.',
  t: 't — evolution time (ħ = 1).',
  r: 'r = √(ε² + Δω²) — length of the Pauli part of H; half the gap between the energies.',
  v: 'v — unit rotation axis of the Pauli part of H.',
  U: 'Unitary operator: U†U = I. Preserves norms (probabilities).',
  H: 'Hamiltonian: Hermitian (H = H†) energy operator. Generates time evolution.',
  sigma: 'σ⃗ = (X, Y, Z), the vector of Pauli matrices.',
  n: 'n — unit vector; n·σ = n₁X + n₂Y + n₃Z.',
  x: 'x axis of the Bloch sphere: X eigenstates |±⟩.',
  y: 'y axis of the Bloch sphere: Y eigenstates |±i⟩.',
  z: 'z axis of the Bloch sphere: Z eigenstates |0⟩, |1⟩.',
};

interface Tip {
  text: string;
  rect: DOMRect;
}

interface Ctx {
  active: string | null;
  setActive: (k: string | null) => void;
  showTip: (key: string, rect: DOMRect) => void;
  showText: (text: string, rect: DOMRect) => void;
  hideTip: () => void;
}

const HighlightCtx = createContext<Ctx>({
  active: null,
  setActive: () => {},
  showTip: () => {},
  showText: () => {},
  hideTip: () => {},
});

export function HighlightProvider({ children, tips = {} }: { children: ReactNode; tips?: Record<string, string> }) {
  const [active, setActive] = useState<string | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const all = useMemo(() => ({ ...DEFAULT_TIPS, ...tips }), [tips]);
  const showTip = useCallback(
    (key: string, rect: DOMRect) => {
      const text = all[key];
      setTip(text ? { text, rect } : null);
    },
    [all],
  );
  const showText = useCallback((text: string, rect: DOMRect) => setTip({ text, rect }), []);
  const hideTip = useCallback(() => setTip(null), []);
  const value = useMemo(() => ({ active, setActive, showTip, showText, hideTip }), [active, showTip, showText, hideTip]);
  return (
    <HighlightCtx.Provider value={value}>
      {children}
      {tip && createPortal(<TipBubble tip={tip} />, document.body)}
    </HighlightCtx.Provider>
  );
}

function TipBubble({ tip }: { tip: Tip }) {
  const w = 280;
  const left = Math.max(8, Math.min(window.innerWidth - w - 8, tip.rect.left + tip.rect.width / 2 - w / 2));
  const below = tip.rect.top < 110;
  const top = below ? tip.rect.bottom + 8 : tip.rect.top - 8;
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-[100] animate-fadein rounded-[8px] bg-ink-100 px-3 py-2 text-[13px] leading-snug text-ink-900 shadow-float"
      style={{ left, top, width: w, transform: below ? undefined : 'translateY(-100%)' }}
    >
      {tip.text}
    </div>
  );
}

export const useHighlight = () => useContext(HighlightCtx);

/** Is key (or any of keys) the active highlight? */
export function useIsHighlighted(...keys: string[]): boolean {
  const { active } = useHighlight();
  return active !== null && keys.includes(active);
}

/** Props to spread on any DOM element so hovering it sets a highlight key (and optional tooltip). */
export function useHoverKey() {
  const { setActive, showTip, showText, hideTip } = useHighlight();
  return useCallback(
    (key: string, text?: string) => ({
      onMouseEnter: (e: React.MouseEvent) => {
        setActive(key);
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        if (text) showText(text, rect);
        else showTip(key, rect);
      },
      onMouseLeave: () => {
        setActive(null);
        hideTip();
      },
    }),
    [setActive, showTip, showText, hideTip],
  );
}

/** Plain hover tooltip for UI elements. */
export function Tip({ text, children, className = '' }: { text: string; children: ReactNode; className?: string }) {
  const { showText, hideTip } = useHighlight();
  return (
    <span
      className={className}
      onMouseEnter={(e) => showText(text, (e.currentTarget as HTMLElement).getBoundingClientRect())}
      onMouseLeave={hideTip}
    >
      {children}
    </span>
  );
}
