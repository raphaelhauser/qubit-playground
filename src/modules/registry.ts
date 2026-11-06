import type { ComponentType } from 'react';
import BlochModule from './bloch/BlochModule';
import GatesModule from './gates/GatesModule';
import HamiltonianModule from './hamiltonian/HamiltonianModule';
import ExponentialModule from './exponential/ExponentialModule';
import PauliModule from './pauli/PauliModule';
import SternGerlachModule from './sterngerlach/SternGerlachModule';
import EigenModule from './eigen/EigenModule';
import ExercisesModule from './exercises/ExercisesModule';
import ConceptsModule from './exercises/ConceptsModule';

export interface ModuleDef {
  id: string;
  /** hash path prefix; sub-paths (e.g. /exercises/unitarity) are passed to the module */
  path: string;
  letter?: string;
  title: string;
  /** one-word name for the chapter index */
  nav: string;
  short: string;
  /** one-sentence description for the contents page */
  blurb: string;
  group: 'Modules' | 'Practice';
  component: ComponentType<{ subpath: string }>;
}

export const MODULES: ModuleDef[] = [
  { id: 'bloch', path: '/bloch', letter: 'A', title: 'Qubits and the Bloch sphere', nav: 'State', short: 'Amplitudes, phases, geometry', blurb: 'A qubit as a unit vector in ℂ², and why every state is a point on a sphere once the global phase is discarded.', group: 'Modules', component: BlochModule },
  { id: 'gates', path: '/gates', letter: 'B', title: 'Gates as rotations', nav: 'Gates', short: 'Pauli, Hadamard, R_n(θ)', blurb: 'Every single-qubit gate is a rotation of the Bloch sphere — up to a phase you can never observe.', group: 'Modules', component: GatesModule },
  { id: 'hamiltonian', path: '/hamiltonian', letter: 'C', title: 'The Schrödinger equation', nav: 'Dynamics', short: 'Hamiltonian playground', blurb: 'Time evolution under H = ω̄I + εX + ΔωZ: precession about a tilted axis, and Rabi oscillations.', group: 'Modules', component: HamiltonianModule },
  { id: 'exponential', path: '/exponential', letter: 'D', title: 'Matrix exponentials', nav: 'Exponentials', short: 'Series, eigenbasis, rotations', blurb: 'How a power series turns a Hermitian generator into a continuous rotation.', group: 'Modules', component: ExponentialModule },
  { id: 'pauli', path: '/pauli', letter: 'E', title: 'Pauli algebra', nav: 'Algebra', short: 'Products, commutators, conjugation', blurb: 'Products, commutators and conjugation of Pauli matrices, read as geometry.', group: 'Modules', component: PauliModule },
  { id: 'stern-gerlach', path: '/stern-gerlach', letter: 'F', title: 'The Stern–Gerlach experiment', nav: 'Measurement', short: 'Sequential spin measurements', blurb: 'Atoms through sequences of magnets: collapse, the Born rule and incompatible observables.', group: 'Modules', component: SternGerlachModule },
  { id: 'eigen', path: '/eigen', letter: 'G', title: 'Eigenvectors and measurement bases', nav: 'Bases', short: 'Born rule geometry', blurb: 'Eigenvalues are the readings, eigenvectors the post-measurement states, and probability is a projection.', group: 'Modules', component: EigenModule },
  { id: 'exercises', path: '/exercises', title: 'Guided exercises', nav: 'Problems', short: '11 step-by-step problems', blurb: 'Eleven guided problems, one question at a time, with numerically checked answers and hints.', group: 'Practice', component: ExercisesModule },
  { id: 'concepts', path: '/concepts', title: 'Concept challenges', nav: 'Questions', short: 'Transfer questions', blurb: 'Transfer questions: commit to a prediction, then see why.', group: 'Practice', component: ConceptsModule },
];

export function findModule(path: string): { mod: ModuleDef; subpath: string } | null {
  for (const m of MODULES) {
    if (path === m.path || path.startsWith(m.path + '/')) return { mod: m, subpath: path.slice(m.path.length).replace(/^\//, '') };
  }
  return null;
}

/** Chapter number of a module (01–07), or null for the practice pages. */
export function chapterNumber(m: ModuleDef): string | null {
  const i = MODULES.filter((x) => x.group === 'Modules').indexOf(m);
  return i < 0 ? null : String(i + 1).padStart(2, '0');
}
