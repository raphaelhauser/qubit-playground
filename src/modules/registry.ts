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
  short: string;
  group: 'Modules' | 'Practice';
  component: ComponentType<{ subpath: string }>;
}

export const MODULES: ModuleDef[] = [
  { id: 'bloch', path: '/bloch', letter: 'A', title: 'Qubits & the Bloch sphere', short: 'Amplitudes, phases, geometry', group: 'Modules', component: BlochModule },
  { id: 'gates', path: '/gates', letter: 'B', title: 'Gates & rotations', short: 'Pauli, Hadamard, R_n(θ)', group: 'Modules', component: GatesModule },
  { id: 'hamiltonian', path: '/hamiltonian', letter: 'C', title: 'Schrödinger equation', short: 'Hamiltonian playground', group: 'Modules', component: HamiltonianModule },
  { id: 'exponential', path: '/exponential', letter: 'D', title: 'Matrix exponentials', short: 'Series, eigenbasis, rotations', group: 'Modules', component: ExponentialModule },
  { id: 'pauli', path: '/pauli', letter: 'E', title: 'Pauli algebra', short: 'Products, commutators, conjugation', group: 'Modules', component: PauliModule },
  { id: 'stern-gerlach', path: '/stern-gerlach', letter: 'F', title: 'Stern–Gerlach', short: 'Sequential spin measurements', group: 'Modules', component: SternGerlachModule },
  { id: 'eigen', path: '/eigen', letter: 'G', title: 'Eigenvectors & bases', short: 'Born rule geometry', group: 'Modules', component: EigenModule },
  { id: 'exercises', path: '/exercises', title: 'Guided exercises', short: '11 step-by-step problems', group: 'Practice', component: ExercisesModule },
  { id: 'concepts', path: '/concepts', title: 'Concept challenges', short: 'Transfer questions', group: 'Practice', component: ConceptsModule },
];

export function findModule(path: string): { mod: ModuleDef; subpath: string } | null {
  for (const m of MODULES) {
    if (path === m.path || path.startsWith(m.path + '/')) return { mod: m, subpath: path.slice(m.path.length).replace(/^\//, '') };
  }
  return null;
}
