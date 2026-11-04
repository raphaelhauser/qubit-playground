/**
 * One palette for DOM, SVG and WebGL. Each colour has exactly one meaning:
 *   state  — the quantum state (Bloch vector, |ψ⟩)
 *   axis   — rotation axes / generators
 *   phase  — complex phases (arcs, e^{iφ})
 *   p0/p1  — the two measurement outcomes (|0⟩/↑/+  and  |1⟩/↓/−) and their probabilities
 */
export const COLORS = {
  bg: '#0b0d12',
  panel: '#11141b',
  grid: '#232a38',
  gridStrong: '#343d50',
  text: '#e3e6ec',
  muted: '#8b93a7',
  faint: '#5b6478',
  state: '#7cc4ff',
  stateDim: '#3d6f99',
  axis: '#c49bff',
  phase: '#f2c14e',
  p0: '#4fd1c5',
  p1: '#f78c6c',
  good: '#6ee7a8',
  bad: '#ff8a8a',
  /** cartesian axis tints, deliberately muted */
  x: '#d38b8b',
  y: '#8bc79b',
  z: '#8ba9d6',
} as const;

export type ColorKey = keyof typeof COLORS;
