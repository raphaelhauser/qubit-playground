/**
 * Guided problems: time evolution (3), Pauli algebra & the matrix exponential (5), spin measurement (3).
 * Every answer is checked numerically against src/quantum.
 */
import {
  c,
  mat,
  expi,
  mul,
  matScale,
  matScaleR,
  matR,
  Mat2,
  Vec2,
  PX,
  PY,
  PZ,
  matMul,
  ZERO,
  ONE,
  Rx,
  Rz,
  Rn,
  expm,
  fromOmegas,
  evolutionOperator,
  transitionAmplitude,
  hamiltonianAxis,
} from '../../quantum';
import type { Problem, VarSpec, NumVars } from './engine';
import { M, D } from './tex';
import {
  UnitarityViz,
  DiagonalViz,
  PerturbationViz,
  PauliProductViz,
  CommutatorViz,
  SeriesConjugationViz,
  HadamardFrameViz,
  ConjugationSequenceViz,
  EigenViz,
  XMeasureViz,
  SGChainViz,
} from './widgets';

const S = Math.SQRT1_2;
const T_: VarSpec = { name: 't', tex: 't', min: 0.2, max: 3 };
const W1: VarSpec = { name: 'w1', tex: '\\omega_1', min: -1.5, max: 1.5, aliases: ['ω1', 'omega1'] };
const W2: VarSpec = { name: 'w2', tex: '\\omega_2', min: -1.5, max: 1.5, aliases: ['ω2', 'omega2'] };
const EPS: VarSpec = { name: 'eps', tex: '\\varepsilon', min: 0.15, max: 1.2, aliases: ['ε', 'ϵ', 'epsilon'] };
const TH: VarSpec = { name: 'theta', tex: '\\theta', min: -3, max: 3, aliases: ['θ', 'th'] };
const DERIVED = [
  { name: 'wbar', tex: '\\bar\\omega', aliases: ['ω̄', 'omegabar', 'wb'] },
  { name: 'dw', tex: '\\Delta\\omega', aliases: ['Δω', 'deltaomega'] },
  { name: 'r', tex: 'r' },
];
const derive = (v: NumVars): NumVars => {
  const wbar = (v.w1 + v.w2) / 2;
  const dw = (v.w1 - v.w2) / 2;
  return { wbar, dw, r: Math.hypot(dw, v.eps) };
};
const diag = (a: ReturnType<typeof c>, b: ReturnType<typeof c>): Mat2 => mat(a, ZERO, ZERO, b);
const vec = (a: ReturnType<typeof c>, b: ReturnType<typeof c>): Vec2 => [a, b];
const Hd: Mat2 = matScaleR(matR(1, 1, 1, -1), S);

// ===========================================================================
// Time evolution
// ===========================================================================

const pUnitarity: Problem = {
  id: 'unitarity',
  group: 'Time evolution',
  part: '1',
  title: 'Time evolution is unitary',
  statement: (
    <p>
      For a Hamiltonian {M`H`} that is Hermitian and does not depend on time, every solution of {M`i\frac{d}{dt}\ket{\psi(t)} = H\ket{\psi(t)}`} has the form{' '}
      {M`\ket{\psi(t)} = U_t\ket{\psi(0)}`} with the propagator {M`U_t = e^{-iHt}`} (units with {M`\hbar = 1`}). Prove that {M`U_t`} is unitary for every real {M`t`}.
    </p>
  ),
  intro: (
    <>
      <p>
        <strong>Unitary</strong> means {M`U^\dagger U = I`}: the operator preserves inner products, hence lengths, hence the total probability{' '}
        {M`\|\psi\|^2 = |\alpha|^2 + |\beta|^2 = 1`}. Physically: time evolution must never create or destroy probability.
      </p>
      <p>The whole argument rests on two facts about the matrix exponential: how it behaves under {M`\dagger`}, and when {M`e^Ae^B = e^{A+B}`} is allowed.</p>
    </>
  ),
  Viz: UnitarityViz,
  steps: [
    {
      id: 'adj',
      kind: 'choice',
      prompt: <>Start from the series {M`e^{A} = \sum_{k\ge 0} A^k/k!`}. What is {M`(e^{A})^\dagger`}?</>,
      options: [
        { id: 'a', label: M`e^{A^\dagger}`, feedback: <>Yes: take the adjoint term by term. {M`(A^k)^\dagger = (A^\dagger)^k`} and {M`k!`} is real.</> },
        { id: 'b', label: M`e^{-A}`, feedback: <>That's the inverse {M`(e^A)^{-1}`}. It equals the adjoint only when {M`A^\dagger = -A`} — which is what we will find for {M`A = -iHt`}, but it is not true in general.</> },
        { id: 'c', label: M`e^{A^T}`, feedback: <>The adjoint is the <em>conjugate</em> transpose. The transpose alone misses the complex conjugation.</> },
        { id: 'd', label: M`e^{\bar A}`, feedback: 'Complex conjugation alone misses the transpose.' },
      ],
      answer: 'a',
      hints: [<>The adjoint is additive and anti-linear: {M`(B + C)^\dagger = B^\dagger + C^\dagger`}, {M`(\lambda B)^\dagger = \bar\lambda B^\dagger`}.</>, <>{M`(BC)^\dagger = C^\dagger B^\dagger`}, so {M`(A^k)^\dagger = (A^\dagger)^k`}.</>],
      solution: D`(e^{A})^\dagger = \Big(\sum_k \tfrac{A^k}{k!}\Big)^\dagger = \sum_k \tfrac{(A^k)^\dagger}{k!} = \sum_k \tfrac{(A^\dagger)^k}{k!} = e^{A^\dagger}`,
    },
    {
      id: 'udag',
      kind: 'choice',
      prompt: <>Apply this with {M`A = -iHt`}, where {M`H = H^\dagger`} and {M`t\in\mathbb R`}. What is {M`U_t^\dagger`}?</>,
      options: [
        { id: 'a', label: M`e^{+iHt}` },
        { id: 'b', label: M`e^{-iHt}`, feedback: <>The adjoint also conjugates the scalar: {M`\overline{(-i)} = +i`}.</> },
        { id: 'c', label: M`e^{iH^Tt}`, feedback: <>{M`(-iHt)^\dagger = +i\,t\,H^\dagger`}, and {M`H^\dagger = H`}. For a Hermitian matrix {M`H^T = \bar H`}, which is generally not {M`H`}.</> },
        { id: 'd', label: M`e^{-iH^\dagger t}`, feedback: <>You took {M`H^\dagger`} but forgot to conjugate {M`-i`}.</> },
      ],
      answer: 'a',
      hints: [<>Compute {M`(-iHt)^\dagger`} first. Which factors are real, which are complex?</>],
      solution: D`(-iHt)^\dagger = \overline{(-i)}\,t\,H^\dagger = iHt \quad\Rightarrow\quad U_t^\dagger = e^{iHt}`,
    },
    {
      id: 'product',
      kind: 'choice',
      prompt: <>In general {M`e^Ae^B \neq e^{A+B}`}. Why may we write {M`U_t^\dagger U_t = e^{iHt}e^{-iHt} = e^{0} = I`}?</>,
      options: [
        { id: 'a', label: <>Because {M`iHt`} and {M`-iHt`} commute.</>, feedback: <>Right — {M`e^Ae^B = e^{A+B}`} holds whenever {M`[A,B] = 0`}, and any two multiples of the same matrix commute.</> },
        { id: 'b', label: <>Because {M`H`} is Hermitian.</>, feedback: <>Hermiticity was used for {M`U_t^\dagger = e^{iHt}`}. The product rule needs something else: commutation.</> },
        { id: 'c', label: 'Because it always holds for matrix exponentials.', feedback: <>Counterexample: {M`e^{X}e^{Z} \neq e^{X+Z}`}, since {M`[X,Z] \neq 0`}.</> },
        { id: 'd', label: <>Because {M`t`} is real.</>, feedback: 'Real t was used to conjugate −it correctly, but it does not justify the product rule.' },
      ],
      answer: 'a',
      hints: [<>Expand {M`e^Ae^B`} with both series. Where do you need to swap {M`A`} and {M`B`} to collect terms of {M`(A+B)^n`}?</>],
      solution: (
        <>
          <p>The Cauchy product of the two series reproduces the binomial expansion of {M`(A+B)^n`} only if {M`AB = BA`}. Here {M`A = iHt`} and {M`B = -iHt`} trivially commute, so</p>
          {D`U_t^\dagger U_t = e^{iHt}e^{-iHt} = e^{iHt - iHt} = e^0 = I,\qquad U_tU_t^\dagger = I \text{ likewise.}`}
        </>
      ),
    },
    {
      id: 'example',
      kind: 'matrix',
      label: 'U_t^\\dagger =',
      vars: [T_],
      prompt: <>A concrete check. For {M`H = Z`}: {M`U_t = e^{-iZt} = \mathrm{diag}(e^{-it}, e^{it})`}. Enter {M`U_t^\dagger`} (use {M`t`}; e.g. <code>e^(i t)</code>).</>,
      expected: (v) => diag(expi(v.t), expi(-v.t)),
      mistakes: [{ f: (v) => diag(expi(-v.t), expi(v.t)), message: <>That's {M`U_t`} itself. The adjoint conjugates every entry: {M`e^{-it}\mapsto e^{+it}`}.</> }],
      hints: ['Transpose, then complex-conjugate every entry.', <>A diagonal matrix equals its transpose, so only conjugation acts: {M`\overline{e^{-it}} = e^{it}`}.</>],
      solution: D`U_t^\dagger = \begin{pmatrix} e^{it} & 0 \\ 0 & e^{-it}\end{pmatrix},\qquad U_t^\dagger U_t = \begin{pmatrix} e^{it}e^{-it} & 0 \\ 0 & e^{-it}e^{it}\end{pmatrix} = I.`,
    },
    {
      id: 'nonherm',
      kind: 'choice',
      prompt: <>What would go wrong if {M`H`} were <em>not</em> Hermitian? (Try the {M`\kappa`} slider in the visualization.)</>,
      options: [
        { id: 'a', label: <>{M`\|\psi(t)\|^2`} — the total probability — would change in time.</>, feedback: 'Exactly. The arrow leaves the sphere: probabilities would no longer sum to one.' },
        { id: 'b', label: 'Nothing: every matrix exponential e^{−iHt} is unitary.', feedback: 'Set κ ≠ 0 in the visualization: U†U ≠ I and the norm drifts.' },
        { id: 'c', label: 'Only the global phase would be affected.', feedback: 'A global phase never changes the norm. Here the norm itself changes.' },
        { id: 'd', label: 'The Bloch vector would rotate faster but stay on the sphere.', feedback: 'Rotations preserve length; a non-Hermitian generator does not.' },
      ],
      answer: 'a',
      hints: ['Write H = A + iB with A, B Hermitian. What does e^{Bt} do to lengths?'],
      solution: (
        <p>
          If {M`H^\dagger \ne H`}, then {M`U_t^\dagger = e^{iH^\dagger t}`} and {M`U_t^\dagger U_t = e^{iH^\dagger t}e^{-iHt} \neq I`} in general. E.g. {M`H = -i\kappa Z`} gives{' '}
          {M`U_t = \mathrm{diag}(e^{-\kappa t}, e^{\kappa t})`}: one amplitude decays and the other grows.
        </p>
      ),
    },
  ],
  solution: (
    <>
      {D`U_t^\dagger = \Big(\sum_k \frac{(-iHt)^k}{k!}\Big)^\dagger = \sum_k \frac{\big((-iHt)^\dagger\big)^k}{k!} = \sum_k \frac{(iHt)^k}{k!} = e^{iHt}`}
      <p>
        using {M`H^\dagger = H`} and {M`t \in \mathbb R`}. Since {M`iHt`} and {M`-iHt`} commute, {M`U_t^\dagger U_t = e^{iHt}e^{-iHt} = e^{0} = I`}, and likewise {M`U_tU_t^\dagger = I`}.
      </p>
    </>
  ),
  intuition: (
    <p>
      A Hermitian generator produces a rotation of the Bloch sphere — the arrow can turn but never shrink. That is the geometric meaning of unitarity: probabilities are preserved for all{' '}
      {M`t`}. In the visualization, a non-Hermitian part {M`-i\kappa Z`} drags the arrow off the sphere.
    </p>
  ),
  explore: [{ path: '/hamiltonian', label: 'Hamiltonian playground' }, { path: '/exponential', label: 'Matrix exponentials' }],
};

const pDiagonal: Problem = {
  id: 'diagonal-hamiltonian',
  group: 'Time evolution',
  part: '2',
  title: 'Diagonal Hamiltonian',
  statement: (
    <p>
      Take the diagonal Hamiltonian {M`H = \begin{pmatrix}\omega_1 & 0\\ 0 & \omega_2\end{pmatrix}`} with real level frequencies {M`\omega_1,\omega_2`}. Work out the propagator{' '}
      {M`U_t`} and evolve two initial states: (i) {M`\ket{\psi(0)} = \ket0`} and (ii) {M`\ket{\psi(0)} = \tfrac{1}{\sqrt2}(\ket0+\ket1)`}.
    </p>
  ),
  intro: (
    <p>
      For a diagonal {M`H`} the basis states {M`\ket0, \ket1`} are eigenstates with energies {M`\omega_1, \omega_2`}. Each component simply accumulates its own phase{' '}
      {M`e^{-i\omega_k t}`}. Whether that is observable depends on whether the phase is global or relative.
    </p>
  ),
  Viz: DiagonalViz,
  steps: [
    {
      id: 'U',
      kind: 'matrix',
      label: 'U_t =',
      vars: [T_, W1, W2],
      prompt: <>Compute {M`U_t = e^{-iHt}`} (variables <code>w1</code>, <code>w2</code>, <code>t</code>).</>,
      expected: (v) => diag(expi(-v.w1 * v.t), expi(-v.w2 * v.t)),
      mistakes: [
        { f: (v) => diag(expi(v.w1 * v.t), expi(v.w2 * v.t)), message: <>Sign: {M`U_t = e^{-iHt}`}, so both exponents carry {M`-i`}.</> },
        { f: (v) => diag(expi(-v.w2 * v.t), expi(-v.w1 * v.t)), message: <>{M`\omega_1`} belongs to {M`\ket0`}, the top-left entry.</> },
      ],
      hints: [<>{M`H`} is diagonal, so every power is too: {M`H^k = \mathrm{diag}(\omega_1^k, \omega_2^k)`}.</>, <>Summing the series entrywise: {M`e^{-iHt} = \mathrm{diag}(e^{-i\omega_1 t}, e^{-i\omega_2 t})`}. Type e.g. <code>e^(-i w1 t)</code>.</>],
      solution: D`U_t = \sum_k \frac{(-it)^k}{k!}\begin{pmatrix}\omega_1^k & 0\\0&\omega_2^k\end{pmatrix} = \begin{pmatrix} e^{-i\omega_1 t} & 0 \\ 0 & e^{-i\omega_2 t}\end{pmatrix}`,
    },
    {
      id: 'psi0',
      kind: 'vector',
      label: '\\ket{\\psi(t)} =',
      vars: [T_, W1, W2],
      prompt: <>(i) Initial state {M`\ket0`}. Enter {M`\ket{\psi(t)} = U_t\ket0`} as a column vector.</>,
      expected: (v) => vec(expi(-v.w1 * v.t), ZERO),
      mistakes: [{ f: () => vec(ONE, ZERO), message: <>Physically that is the same state — but mathematically {M`\ket0`} picks up the phase {M`e^{-i\omega_1 t}`}. Include it.</> }],
      hints: [<>{M`U_t\ket0`} is the first column of {M`U_t`}.</>],
      solution: D`\ket{\psi(t)} = e^{-i\omega_1 t}\ket0 = \begin{pmatrix} e^{-i\omega_1 t}\\ 0\end{pmatrix}`,
    },
    {
      id: 'phys0',
      kind: 'choice',
      prompt: <>Is {M`e^{-i\omega_1 t}\ket0`} physically different from {M`\ket0`}?</>,
      options: [
        { id: 'a', label: 'No — it differs only by a global phase.', feedback: <>Right. For every measurement basis {M`\ket\phi`}: {M`|\langle\phi|e^{-i\omega_1t}0\rangle|^2 = |\langle\phi|0\rangle|^2`}. Eigenstates of {M`H`} are <em>stationary</em>.</> },
        { id: 'b', label: <>Yes — it oscillates between {M`\ket0`} and {M`\ket1`}.</>, feedback: <>The {M`\ket1`} amplitude stays exactly zero: {M`H`} has no off-diagonal entries to couple the levels.</> },
        { id: 'c', label: 'Yes — its relative phase changes.', feedback: 'There is only one non-zero amplitude, so there is no relative phase to change.' },
      ],
      answer: 'a',
      hints: ['Compare all measurement probabilities |⟨φ|ψ(t)⟩|² with those of |0⟩.'],
      solution: <p>Global phases cancel in every {M`|\langle\phi|\psi\rangle|^2`}. In the visualization, the arrow for {M`\ket0`} does not move at all, while the amplitude {M`\alpha`} spins in the complex plane.</p>,
    },
    {
      id: 'psiplus',
      kind: 'vector',
      label: '\\ket{\\psi(t)} =',
      vars: [T_, W1, W2],
      prompt: <>(ii) Initial state {M`\ket+ = \tfrac{1}{\sqrt2}(\ket0+\ket1)`}. Enter {M`\ket{\psi(t)}`}. (Use the factor box for {M`1/\sqrt2`}, e.g. <code>1/sqrt2</code>.)</>,
      expected: (v) => vec(mul(c(S), expi(-v.w1 * v.t)), mul(c(S), expi(-v.w2 * v.t))),
      mistakes: [
        { f: (v) => vec(expi(-v.w1 * v.t), expi(-v.w2 * v.t)), message: <>Missing the normalization {M`1/\sqrt2`}.</> },
        { f: (v) => vec(mul(c(S), expi(-v.w1 * v.t)), mul(c(S), expi(-v.w1 * v.t))), message: <>Each component evolves with <em>its own</em> energy: the {M`\ket1`} part gets {M`e^{-i\omega_2 t}`}.</> },
      ],
      hints: [<>Linearity: {M`U_t\ket+ = \tfrac{1}{\sqrt2}(U_t\ket0 + U_t\ket1)`}.</>],
      solution: D`\ket{\psi(t)} = \tfrac{1}{\sqrt2}\big(e^{-i\omega_1 t}\ket0 + e^{-i\omega_2 t}\ket1\big)`,
    },
    {
      id: 'relphase',
      kind: 'expr',
      mode: 'phase',
      label: '\\varphi(t) =',
      vars: [T_, W1, W2],
      prompt: <>Factor out the global phase: {M`\ket{\psi(t)} = e^{-i\omega_1 t}\,\tfrac{1}{\sqrt2}\big(\ket0 + e^{i\varphi(t)}\ket1\big)`}. Enter the relative phase {M`\varphi(t)`}.</>,
      expected: (v) => c((v.w1 - v.w2) * v.t),
      mistakes: [
        { f: (v) => c((v.w2 - v.w1) * v.t), message: <>Sign: {M`e^{-i\omega_2 t}/e^{-i\omega_1 t} = e^{i(\omega_1-\omega_2)t}`}.</> },
        { f: (v) => c(((v.w1 - v.w2) * v.t) / 2), message: 'No factor 1/2 here: the relative phase is the full difference of the two phases.' },
      ],
      hints: [<>{M`\varphi = \arg(\beta) - \arg(\alpha)`}.</>, <>{M`\arg(e^{-i\omega_2 t}) - \arg(e^{-i\omega_1 t})`}.</>],
      solution: D`\varphi(t) = -\omega_2 t - (-\omega_1 t) = (\omega_1-\omega_2)\,t = 2\Delta\omega\, t`,
    },
    {
      id: 'tminus',
      kind: 'numeric',
      label: 't =',
      answer: Math.PI / 1.5,
      tol: 2e-3,
      prompt: <>Take {M`\omega_1 = 1`}, {M`\omega_2 = -0.5`} (the visualization's default). At which smallest {M`t>0`} is {M`\ket{\psi(t)}`} equal to {M`\ket-`} up to a global phase?</>,
      mistakes: [
        { value: (2 * Math.PI) / 1.5, message: <>At {M`\varphi = 2\pi`} the state is back at {M`\ket+`}. {M`\ket-`} needs {M`\varphi = \pi`}.</> },
        { value: Math.PI / 3, message: <>That gives {M`\varphi = \pi/2`}, i.e. {M`\ket{+i}`}. {M`\ket-`} needs {M`\varphi = \pi`}.</> },
        { value: Math.PI / 0.5, message: <>Use the difference {M`\omega_1 - \omega_2 = 1.5`}, not a single frequency.</> },
      ],
      hints: [<>{M`\ket- = \tfrac{1}{\sqrt2}(\ket0 + e^{i\pi}\ket1)`}.</>, <>Solve {M`(\omega_1 - \omega_2)t = \pi`}.</>],
      solution: D`(\omega_1-\omega_2)\,t = \pi \;\Rightarrow\; t = \frac{\pi}{1.5} \approx 2.094`,
    },
    {
      id: 'bloch',
      kind: 'choice',
      prompt: 'How does the state in (ii) move on the Bloch sphere?',
      options: [
        { id: 'a', label: <>It precesses about the z axis with angular frequency {M`\omega_1-\omega_2`}.</>, feedback: <>Yes: the azimuth is {M`\varphi(t)`}. Equivalently {M`U_t = e^{-i\bar\omega t}R_z\big((\omega_1-\omega_2)t\big)`}.</> },
        { id: 'b', label: <>It precesses about z with angular frequency {M`(\omega_1-\omega_2)/2`}.</>, feedback: <>The Bloch azimuth <em>is</em> the relative phase — no half angle. (The half angle lives inside {M`R_z(\theta) = \mathrm{diag}(e^{-i\theta/2}, e^{i\theta/2})`}.)</> },
        { id: 'c', label: <>It precesses with frequency {M`\omega_1+\omega_2`}.</>, feedback: <>The sum only enters the global phase {M`e^{-i(\omega_1+\omega_2)t/2}`}.</> },
        { id: 'd', label: 'It does not move.', feedback: 'Play the visualization with |+⟩.' },
      ],
      answer: 'a',
      hints: ['Recall: on the Bloch sphere, the azimuth φ is the relative phase.'],
      solution: <p>{M`\ket{\psi(t)}`} has polar angle {M`\pi/2`} and azimuth {M`\varphi(t) = (\omega_1-\omega_2)t`}: uniform rotation around the equator.</p>,
    },
  ],
  solution: (
    <>
      {D`U_t = \begin{pmatrix} e^{-i\omega_1 t} & 0\\ 0 & e^{-i\omega_2 t}\end{pmatrix} = e^{-i\bar\omega t}\begin{pmatrix} e^{-i\Delta\omega t} & 0\\ 0 & e^{i\Delta\omega t}\end{pmatrix} = e^{-i\bar\omega t}R_z(2\Delta\omega t)`}
      <p>with {M`\bar\omega = (\omega_1+\omega_2)/2`}, {M`\Delta\omega = (\omega_1-\omega_2)/2`}.</p>
      {D`\text{(i)}\ \ket{\psi(t)} = e^{-i\omega_1t}\ket0, \qquad \text{(ii)}\ \ket{\psi(t)} = \tfrac{1}{\sqrt2}\big(e^{-i\omega_1t}\ket0 + e^{-i\omega_2t}\ket1\big) = e^{-i\omega_1t}\tfrac{1}{\sqrt2}\big(\ket0 + e^{i(\omega_1-\omega_2)t}\ket1\big)`}
    </>
  ),
  intuition: (
    <p>
      Energy eigenstates only acquire phases. A single eigenstate's phase is global and invisible — it is stationary. A superposition turns its relative phase at the rate of the{' '}
      <em>energy difference</em>, which on the Bloch sphere is a precession about z: only differences of energies are observable.
    </p>
  ),
  explore: [{ path: '/hamiltonian', label: 'Hamiltonian playground (Experiment 1)' }, { path: '/bloch', label: 'Global vs relative phase' }],
};

const pPerturbation: Problem = {
  id: 'perturbation',
  group: 'Time evolution',
  part: '3',
  title: 'Adding a perturbation',
  statement: (
    <p>
      Switch on an off-diagonal coupling of strength {M`\epsilon`}: {M`H = \begin{pmatrix}\omega_1 & 0\\ 0 & \omega_2\end{pmatrix} + \epsilon X`}. Starting from{' '}
      {M`\ket{\psi(0)} = \ket0`}, find {M`U_t`} and the transition amplitude {M`\langle 1|\psi(t)\rangle`}. Strategy: split {M`H`} into an identity part and a Pauli part,{' '}
      {M`H = \bar\omega I + \sqrt{\Delta\omega^2+\epsilon^2}\,(\vec v\cdot\vec\sigma)`} with {M`\Delta\omega = (\omega_1-\omega_2)/2`}, and recognize a rotation operator {M`R_{\vec v}(\theta)`}.
    </p>
  ),
  intro: (
    <p>
      The off-diagonal {M`\epsilon X`} couples {M`\ket0`} and {M`\ket1`}: the Pauli part of {M`H`} now points along a tilted unit vector {M`\vec v`} in the xz-plane, and the Bloch vector
      precesses about it. We use the numbers {M`\omega_1 = 1.2,\ \omega_2 = 0.4,\ \epsilon = 0.3`} (the visualization's defaults), then derive the general formulas.
    </p>
  ),
  Viz: () => <PerturbationViz />,
  steps: [
    {
      id: 'wbar',
      kind: 'numeric',
      label: '\\bar\\omega =',
      answer: 0.8,
      prompt: <>The identity coefficient is {M`\bar\omega = \tfrac12\mathrm{tr}H`}. With {M`\omega_1 = 1.2,\ \omega_2 = 0.4`}: what is {M`\bar\omega`}?</>,
      mistakes: [
        { value: 1.6, message: <>{M`\bar\omega`} is the <em>mean</em>, {M`(\omega_1+\omega_2)/2`}.</> },
        { value: 0.4, message: <>That's {M`\Delta\omega`}. {M`\bar\omega`} is the average of the diagonal.</> },
      ],
      hints: [<>{M`\bar\omega = \tfrac12\mathrm{tr}(H) = (\omega_1+\omega_2)/2`}.</>],
      solution: D`\bar\omega = \tfrac{\omega_1+\omega_2}{2} = 0.8`,
    },
    {
      id: 'dw',
      kind: 'numeric',
      label: '\\Delta\\omega =',
      answer: 0.4,
      prompt: <>The Z coefficient is {M`\Delta\omega = \tfrac12\mathrm{tr}(ZH)`}. What is {M`\Delta\omega`}?</>,
      mistakes: [{ value: 0.8, message: <>{M`\Delta\omega = (\omega_1-\omega_2)/2`} — don't forget the {M`1/2`}: the diagonal entries are {M`\bar\omega\pm\Delta\omega`}.</> }],
      hints: [<>{M`\mathrm{diag}(\omega_1,\omega_2) = \bar\omega I + \Delta\omega Z`}: compare the top-left entries.</>],
      solution: D`\Delta\omega = \tfrac{\omega_1-\omega_2}{2} = 0.4`,
    },
    {
      id: 'r',
      kind: 'numeric',
      label: 'r =',
      answer: 0.5,
      prompt: <>Now {M`H = \bar\omega I + \epsilon X + \Delta\omega Z = \bar\omega I + r(\vec v\cdot\vec\sigma)`} with {M`|\vec v| = 1`}. What is {M`r`}?</>,
      mistakes: [
        { value: 0.25, message: <>That's {M`r^2`}. Take the square root.</> },
        { value: 0.7, message: <>{M`r = \sqrt{\Delta\omega^2+\epsilon^2}`}, not the sum.</> },
        { value: Math.hypot(0.8, 0.3), message: <>Use {M`\Delta\omega = 0.4`}, not {M`\omega_1-\omega_2`}.</> },
      ],
      hints: [<>{M`r`} is the length of the coefficient vector {M`(\epsilon, 0, \Delta\omega)`}.</>],
      solution: D`r = \sqrt{\Delta\omega^2+\epsilon^2} = \sqrt{0.16 + 0.09} = 0.5`,
    },
    {
      id: 'v',
      kind: 'vec3',
      label: '\\vec v =',
      expected: [0.6, 0, 0.8],
      prompt: <>Enter the unit vector {M`\vec v`}.</>,
      mistakes: [
        { value: [0.3, 0, 0.4], message: <>{M`\vec v`} must be a unit vector: divide {M`(\epsilon, 0, \Delta\omega)`} by {M`r`}.</> },
        { value: [0.8, 0, 0.6], message: <>The X coefficient is {M`\epsilon`} (off-diagonal), the Z coefficient {M`\Delta\omega`} (diagonal).</> },
      ],
      hints: [<>{M`r\vec v = (\epsilon, 0, \Delta\omega)`}.</>],
      solution: D`\vec v = \tfrac{1}{r}(\epsilon, 0, \Delta\omega) = (0.6,\ 0,\ 0.8)`,
    },
    {
      id: 'angle',
      kind: 'choice',
      prompt: <>With {M`R_{\vec v}(\theta) = e^{-i\theta(\vec v\cdot\vec\sigma)/2} = \cos\tfrac\theta2 I - i\sin\tfrac\theta2(\vec v\cdot\vec\sigma)`}, we get {M`U_t = e^{-i\bar\omega t}R_{\vec v}(\theta)`}. What is {M`\theta`}?</>,
      options: [
        { id: 'a', label: M`\theta = 2rt` },
        { id: 'b', label: M`\theta = rt`, feedback: <>Compare exponents: {M`e^{-irt(\vec v\cdot\vec\sigma)} = e^{-i\theta(\vec v\cdot\vec\sigma)/2}`} needs {M`\theta/2 = rt`}.</> },
        { id: 'c', label: M`\theta = rt/2`, feedback: 'The factor 1/2 goes the other way.' },
        { id: 'd', label: M`\theta = 2\bar\omega t`, feedback: <>The identity part only produces the global phase {M`e^{-i\bar\omega t}`}.</> },
      ],
      answer: 'a',
      hints: [<>{M`I`} commutes with {M`\vec v\cdot\vec\sigma`}, so {M`e^{-iHt} = e^{-i\bar\omega t}\,e^{-irt(\vec v\cdot\vec\sigma)}`}.</>, <>Match {M`-irt`} with {M`-i\theta/2`}.</>],
      solution: D`U_t = e^{-i\bar\omega t}e^{-irt(\vec v\cdot\vec\sigma)} = e^{-i\bar\omega t}R_{\vec v}(2rt)`,
    },
    {
      id: 'Ut',
      kind: 'matrix',
      label: 'U_t =',
      vars: [T_, W1, W2, EPS],
      derive,
      derivedSpecs: DERIVED,
      prompt: <>Enter {M`U_t`} in general. Shorthands allowed: <code>wbar</code> = {M`\bar\omega`}, <code>dw</code> = {M`\Delta\omega`}, <code>r</code>, together with <code>eps</code>, <code>t</code>.</>,
      expected: (v) => evolutionOperator(fromOmegas(v.w1, v.w2, v.eps), v.t),
      mistakes: [
        {
          f: (v) => {
            const p = fromOmegas(v.w1, v.w2, v.eps);
            return Rn(hamiltonianAxis(p).v!, 2 * hamiltonianAxis(p).r * v.t);
          },
          message: <>Almost: the global phase {M`e^{-i\bar\omega t}`} is missing. It does not change any probability, but {M`U_t = e^{-iHt}`} contains it.</>,
        },
        {
          f: (v) => {
            const p = fromOmegas(v.w1, v.w2, v.eps);
            return matScale(Rn(hamiltonianAxis(p).v!, hamiltonianAxis(p).r * v.t), expi(-p.omegaBar * v.t));
          },
          message: <>The rotation angle is {M`2rt`}: the entries contain {M`\cos(rt)`} and {M`\sin(rt)`}, not {M`\cos(rt/2)`}.</>,
        },
      ],
      hints: [
        <>{M`U_t = e^{-i\bar\omega t}\big[\cos(rt)\,I - i\sin(rt)\,(v_xX + v_zZ)\big]`}, {M`v_x = \epsilon/r`}, {M`v_z = \Delta\omega/r`}.</>,
        <>Top-left entry: <code>e^(-i wbar t)(cos(r t) - i dw/r sin(r t))</code>. Off-diagonal: <code>-i e^(-i wbar t) eps/r sin(r t)</code>.</>,
      ],
      solution: D`U_t = e^{-i\bar\omega t}\begin{pmatrix} \cos(rt) - i\frac{\Delta\omega}{r}\sin(rt) & -i\frac{\epsilon}{r}\sin(rt) \\ -i\frac{\epsilon}{r}\sin(rt) & \cos(rt) + i\frac{\Delta\omega}{r}\sin(rt)\end{pmatrix}`,
    },
    {
      id: 'overlap',
      kind: 'expr',
      label: '\\langle 1|\\psi(t)\\rangle =',
      vars: [T_, W1, W2, EPS],
      derive,
      derivedSpecs: DERIVED,
      prompt: <>For {M`\ket{\psi(0)} = \ket0`}, compute the overlap {M`\langle 1|\psi(t)\rangle = \langle 1|U_t|0\rangle`}.</>,
      expected: (v) => transitionAmplitude(fromOmegas(v.w1, v.w2, v.eps), v.t),
      mistakes: [
        { f: (v) => c(0, -(v.eps / Math.hypot((v.w1 - v.w2) / 2, v.eps)) * Math.sin(Math.hypot((v.w1 - v.w2) / 2, v.eps) * v.t)), message: <>The magnitude is right, but the global phase factor {M`e^{-i\bar\omega t}`} is missing.</> },
        {
          f: (v) => {
            const p = fromOmegas(v.w1, v.w2, v.eps);
            const r = Math.hypot(p.deltaOmega, p.epsilon);
            return mul(c(0, -(p.epsilon / r) * Math.sin(2 * r * v.t)), expi(-p.omegaBar * v.t));
          },
          message: <>The sine's argument is {M`rt`} (half the Bloch rotation angle {M`2rt`}).</>,
        },
        {
          f: (v) => {
            const p = fromOmegas(v.w1, v.w2, v.eps);
            const r = Math.hypot(p.deltaOmega, p.epsilon);
            return mul(c(0, -p.epsilon * Math.sin(r * v.t)), expi(-p.omegaBar * v.t));
          },
          message: <>Don't forget {M`1/r`}: the X component of {M`\vec v`} is {M`\epsilon/r`}.</>,
        },
      ],
      hints: [<>{M`\langle1|U_t|0\rangle`} is the bottom-left entry of {M`U_t`}.</>, <>Only the {M`X`} term of {M`\vec v\cdot\vec\sigma`} has a non-zero (2,1) entry.</>],
      solution: D`\langle 1|\psi(t)\rangle = e^{-i\bar\omega t}\big(-i\sin(rt)\,v_x\big) = -i\,e^{-i\bar\omega t}\,\frac{\epsilon}{\sqrt{\Delta\omega^2+\epsilon^2}}\,\sin\!\big(t\sqrt{\Delta\omega^2+\epsilon^2}\big)`,
    },
    {
      id: 'pmax',
      kind: 'numeric',
      label: 'P_{\\max} =',
      answer: 0.36,
      prompt: <>Hence {M`P(1,t) = |\langle1|\psi(t)\rangle|^2 = \frac{\epsilon^2}{\Delta\omega^2+\epsilon^2}\sin^2(rt)`}. For our numbers, what is the maximal transition probability?</>,
      mistakes: [
        { value: 0.09, message: <>That's {M`\epsilon^2`} alone — divide by {M`r^2 = \Delta\omega^2+\epsilon^2`}.</> },
        { value: 0.6, message: <>That's {M`\epsilon/r`}, the maximal <em>amplitude</em>. Square it.</> },
        { value: 1, message: <>Full transfer happens only for {M`\Delta\omega = 0`}. Here the axis is tilted only part-way.</> },
      ],
      hints: [<>{M`\sin^2`} reaches 1.</>],
      solution: D`P_{\max} = \frac{\epsilon^2}{\Delta\omega^2 + \epsilon^2} = \frac{0.09}{0.25} = 0.36`,
    },
    {
      id: 'tmax',
      kind: 'numeric',
      label: 't_{\\max} =',
      answer: Math.PI,
      tol: 2e-3,
      prompt: <>At what smallest {M`t > 0`} is {M`P(1,t)`} maximal (same numbers)?</>,
      mistakes: [
        { value: 2 * Math.PI, message: <>At {M`rt = \pi`} the probability is back to 0. The first maximum is at {M`rt = \pi/2`}.</> },
        { value: Math.PI / 2, message: <>{M`\sin^2(rt)`} peaks at {M`rt = \pi/2`}, so {M`t = \pi/(2r)`} with {M`r = 0.5`}.</> },
      ],
      hints: [<>{M`\sin^2(rt) = 1`} first at {M`rt = \pi/2`}.</>],
      solution: D`t_{\max} = \frac{\pi}{2r} = \pi \approx 3.142`,
    },
    {
      id: 'detuned',
      kind: 'choice',
      prompt: <>Now make the splitting large, {M`\Delta\omega \gg \epsilon`}. Transitions to {M`\ket1`} become…</>,
      options: [
        { id: 'a', label: <>rare and fast: {M`P_{\max}\approx \epsilon^2/\Delta\omega^2 \ll 1`}, oscillating at {M`r\approx\Delta\omega`}.</>, feedback: <>Yes — the axis {M`\vec v`} is almost {M`\hat z`}, so {M`\ket0`} only wobbles on a tiny cone.</> },
        { id: 'b', label: 'more likely, because the energy difference drives them.', feedback: 'Try it: increase ω₁ − ω₂ in the visualization and watch the maximum drop.' },
        { id: 'c', label: 'slower but eventually complete.', feedback: <>{M`P_{\max} = \epsilon^2/r^2 < 1`} whenever {M`\Delta\omega \neq 0`}.</> },
        { id: 'd', label: 'unchanged.', feedback: 'Both the amplitude and the frequency depend on Δω.' },
      ],
      answer: 'a',
      hints: ['What does v look like when Δω ≫ ε?'],
      solution: <p>{M`\vec v \approx (\epsilon/\Delta\omega, 0, 1)`}: nearly parallel to z. The precession cone around {M`\vec v`} through the north pole is narrow, so the state stays close to {M`\ket0`}.</p>,
    },
  ],
  solution: (
    <>
      {D`H = \bar\omega I + \epsilon X + \Delta\omega Z = \bar\omega I + r(\vec v\cdot\vec\sigma)`}
      {D`\bar\omega = \tfrac{\omega_1+\omega_2}{2},\quad \Delta\omega = \tfrac{\omega_1-\omega_2}{2},\quad r = \sqrt{\Delta\omega^2+\epsilon^2},\quad \vec v = \tfrac1r(\epsilon,0,\Delta\omega)`}
      {D`U_t = e^{-i\bar\omega t}\,e^{-irt(\vec v\cdot\vec\sigma)} = e^{-i\bar\omega t}R_{\vec v}(2rt) = e^{-i\bar\omega t}\big[\cos(rt)I - i\sin(rt)(\vec v\cdot\vec\sigma)\big]`}
      {D`\langle1|\psi(t)\rangle = -i\,e^{-i\bar\omega t}\frac{\epsilon}{r}\sin(rt),\qquad P(1,t) = \frac{\epsilon^2}{\Delta\omega^2+\epsilon^2}\sin^2\!\big(t\sqrt{\Delta\omega^2+\epsilon^2}\big)`}
    </>
  ),
  intuition: (
    <p>
      The Bloch vector starts at the north pole and precesses at angular speed {M`2r`} around {M`\vec v`}, which makes an angle {M`\beta`} with {M`\hat z`} ({M`\sin\beta = \epsilon/r`}). Its lowest point
      has polar angle {M`2\beta`}, so {M`P_{\max} = \sin^2\beta = \epsilon^2/r^2`}. A larger detuning {M`\Delta\omega`} tilts {M`\vec v`} back towards {M`\hat z`} and shrinks the cone.
    </p>
  ),
  explore: [{ path: '/hamiltonian', label: 'Hamiltonian playground (Experiment 3)' }],
};

// ===========================================================================
// Pauli algebra and the matrix exponential
// ===========================================================================

const ZERO2: Mat2 = matR(0, 0, 0, 0);

const pAnticomm: Problem = {
  id: 'anticommutators',
  group: 'Pauli algebra',
  part: '1',
  title: 'Pauli matrices anticommute',
  statement: (
    <p>
      Show that two different Pauli matrices always anticommute: {M`\{\sigma_1,\sigma_2\} = \{\sigma_2,\sigma_3\} = \{\sigma_3,\sigma_1\} = 0`}, with the anticommutator{' '}
      {M`\{A,B\} = AB + BA`} and the Pauli vector {M`\vec\sigma = (X, Y, Z)`}.
    </p>
  ),
  intro: <p>Products of two different Pauli matrices are {M`\pm i`} times the third. Whether the sign flips under swapping the order is the whole story of (anti)commutation.</p>,
  Viz: () => <PauliProductViz />,
  steps: [
    {
      id: 'xy',
      kind: 'matrix',
      label: 'XY =',
      prompt: <>Compute {M`\sigma_1\sigma_2 = XY`} with {M`X = \begin{pmatrix}0&1\\1&0\end{pmatrix}`}, {M`Y = \begin{pmatrix}0&-i\\i&0\end{pmatrix}`}.</>,
      expected: () => matScale(PZ, c(0, 1)),
      mistakes: [{ f: () => matScale(PZ, c(0, -1)), message: <>That's {M`YX = -iZ`}. Matrix multiplication order matters.</> }],
      hints: ['X swaps the rows of whatever it multiplies from the left.', <>So {M`XY`} = the rows of {M`Y`} swapped.</>],
      solution: D`XY = \begin{pmatrix} i & 0\\ 0 & -i\end{pmatrix} = iZ`,
    },
    {
      id: 'yx',
      kind: 'matrix',
      label: 'YX =',
      prompt: <>Now {M`\sigma_2\sigma_1 = YX`}.</>,
      expected: () => matScale(PZ, c(0, -1)),
      mistakes: [{ f: () => matScale(PZ, c(0, 1)), message: <>That's {M`XY`}. Here {M`Y`} is on the left.</> }],
      hints: ['Right-multiplying by X swaps the columns of Y.'],
      solution: D`YX = \begin{pmatrix} -i & 0\\ 0 & i\end{pmatrix} = -iZ`,
    },
    {
      id: 'anti12',
      kind: 'choice',
      prompt: <>So {M`\{\sigma_1,\sigma_2\} = XY + YX = `}</>,
      options: [
        { id: 'a', label: M`0` },
        { id: 'b', label: M`2iZ`, feedback: <>That's the commutator {M`XY - YX`}.</> },
        { id: 'c', label: M`2I`, feedback: <>That's {M`\{X, X\} = 2X^2`}.</> },
        { id: 'd', label: M`iZ`, feedback: 'Add both products.' },
      ],
      answer: 'a',
      hints: ['iZ + (−iZ).'],
      solution: D`\{X,Y\} = iZ - iZ = 0`,
    },
    {
      id: 'anti31',
      kind: 'matrix',
      label: '\\{\\sigma_3,\\sigma_1\\} =',
      prompt: <>Compute {M`\{\sigma_3, \sigma_1\} = ZX + XZ`} explicitly.</>,
      expected: () => ZERO2,
      mistakes: [
        { f: () => matScale(PY, c(0, 2)), message: <>You computed {M`ZX - XZ = [Z,X] = 2iY`}. The anticommutator has a plus sign.</> },
        { f: () => matScale(PY, c(0, 1)), message: <>That's {M`ZX = iY`} alone.</> },
      ],
      hints: [<>{M`ZX = \begin{pmatrix}0&1\\-1&0\end{pmatrix}`} (Z flips the sign of the second row).</>],
      solution: D`ZX = \begin{pmatrix}0&1\\-1&0\end{pmatrix} = iY,\quad XZ = \begin{pmatrix}0&-1\\1&0\end{pmatrix} = -iY,\quad \{Z,X\} = 0`,
    },
    {
      id: 'general',
      kind: 'choice',
      prompt: <>Combine with {M`\sigma_j^2 = I`}. What is {M`\{\sigma_j,\sigma_k\}`} for all {M`j,k`}?</>,
      options: [
        { id: 'a', label: M`2\delta_{jk}\,I` },
        { id: 'b', label: <>{M`0`} for all {M`j,k`}</>, feedback: <>For {M`j = k`}: {M`\{\sigma_j,\sigma_j\} = 2\sigma_j^2 = 2I`}.</> },
        { id: 'c', label: M`2i\,\epsilon_{jkl}\sigma_l`, feedback: "That's the commutator — the next problem." },
        { id: 'd', label: M`\delta_{jk}\,I`, feedback: 'Missing a factor 2.' },
      ],
      answer: 'a',
      hints: ['Treat j = k and j ≠ k separately.'],
      solution: D`\{\sigma_j,\sigma_k\} = 2\delta_{jk}I`,
    },
    {
      id: 'geom',
      kind: 'choice',
      prompt: <>{M`XY = -YX`}. As Bloch-sphere operations, applying {M`X`} then {M`Y`} versus {M`Y`} then {M`X`} to the same state gives…</>,
      options: [
        { id: 'a', label: 'the same physical state — they differ by the global phase −1.', feedback: <>Yes. The sign is invisible here. Anticommutation shows up under conjugation instead: {M`XYX = -Y`} — a half-turn about x flips the y axis.</> },
        { id: 'b', label: 'opposite points on the sphere.', feedback: <>A minus sign in front of the whole vector is a global phase: {M`-\ket\psi`} and {M`\ket\psi`} have the same Bloch vector.</> },
        { id: 'c', label: 'states that differ by a 90° rotation.', feedback: 'Compute YX|ψ⟩ = −XY|ψ⟩.' },
      ],
      answer: 'a',
      hints: [<>{M`YX\ket\psi = -XY\ket\psi`}. What does a factor {M`-1 = e^{i\pi}`} do?</>],
      solution: <p>{M`YX\ket\psi = -XY\ket\psi = e^{i\pi}XY\ket\psi`}: identical Bloch vectors.</p>,
    },
  ],
  solution: (
    <>
      {D`XY = iZ,\ YX = -iZ;\quad YZ = iX,\ ZY = -iX;\quad ZX = iY,\ XZ = -iY`}
      <p>Hence {M`\{\sigma_1,\sigma_2\} = \{\sigma_2,\sigma_3\} = \{\sigma_3,\sigma_1\} = 0`}. Together with {M`\sigma_j^2 = I`}: {M`\{\sigma_j,\sigma_k\} = 2\delta_{jk}I`}.</p>
    </>
  ),
  intuition: (
    <p>
      For unit vectors {M`(\vec a\cdot\vec\sigma)(\vec b\cdot\vec\sigma) = (\vec a\cdot\vec b)I + i(\vec a\times\vec b)\cdot\vec\sigma`}. Perpendicular axes have {M`\vec a\cdot\vec b = 0`}, and the cross product
      changes sign when the order is swapped — that is anticommutation. The green arrow in the visualization is {M`\vec a\times\vec b`}.
    </p>
  ),
  explore: [{ path: '/pauli', label: 'Pauli algebra workspace' }],
};

const pComm: Problem = {
  id: 'commutators',
  group: 'Pauli algebra',
  part: '2',
  title: 'Commutation relations',
  statement: <p>Show that the commutators {M`[A,B] = AB - BA`} of the Pauli matrices close on themselves, cyclically: {M`[\sigma_1,\sigma_2] = 2i\sigma_3`}, {M`[\sigma_2,\sigma_3] = 2i\sigma_1`}, {M`[\sigma_3,\sigma_1] = 2i\sigma_2`}.</p>,
  intro: (
    <p>
      The commutator measures how much the order of two operations matters. For Pauli matrices it closes on the Paulis themselves — the algebraic reason why rotations about x and y
      combine into a rotation about z.
    </p>
  ),
  Viz: CommutatorViz,
  steps: [
    {
      id: 'c12',
      kind: 'matrix',
      label: '[\\sigma_1,\\sigma_2] =',
      prompt: <>Using {M`XY = iZ`} and {M`YX = -iZ`} from the anticommutator problem, compute {M`[X, Y]`} as a matrix.</>,
      expected: () => matScale(PZ, c(0, 2)),
      mistakes: [
        { f: () => ZERO2, message: <>That's the anticommutator {M`\{X,Y\}`}. The commutator subtracts: {M`XY - YX`}.</> },
        { f: () => matScale(PZ, c(0, -2)), message: <>Order: {M`[X,Y] = XY - YX = iZ - (-iZ)`}.</> },
        { f: () => matScale(PZ, c(0, 1)), message: <>That's only {M`XY`}. Subtract {M`YX = -iZ`}.</> },
      ],
      hints: [<>{M`iZ - (-iZ) = 2iZ`}.</>],
      solution: D`[X,Y] = iZ - (-iZ) = 2iZ = \begin{pmatrix}2i&0\\0&-2i\end{pmatrix}`,
    },
    {
      id: 'c23',
      kind: 'choice',
      prompt: <>{M`[\sigma_2,\sigma_3] = [Y, Z] = `}</>,
      options: [
        { id: 'a', label: M`2i\sigma_1` },
        { id: 'b', label: M`-2i\sigma_1`, feedback: <>{M`YZ = iX`} and {M`ZY = -iX`}, so the sign is +.</> },
        { id: 'c', label: M`2i\sigma_3`, feedback: 'The result involves the third, missing Pauli.' },
        { id: 'd', label: M`0`, feedback: 'Distinct Paulis never commute.' },
      ],
      answer: 'a',
      hints: ['(2,3,1) is a cyclic permutation of (1,2,3).'],
      solution: D`[Y,Z] = iX - (-iX) = 2iX`,
    },
    {
      id: 'c31',
      kind: 'choice',
      prompt: <>{M`[\sigma_3,\sigma_1] = [Z, X] = `}</>,
      options: [
        { id: 'a', label: M`-2i\sigma_2`, feedback: <>(3,1,2) is cyclic, so the sign is +: {M`ZX = iY`}.</> },
        { id: 'b', label: M`2i\sigma_2` },
        { id: 'c', label: M`2i\sigma_1`, feedback: 'The result involves the missing Pauli, Y.' },
        { id: 'd', label: M`2I`, feedback: 'Commutators of traceless matrices are traceless.' },
      ],
      answer: 'b',
      hints: ['Compute ZX first: Z flips the sign of the second row of X.'],
      solution: D`[Z,X] = iY - (-iY) = 2iY`,
    },
    {
      id: 'eps',
      kind: 'choice',
      prompt: 'Which compact formula summarizes all of them?',
      options: [
        { id: 'a', label: M`[\sigma_j,\sigma_k] = 2i\,\epsilon_{jkl}\,\sigma_l` },
        { id: 'b', label: M`[\sigma_j,\sigma_k] = 2i\,\delta_{jk}\,\sigma_l`, feedback: <>{M`\delta_{jk}`} would make it vanish for {M`j\ne k`} — the opposite of what we found.</> },
        { id: 'c', label: M`[\sigma_j,\sigma_k] = 2\,\delta_{jk}I`, feedback: "That's the anticommutator." },
      ],
      answer: 'a',
      hints: ['The Levi-Civita symbol ε_jkl is +1 for cyclic, −1 for anti-cyclic orders, 0 otherwise.'],
      solution: D`[\sigma_j,\sigma_k] = 2i\sum_l\epsilon_{jkl}\sigma_l`,
    },
    {
      id: 'geom',
      kind: 'choice',
      prompt: <>In the visualization: two rotations by a small angle {M`\alpha`} about x and y, applied in the two possible orders, differ by a rotation about which axis, by roughly what angle?</>,
      options: [
        { id: 'a', label: <>about z, by about {M`\alpha^2`}</>, feedback: <>Yes. To second order {M`R_x R_y R_x^{-1}R_y^{-1}`} is generated by the commutator {M`[-iX/2,-iY/2] = -iZ/2`}.</> },
        { id: 'b', label: <>about z, by about {M`2\alpha`}</>, feedback: 'Watch the plot: the difference grows quadratically, not linearly.' },
        { id: 'c', label: <>about {M`(\hat x+\hat y)/\sqrt2`}, by about {M`\alpha^2`}</>, feedback: 'Read the axis readout under the sphere.' },
        { id: 'd', label: 'they do not differ', feedback: 'They would only for commuting generators.' },
      ],
      answer: 'a',
      hints: ['Use the slider and compare the relative rotation angle with α².'],
      solution: <p>BCH: {M`e^Ae^B = e^{A+B+\frac12[A,B]+\dots}`}; the two orders differ by {M`e^{[A,B]}`} with {M`A,B = -i\alpha X/2, -i\alpha Y/2`}: {M`[A,B] = -i\alpha^2 Z/2`}, a z rotation by {M`\alpha^2`}.</p>,
    },
  ],
  solution: (
    <>
      {D`[X,Y] = XY - YX = iZ - (-iZ) = 2iZ,\quad [Y,Z] = 2iX,\quad [Z,X] = 2iY`}
      <p>
        Compactly {M`[\sigma_j,\sigma_k] = 2i\epsilon_{jkl}\sigma_l`}; combined with the anticommutators: {M`\sigma_j\sigma_k = \delta_{jk}I + i\epsilon_{jkl}\sigma_l`}.
      </p>
    </>
  ),
  intuition: (
    <p>
      The rotation generators {M`-i\sigma_k/2`} obey the same algebra as infinitesimal rotations in 3D: {M`[J_x, J_y] \propto J_z`}. This is why finite rotations about different axes don't commute,
      and why the failure is itself a rotation about the third axis.
    </p>
  ),
  explore: [{ path: '/pauli', label: 'Pauli algebra workspace' }, { path: '/gates', label: 'Gates & rotations' }],
};

const pConjExp: Problem = {
  id: 'conjugated-exponential',
  group: 'Pauli algebra',
  part: '3',
  title: 'Exponential of a conjugated matrix',
  statement: <p>Starting from the power series of the exponential, prove that exponentiation commutes with a unitary change of basis: {M`e^{U^\dagger AU} = U^\dagger e^{A}U`} for every square matrix {M`A\in\mathbb C^{n\times n}`} and every unitary {M`U`}.</p>,
  intro: (
    <p>
      {M`U^\dagger A U`} is {M`A`} written in another orthonormal basis. The claim says: exponentiating commutes with changing basis. Combined with diagonalization this turns every matrix
      exponential of a normal matrix into scalar exponentials.
    </p>
  ),
  Viz: SeriesConjugationViz,
  steps: [
    {
      id: 'sq',
      kind: 'choice',
      prompt: <>{M`(U^\dagger AU)^2 = `}</>,
      options: [
        { id: 'a', label: M`U^\dagger A^2 U`, feedback: <>{M`U^\dagger A U\,U^\dagger A U = U^\dagger A (UU^\dagger) A U = U^\dagger A^2U`}.</> },
        { id: 'b', label: M`U^\dagger A^2 U^\dagger`, feedback: 'Write both factors out; the outer U† and U survive unchanged.' },
        { id: 'c', label: M`(U^\dagger)^2A^2U^2`, feedback: 'Matrices do not commute — you cannot regroup factors like that.' },
        { id: 'd', label: M`A^2`, feedback: 'Only if U commutes with A.' },
      ],
      answer: 'a',
      hints: [<>Use {M`UU^\dagger = I`} in the middle.</>],
      solution: D`(U^\dagger AU)(U^\dagger AU) = U^\dagger A\,\underbrace{UU^\dagger}_{I}\,AU = U^\dagger A^2U`,
    },
    {
      id: 'k',
      kind: 'choice',
      prompt: <>By induction, {M`(U^\dagger AU)^k = `}</>,
      options: [
        { id: 'a', label: M`U^\dagger A^kU` },
        { id: 'b', label: M`(U^\dagger)^kA^kU^k`, feedback: 'All inner U U† pairs cancel; only the outermost factors remain.' },
        { id: 'c', label: M`U^\dagger A U^k`, feedback: 'Every factor contributes an A.' },
      ],
      answer: 'a',
      hints: [<>{M`(U^\dagger AU)^{k+1} = (U^\dagger A^kU)(U^\dagger AU)`}.</>],
      solution: D`(U^\dagger AU)^{k+1} = U^\dagger A^kU\,U^\dagger AU = U^\dagger A^{k+1}U`,
    },
    {
      id: 'linear',
      kind: 'choice',
      prompt: <>Why can {M`U^\dagger`} and {M`U`} be pulled out of the entire (infinite) sum {M`\sum_k U^\dagger A^kU/k!`}?</>,
      options: [
        { id: 'a', label: 'Matrix multiplication is linear and continuous, so it commutes with sums and limits.', feedback: 'Exactly. The term-wise table in the visualization shows zero difference for every k.' },
        { id: 'b', label: 'Because U is Hermitian.', feedback: 'U is only unitary. We used UU† = I, nothing else.' },
        { id: 'c', label: 'Because A must be normal.', feedback: 'The identity holds for every A; normality is only needed for the diagonalization remark.' },
      ],
      answer: 'a',
      hints: [<>{M`U^\dagger(B + C)U = U^\dagger BU + U^\dagger CU`}.</>],
      solution: D`e^{U^\dagger AU} = \sum_k \frac{(U^\dagger AU)^k}{k!} = \sum_k \frac{U^\dagger A^kU}{k!} = U^\dagger\Big(\sum_k\frac{A^k}{k!}\Big)U = U^\dagger e^AU`,
    },
    {
      id: 'use',
      kind: 'matrix',
      label: 'e^{i\\theta X} =',
      vars: [TH],
      prompt: <>Use it. Since {M`X = HZH`} with {M`H = H^\dagger`}: {M`e^{i\theta X} = H\,e^{i\theta Z}\,H`}. Enter {M`e^{i\theta X}`} (variable <code>theta</code>).</>,
      expected: (v) => expm(matScale(PX, c(0, v.theta))),
      mistakes: [
        { f: (v) => diag(expi(v.theta), expi(-v.theta)), message: <>That's {M`e^{i\theta Z}`}. Now conjugate it with {M`H`}.</> },
        { f: (v) => expm(matScale(PX, c(0, -v.theta))), message: <>That's {M`e^{-i\theta X}`} — check the sign of {M`i`}.</> },
        { f: (v) => expm(matScale(PX, c(0, v.theta / 2))), message: <>No factor 1/2 here: the exponent is {M`i\theta X`}, not {M`i\theta X/2`}.</> },
      ],
      hints: [<>{M`e^{i\theta Z} = \mathrm{diag}(e^{i\theta}, e^{-i\theta})`}.</>, <>{M`H\,\mathrm{diag}(a,b)\,H = \tfrac12\begin{pmatrix}a+b & a-b\\ a-b & a+b\end{pmatrix}`}.</>, <>{M`\tfrac12(e^{i\theta}+e^{-i\theta}) = \cos\theta`}, {M`\tfrac12(e^{i\theta}-e^{-i\theta}) = i\sin\theta`}.</>],
      solution: D`e^{i\theta X} = H\begin{pmatrix}e^{i\theta}&0\\0&e^{-i\theta}\end{pmatrix}H = \begin{pmatrix}\cos\theta & i\sin\theta\\ i\sin\theta & \cos\theta\end{pmatrix} = \cos\theta\, I + i\sin\theta\, X`,
    },
    {
      id: 'spectral',
      kind: 'choice',
      prompt: <>For a normal matrix {M`A = V\Lambda V^\dagger`} ({M`V`} unitary, {M`\Lambda`} diagonal), the identity gives {M`e^A = `}</>,
      options: [
        { id: 'a', label: M`V e^{\Lambda} V^\dagger`, feedback: <>Apply the identity with {M`U = V^\dagger`}. And {M`e^\Lambda`} is just the entrywise exponential of the eigenvalues.</> },
        { id: 'b', label: M`V^\dagger e^{\Lambda} V`, feedback: <>Careful with which side carries the dagger: {M`A = V\Lambda V^\dagger`}, so {M`e^A = Ve^\Lambda V^\dagger`}.</> },
        { id: 'c', label: M`e^V e^\Lambda e^{V^\dagger}`, feedback: 'The exponential is not multiplicative over arbitrary products.' },
      ],
      answer: 'a',
      hints: [<>Set {M`U = V^\dagger`} in {M`e^{U^\dagger \Lambda U} = U^\dagger e^\Lambda U`}.</>],
      solution: D`e^{A} = e^{V\Lambda V^\dagger} = Ve^{\Lambda}V^\dagger,\qquad e^{\Lambda} = \mathrm{diag}(e^{\lambda_1},\dots,e^{\lambda_n})`,
    },
  ],
  solution: D`e^{U^\dagger AU} = \sum_{k=0}^\infty\frac{(U^\dagger AU)^k}{k!} = \sum_{k=0}^\infty\frac{U^\dagger A^kU}{k!} = U^\dagger\Big(\sum_{k=0}^\infty\frac{A^k}{k!}\Big)U = U^\dagger e^AU`,
  intuition: (
    <p>
      {M`e^A`} is defined from powers of {M`A`}, and powers don't care about the basis you write them in. So: rotate to the eigenbasis, exponentiate numbers, rotate back. For
      Hamiltonians this is the statement that energy eigenstates just pick up phases {M`e^{-iE_kt}`}.
    </p>
  ),
  explore: [{ path: '/exponential', label: 'Matrix exponential explorer' }],
};

const pHadamard: Problem = {
  id: 'hadamard-conjugation',
  group: 'Pauli algebra',
  part: '4',
  title: 'Hadamard conjugation',
  statement: <p>For the Hadamard gate {M`H = \tfrac{1}{\sqrt2}\begin{pmatrix}1&1\\1&-1\end{pmatrix}`}, verify that conjugation by {M`H`} exchanges the Pauli matrices {M`X`} and {M`Z`}: {M`HXH = Z`} and {M`HZH = X`}.</p>,
  intro: <p>{M`H`} is Hermitian and self-inverse ({M`H^2 = I`}), so {M`HAH = HAH^{-1}`} is a change of basis. Geometrically it is a half-turn of the Bloch sphere that swaps the x and z axes.</p>,
  Viz: HadamardFrameViz,
  steps: [
    {
      id: 'hx',
      kind: 'matrix',
      label: 'HX =',
      prompt: <>First compute {M`HX`}. (Put {M`1/\sqrt2`} in the factor box.)</>,
      expected: () => matMul(Hd, PX),
      mistakes: [{ f: () => matMul(PX, Hd), message: <>That's {M`XH`} ({M`X`} on the left swaps rows). {M`HX`} swaps the <em>columns</em> of {M`H`}.</> }],
      hints: ['Right-multiplying by X swaps the two columns.'],
      solution: D`HX = \tfrac{1}{\sqrt2}\begin{pmatrix}1&1\\-1&1\end{pmatrix}`,
    },
    {
      id: 'hxh',
      kind: 'matrix',
      label: 'HXH =',
      prompt: <>Now {M`HXH = (HX)H`}.</>,
      expected: () => PZ,
      hints: [<>{M`\tfrac12\begin{pmatrix}1&1\\-1&1\end{pmatrix}\begin{pmatrix}1&1\\1&-1\end{pmatrix}`}.</>],
      solution: D`HXH = \tfrac12\begin{pmatrix}1&1\\-1&1\end{pmatrix}\begin{pmatrix}1&1\\1&-1\end{pmatrix} = \tfrac12\begin{pmatrix}2&0\\0&-2\end{pmatrix} = Z`,
    },
    {
      id: 'hzh',
      kind: 'matrix',
      label: 'HZH =',
      prompt: <>Compute {M`HZH`}. (Shortcut allowed — but say why it works in your head.)</>,
      expected: () => PX,
      hints: [<>Multiply {M`HXH = Z`} by {M`H`} on both sides and use {M`H^2 = I`}.</>],
      solution: D`H(HXH)H = H Z H \;\Rightarrow\; X = HZH`,
    },
    {
      id: 'hyh',
      kind: 'matrix',
      label: 'HYH =',
      prompt: <>Transfer: what is {M`HYH`}?</>,
      expected: () => matScale(PY, c(-1)),
      mistakes: [{ f: () => PY, message: 'Not quite — the half-turn about (x̂+ẑ)/√2 flips the y axis.' }],
      hints: [<>{M`Y = iXZ`}; insert {M`H^2 = I`}: {M`HYH = i(HXH)(HZH)`}.</>],
      solution: D`HYH = i\,(HXH)(HZH) = i\,ZX = i\cdot iY = -Y`,
    },
    {
      id: 'states',
      kind: 'choice',
      prompt: <>Since {M`H^2 = I`} and {M`HXH = Z`}: where does {M`H`} send the X eigenstates {M`\ket\pm`}?</>,
      options: [
        { id: 'a', label: <>{M`\ket+\mapsto\ket0`}, {M`\ket-\mapsto\ket1`}</>, feedback: <>Yes: {M`H\ket0 = \ket+`} and {M`H^2 = I`} give {M`H\ket+ = \ket0`}.</> },
        { id: 'b', label: <>{M`\ket+\mapsto\ket1`}, {M`\ket-\mapsto\ket0`}</>, feedback: <>Compute {M`H\ket+ = \tfrac{1}{2}\big((1+1)\ket0 + (1-1)\ket1\big)`}.</> },
        { id: 'c', label: 'they stay where they are', feedback: 'They are eigenstates of X, not of H.' },
      ],
      answer: 'a',
      hints: [<>{M`H\ket0 = \ket+`}. Apply {M`H`} again.</>],
      solution: <p>{M`H`} is the basis change between the X and Z eigenbases: {M`H\ket\pm = \ket{0/1}`} and {M`H\ket{0/1} = \ket\pm`}.</p>,
    },
    {
      id: 'rotation',
      kind: 'choice',
      prompt: <>As a Bloch-sphere rotation, {M`H`} (up to global phase) is…</>,
      options: [
        { id: 'a', label: <>a {M`\pi`}-rotation about {M`(\hat x+\hat z)/\sqrt2`}</>, feedback: <>Yes: {M`H = i\,R_{(\hat x+\hat z)/\sqrt2}(\pi)`}. Its axis bisects x and z, so the half-turn swaps them and reverses y.</> },
        { id: 'b', label: <>a {M`\pi/2`}-rotation about {M`\hat y`}</>, feedback: <>{M`R_y(\pi/2)`} maps z → x but x → −z, and it is not self-inverse. {M`H^2 = I`} demands a half-turn.</> },
        { id: 'c', label: 'a reflection through the xz-plane', feedback: 'Unitaries act as proper rotations (no reflections) on the Bloch sphere.' },
      ],
      answer: 'a',
      hints: ['H² = I: which rotations square to the identity?'],
      solution: D`H = \tfrac{1}{\sqrt2}(X + Z) = i\Big[\cos\tfrac\pi2 I - i\sin\tfrac\pi2\,\tfrac{X+Z}{\sqrt2}\Big] = i\,R_{\hat h}(\pi),\quad \hat h = \tfrac{\hat x+\hat z}{\sqrt2}`,
    },
  ],
  solution: D`HXH = \tfrac12\begin{pmatrix}1&1\\1&-1\end{pmatrix}\begin{pmatrix}0&1\\1&0\end{pmatrix}\begin{pmatrix}1&1\\1&-1\end{pmatrix} = \begin{pmatrix}1&0\\0&-1\end{pmatrix} = Z,\qquad HZH = H(HXH)H = X`,
  intuition: (
    <p>
      Conjugation {M`A \mapsto HAH^\dagger`} rotates the <em>axis</em> of an operator by the rotation that {M`H`} performs. A half-turn about {M`(\hat x+\hat z)/\sqrt2`} exchanges x and z — so it
      exchanges X and Z, their eigenstates, and their measurement bases.
    </p>
  ),
  explore: [{ path: '/gates', label: 'Hadamard in the gate explorer' }, { path: '/pauli', label: 'Conjugation demos' }],
};

const pHadamardRot: Problem = {
  id: 'hadamard-rotation',
  group: 'Pauli algebra',
  part: '5',
  title: 'H Rx(θ) H = Rz(θ)',
  statement: <p>Use the two previous results — {M`e^{U^\dagger AU} = U^\dagger e^{A}U`} and {M`HXH = Z`} — to show that {M`HR_x(\theta)H = R_z(\theta)`} for every angle {M`\theta\in\mathbb R`}.</p>,
  intro: <p>A rotation about x, viewed in the basis rotated by {M`H`}, is a rotation about z by the same angle. Conjugation moves the axis and keeps the angle.</p>,
  Viz: ConjugationSequenceViz,
  steps: [
    {
      id: 'inside',
      kind: 'choice',
      prompt: <>Write {M`R_x(\theta) = e^{-i\theta X/2}`}. By the conjugation rule {M`e^{U^\dagger AU} = U^\dagger e^AU`} with {M`U = H = H^\dagger`}: {M`H\,e^{-i\theta X/2}H = `}</>,
      options: [
        { id: 'a', label: M`e^{-i\theta (HXH)/2}` },
        { id: 'b', label: M`e^{-i\theta/2}\,HXH`, feedback: <>The exponential is not linear. The conjugation rule moves the conjugation <em>into the exponent</em>.</> },
        { id: 'c', label: M`e^{-i\theta X/2}`, feedback: 'Conjugation by H does change X.' },
      ],
      answer: 'a',
      hints: [<>{M`H\,e^{A}H = e^{HAH}`} for {M`A = -i\theta X/2`}, because {M`H = H^\dagger`} is unitary.</>],
      solution: D`H e^{-i\theta X/2}H = e^{H(-i\theta X/2)H} = e^{-i\theta\, HXH/2}`,
    },
    {
      id: 'matrix',
      kind: 'matrix',
      label: 'HR_x(\\theta)H =',
      vars: [TH],
      prompt: <>Hence (using {M`HXH = Z`}), enter {M`HR_x(\theta)H`} as a matrix.</>,
      expected: (v) => Rz(v.theta),
      mistakes: [
        { f: (v) => diag(expi(-v.theta), expi(v.theta)), message: <>Factor 1/2: {M`R_z(\theta) = \mathrm{diag}(e^{-i\theta/2}, e^{i\theta/2})`}.</> },
        { f: (v) => diag(expi(v.theta / 2), expi(-v.theta / 2)), message: <>Sign: {M`R_z(\theta) = e^{-i\theta Z/2}`}, so the top-left entry is {M`e^{-i\theta/2}`}.</> },
        { f: (v) => Rx(v.theta), message: <>That's {M`R_x(\theta)`} itself — conjugation by {M`H`} changes the axis.</> },
      ],
      hints: [<>{M`e^{-i\theta Z/2}`} with diagonal {M`Z`}: exponentiate entrywise.</>],
      solution: D`HR_x(\theta)H = e^{-i\theta Z/2} = R_z(\theta) = \begin{pmatrix}e^{-i\theta/2}&0\\0&e^{i\theta/2}\end{pmatrix}`,
    },
    {
      id: 'azimuth',
      kind: 'numeric',
      label: '\\varphi =',
      answer: Math.PI / 3,
      tol: 2e-3,
      prompt: <>Experiment: start in {M`\ket+`} and apply {M`H`}, {M`R_x(\pi/3)`}, {M`H`} (set {M`\theta = \pi/3`} in the visualization). The final state lies on the equator. What is its azimuth {M`\varphi`} (radians)?</>,
      mistakes: [
        { value: Math.PI / 6, message: <>Half-angle mix-up: {M`R_z(\theta)`} turns the Bloch vector by the full {M`\theta`}.</> },
        { value: -Math.PI / 3, message: <>Rotation sense: {M`R_z(\theta)`} turns counter-clockwise about {M`+\hat z`} (right-hand rule).</> },
        { value: (5 * Math.PI) / 3, message: <>Rotation sense: {M`R_z(\theta)`} turns counter-clockwise about {M`+\hat z`} (right-hand rule).</> },
        { value: 60, message: 'Please answer in radians (e.g. pi/3).' },
      ],
      hints: [<>The sequence equals {M`R_z(\pi/3)`}, and {M`\ket+`} sits at {M`\varphi = 0`}.</>],
      solution: <p>{M`R_z(\pi/3)\ket+`} has azimuth {M`\varphi = \pi/3 \approx 1.047`}: the state {M`\tfrac{1}{\sqrt2}(\ket0 + e^{i\pi/3}\ket1)`} up to global phase.</p>,
    },
    {
      id: 'pi',
      kind: 'choice',
      prompt: <>Check {M`\theta = \pi`}: {M`HR_x(\pi)H = `}</>,
      options: [
        { id: 'a', label: <>{M`-iZ`} ({M`= R_z(\pi)`})</> },
        { id: 'b', label: M`Z`, feedback: <>Only up to the global phase {M`-i`}: {M`R_z(\pi) = \cos\tfrac\pi2 I - i\sin\tfrac\pi2 Z = -iZ`}.</> },
        { id: 'c', label: M`X`, feedback: 'The axis has moved from x to z.' },
      ],
      answer: 'a',
      hints: [<>{M`R_x(\pi) = -iX`}.</>],
      solution: D`HR_x(\pi)H = H(-iX)H = -i\,HXH = -iZ = R_z(\pi)`,
    },
    {
      id: 'ry',
      kind: 'choice',
      prompt: <>Transfer: using {M`HYH = -Y`}, what is {M`HR_y(\theta)H`}?</>,
      options: [
        { id: 'a', label: M`R_y(-\theta)`, feedback: 'Yes — the y axis is flipped, so the rotation sense reverses.' },
        { id: 'b', label: M`R_y(\theta)`, feedback: 'HYH = −Y, not Y.' },
        { id: 'c', label: M`R_z(\theta)`, feedback: 'Only X is sent to Z.' },
      ],
      answer: 'a',
      hints: [<>{M`He^{-i\theta Y/2}H = e^{-i\theta(-Y)/2}`}.</>],
      solution: D`HR_y(\theta)H = e^{-i\theta (HYH)/2} = e^{+i\theta Y/2} = R_y(-\theta)`,
    },
  ],
  solution: D`HR_x(\theta)H = He^{-i\theta X/2}H \overset{\text{series}}{=} e^{-i\theta HXH/2} \overset{HXH = Z}{=} e^{-i\theta Z/2} = R_z(\theta)`,
  intuition: (
    <p>
      Read right to left: the first {M`H`} carries the z axis to x, {M`R_x(\theta)`} turns about that axis, the last {M`H`} carries everything back. The net effect is a turn by {M`\theta`} about z. In
      circuits this lets you trade rotation axes by sandwiching with basis changes.
    </p>
  ),
  explore: [{ path: '/pauli', label: 'Conjugation changes the axis' }, { path: '/gates', label: 'Gate explorer' }],
};

// ===========================================================================
// Measurement
// ===========================================================================

const pEigen: Problem = {
  id: 'pauli-eigenvectors',
  group: 'Measurement',
  part: '1',
  title: 'Eigenvectors of X, Y, Z',
  statement: <p>Find the eigenvalues and normalized eigenvectors of each Pauli matrix {M`X`}, {M`Y`} and {M`Z`}. They are the possible readings and post-measurement states of spin measurements along x, y and z.</p>,
  intro: (
    <p>
      Measuring the observable {M`\vec n\cdot\vec\sigma`} yields one of its eigenvalues; the state collapses onto the corresponding eigenvector. For a magnet oriented along x, y or z these
      are the two beams.
    </p>
  ),
  Viz: () => <EigenViz />,
  steps: [
    {
      id: 'charpoly',
      kind: 'choice',
      prompt: <>The characteristic polynomial of {M`X`}: {M`\det(X-\lambda I) = `}</>,
      options: [
        { id: 'a', label: M`\lambda^2 - 1` },
        { id: 'b', label: M`\lambda^2 + 1`, feedback: <>{M`\det\begin{pmatrix}-\lambda&1\\1&-\lambda\end{pmatrix} = \lambda^2 - 1\cdot 1`}.</> },
        { id: 'c', label: M`(1-\lambda)^2`, feedback: 'The diagonal of X is zero.' },
      ],
      answer: 'a',
      hints: [<>{M`\det\begin{pmatrix}a&b\\c&d\end{pmatrix} = ad - bc`}.</>],
      solution: D`\det\begin{pmatrix}-\lambda & 1\\ 1 & -\lambda\end{pmatrix} = \lambda^2 - 1 = 0 \Rightarrow \lambda = \pm1`,
    },
    {
      id: 'eigs',
      kind: 'choice',
      prompt: <>What are the eigenvalues of {M`X`}, {M`Y`} and {M`Z`}?</>,
      options: [
        { id: 'a', label: <>{M`\pm1`} for all three</>, feedback: <>Right — all are Hermitian (real eigenvalues), traceless (sum 0) and square to {M`I`} ({M`\lambda^2 = 1`}).</> },
        { id: 'b', label: <>{M`X, Z`}: {M`\pm1`}; {M`Y`}: {M`\pm i`}</>, feedback: <>{M`Y`} has imaginary entries but is Hermitian, so its eigenvalues are real: {M`\det(Y-\lambda I) = \lambda^2 - (-i)(i) = \lambda^2 - 1`}.</> },
        { id: 'c', label: <>{M`Z`}: {M`0, 1`}</>, feedback: <>{M`Z = \mathrm{diag}(1,-1)`}: read the eigenvalues off the diagonal.</> },
      ],
      answer: 'a',
      hints: ['σ² = I implies λ² = 1 for every eigenvalue.'],
      solution: <p>For each Pauli matrix {M`\sigma^2 = I`} forces {M`\lambda^2 = 1`}, and {M`\mathrm{tr}\,\sigma = 0`} forces one {M`+1`} and one {M`-1`}.</p>,
    },
    {
      id: 'xp',
      kind: 'vector',
      upToPhase: true,
      label: 'X:\\ \\lambda = +1:',
      prompt: <>Enter a normalized eigenvector of {M`X`} for {M`\lambda = +1`}.</>,
      expected: () => vec(c(S), c(S)),
      mistakes: [{ f: () => vec(c(S), c(-S)), upToPhase: true, message: <>That's the {M`-1`} eigenvector: {M`X(1,-1)^T = -(1,-1)^T`}.</> }],
      hints: [<>Solve {M`(X - I)v = 0`}: {M`-v_1 + v_2 = 0`}.</>, <>{M`v \propto (1,1)`}; normalize with {M`1/\sqrt2`}.</>],
      solution: D`\ket+ = \tfrac{1}{\sqrt2}\begin{pmatrix}1\\1\end{pmatrix}`,
    },
    {
      id: 'xm',
      kind: 'vector',
      upToPhase: true,
      label: 'X:\\ \\lambda = -1:',
      prompt: <>…and for {M`\lambda = -1`}.</>,
      expected: () => vec(c(S), c(-S)),
      mistakes: [{ f: () => vec(c(S), c(S)), upToPhase: true, message: <>That's {M`\ket+`}, the {M`+1`} eigenvector.</> }],
      hints: [<>Solve {M`(X + I)v = 0`}.</>],
      solution: D`\ket- = \tfrac{1}{\sqrt2}\begin{pmatrix}1\\-1\end{pmatrix}`,
    },
    {
      id: 'yp',
      kind: 'vector',
      upToPhase: true,
      label: 'Y:\\ \\lambda = +1:',
      prompt: <>Normalized eigenvector of {M`Y`} for {M`\lambda = +1`}.</>,
      expected: () => vec(c(S), c(0, S)),
      mistakes: [
        { f: () => vec(c(S), c(0, -S)), upToPhase: true, message: <>That's the {M`-1`} eigenvector. Check: {M`Y(1,i)^T = (-i\cdot i,\ i\cdot1)^T = (1, i)^T`}.</> },
        { f: () => vec(c(S), c(S)), upToPhase: true, message: <>That's {M`\ket+`}, an X eigenvector.</> },
      ],
      hints: [<>{M`(Y - I)v = 0`} gives {M`-v_1 - iv_2 = 0`}, i.e. {M`v_2 = iv_1`}.</>],
      solution: D`\ket{+i} = \tfrac{1}{\sqrt2}\begin{pmatrix}1\\ i\end{pmatrix}`,
    },
    {
      id: 'ym',
      kind: 'vector',
      upToPhase: true,
      label: 'Y:\\ \\lambda = -1:',
      prompt: <>…and for {M`\lambda = -1`}.</>,
      expected: () => vec(c(S), c(0, -S)),
      mistakes: [{ f: () => vec(c(S), c(0, S)), upToPhase: true, message: <>That's {M`\ket{+i}`}, the {M`+1`} eigenvector.</> }],
      hints: [<>{M`(Y + I)v = 0`} gives {M`v_2 = -iv_1`}.</>],
      solution: D`\ket{-i} = \tfrac{1}{\sqrt2}\begin{pmatrix}1\\ -i\end{pmatrix}`,
    },
    {
      id: 'z',
      kind: 'choice',
      prompt: <>Eigenvectors of {M`Z`}?</>,
      options: [
        { id: 'a', label: <>{M`\ket0`} for {M`+1`}, {M`\ket1`} for {M`-1`}</> },
        { id: 'b', label: <>{M`\ket1`} for {M`+1`}, {M`\ket0`} for {M`-1`}</>, feedback: <>{M`Z\ket0 = +\ket0`}: {M`\ket0`} is spin up, eigenvalue {M`+1`}.</> },
        { id: 'c', label: <>{M`\ket\pm`}</>, feedback: 'Those are the X eigenvectors.' },
      ],
      answer: 'a',
      hints: ['Z is already diagonal.'],
      solution: D`Z\ket0 = \ket0,\qquad Z\ket1 = -\ket1`,
    },
    {
      id: 'bloch',
      kind: 'choice',
      prompt: <>Where do the two eigenstates of {M`\vec n\cdot\vec\sigma`} lie on the Bloch sphere?</>,
      options: [
        { id: 'a', label: <>At {M`\pm\vec n`}: antipodal points on the measurement axis.</> },
        { id: 'b', label: '90° apart, because they are orthogonal.', feedback: 'Orthogonal in Hilbert space — but the Bloch sphere doubles angles, so they are 180° apart.' },
        { id: 'c', label: 'Both on the equator.', feedback: 'Only for axes in the xy-plane.' },
      ],
      answer: 'a',
      hints: ['Look at the visualization for X, Y and Z.'],
      solution: <p>{M`\ket{\pm\vec n}`} has Bloch vector {M`\pm\vec n`}. Measuring along {M`\vec n`} sorts states by which end of that axis they are closer to: {M`P_\pm = (1\pm\vec n\cdot\vec r)/2`}.</p>,
    },
  ],
  solution: (
    <>
      {D`X:\ \ket\pm = \tfrac{1}{\sqrt2}(\ket0\pm\ket1),\qquad Y:\ \ket{\pm i} = \tfrac{1}{\sqrt2}(\ket0\pm i\ket1),\qquad Z:\ \ket0,\ \ket1`}
      <p>with eigenvalues {M`+1`} and {M`-1`} respectively (eigenvectors defined up to a phase).</p>
    </>
  ),
  intuition: <p>Each Pauli observable is a direction on the Bloch sphere; its eigenstates are the two poles of that direction. A Stern–Gerlach magnet along that direction separates exactly these two states.</p>,
  explore: [{ path: '/eigen', label: 'Eigenvector explorer' }],
};

const pXBasis: Problem = {
  id: 'x-basis-measurement',
  group: 'Measurement',
  part: '2',
  title: 'Measuring |0⟩ in the X basis',
  statement: (
    <p>
      A qubit in {M`\ket0`} is measured in the eigenbasis {M`\ket+,\ket-`} of {M`X`} — equivalently: apply {M`H`}, measure in the computational basis, apply {M`H`} again. Find the outcome
      probabilities, and compare with a Stern–Gerlach run in which the ↑ beam of a Z magnet is sent into an X magnet.
    </p>
  ),
  intro: (
    <p>
      Our devices measure in the computational (Z) basis. To measure X, rotate the X eigenbasis onto the Z eigenbasis with {M`H`}, measure, and rotate back. That is exactly the
      Stern–Gerlach sequence Z (keep ↑) → X: the ↑ beam is {M`\ket0`}, then an X magnet.
    </p>
  ),
  Viz: () => <XMeasureViz axisTiltControl />,
  steps: [
    {
      id: 'h0',
      kind: 'vector',
      label: 'H\\ket0 =',
      prompt: <>Compute {M`H\ket0`}.</>,
      expected: () => vec(c(S), c(S)),
      hints: [<>{M`H\ket0`} is the first column of {M`H`}.</>],
      solution: D`H\ket0 = \tfrac{1}{\sqrt2}(\ket0+\ket1) = \ket+`,
    },
    {
      id: 'amp',
      kind: 'numeric',
      label: '\\langle +|0\\rangle =',
      answer: Math.SQRT1_2,
      prompt: <>The amplitude for outcome {M`+`} is {M`\langle +|0\rangle`} {M`= \langle 0|H|0\rangle`}. What is it?</>,
      hints: [<>{M`\langle + | = \tfrac{1}{\sqrt2}(\langle0| + \langle1|)`}.</>],
      solution: D`\langle +|0\rangle = \tfrac{1}{\sqrt2}`,
    },
    {
      id: 'p',
      kind: 'numeric',
      label: 'P(+) =',
      answer: 0.5,
      prompt: 'And the probability of outcome +?',
      mistakes: [{ value: Math.SQRT1_2, message: <>That's the amplitude. Probabilities are squared magnitudes: {M`|\langle+|0\rangle|^2`}.</> }],
      hints: ['Born rule.'],
      solution: D`P(+) = |\langle+|0\rangle|^2 = \tfrac12,\qquad P(-) = |\langle-|0\rangle|^2 = \tfrac12`,
    },
    {
      id: 'post',
      kind: 'choice',
      prompt: <>In "apply {M`H`}, measure Z, apply {M`H`}", what is the role of the final {M`H`}?</>,
      options: [
        { id: 'a', label: <>It maps the collapsed {M`\ket0/\ket1`} back to {M`\ket+/\ket-`}: after an X measurement the qubit is in an X eigenstate.</> },
        { id: 'b', label: 'It undoes the measurement.', feedback: 'Measurement is irreversible: the outcome probabilities and the collapse remain.' },
        { id: 'c', label: 'Nothing — it is optional.', feedback: <>It doesn't change the outcome statistics, but without it the post-measurement state would be {M`\ket0`} or {M`\ket1`} instead of {M`\ket\pm`}.</> },
      ],
      answer: 'a',
      hints: ['What state would a second X measurement find?'],
      solution: D`H\,P_0\,H = H\ket0\bra0H = \ket+\bra+ = P_+`,
    },
    {
      id: 'compare',
      kind: 'choice',
      prompt: <>Compare with the experiment: oven → Z, block ↓ → X, which shows two spots of equal intensity.</>,
      options: [
        { id: 'a', label: <>QM predicts 50 % / 50 % for {M`+/-`}, as observed.</>, feedback: <>Yes: the ↑ beam is {M`\ket0`}, and {M`|\langle\pm|0\rangle|^2 = \tfrac12`}.</> },
        { id: 'b', label: 'QM predicts a single peak, as classically expected.', feedback: <>Classically a z dipole has zero x moment. Quantum mechanically {M`\ket0`} is an equal superposition of {M`\ket\pm`}.</> },
        { id: 'c', label: 'QM predicts 25 % / 25 %.', feedback: 'Conditional on reaching the X magnet, the two outcomes must sum to 1.' },
      ],
      answer: 'a',
      hints: ['Which state leaves the first magnet in the ↑ beam?'],
      solution: <p>The ↑ beam carries {M`\ket0 = \tfrac{1}{\sqrt2}(\ket+ + \ket-)`}, so the X magnet splits it evenly.</p>,
    },
    {
      id: 'tilt',
      kind: 'numeric',
      label: 'P(+) =',
      answer: 0.75,
      prompt: <>Transfer: tilt the analyser to an angle {M`\alpha = 60^\circ`} from z (in the xz-plane; try the slider). What is {M`P(+)`} for {M`\ket0`}?</>,
      mistakes: [
        { value: 0.25, message: <>That's {M`P(-) = \sin^2(\alpha/2)`}.</> },
        { value: 0.5, message: <>{M`\cos\alpha = 0.5`} is the expectation value {M`\langle\vec n\cdot\vec\sigma\rangle`}. {M`P(+) = (1+\cos\alpha)/2`}.</> },
        { value: Math.sqrt(3) / 2, message: <>{M`\cos(\alpha/2)`} is the amplitude; square it.</> },
      ],
      hints: [<>{M`P_\pm = (1\pm\vec n\cdot\vec r)/2`} with {M`\vec r = \hat z`}.</>, <>{M`(1+\cos\alpha)/2 = \cos^2(\alpha/2)`}.</>],
      solution: D`P(+) = \tfrac{1+\cos 60^\circ}{2} = \cos^2 30^\circ = \tfrac34`,
    },
  ],
  solution: (
    <>
      {D`P(\pm) = |\langle\pm|0\rangle|^2 = |\langle 0|H|0\rangle|^2,\ |\langle 1|H|0\rangle|^2 = \tfrac12,\ \tfrac12`}
      <p>matching the observed 50 %/50 % split behind the X magnet. The post-measurement state is {M`\ket+`} or {M`\ket-`}.</p>
    </>
  ),
  intuition: (
    <p>
      {M`\ket0`} points along +z; the X axis is perpendicular. The foot of the state on the measurement axis sits exactly at the centre, so both ends are equally likely. In general{' '}
      {M`P(+) = \cos^2(\Theta/2)`} with {M`\Theta`} the angle between state and analyser.
    </p>
  ),
  explore: [{ path: '/stern-gerlach', label: 'Stern–Gerlach simulator' }, { path: '/eigen', label: 'Born rule geometry' }],
};

const pSequential: Problem = {
  id: 'sequential-measurements',
  group: 'Measurement',
  part: '3',
  title: 'Z → X → Z and Z → X → X',
  statement: <p>Three magnets in a row: Z (keep ↑), then X (keep +), then Z again. The last magnet splits the beam into two equal halves, ↑ and ↓ — as if the first selection had been forgotten. Explain this with quantum mechanics. What would you see if the last magnet were oriented along x instead?</p>,
  intro: (
    <p>
      If each atom carried fixed classical values for "z-spin" and "x-spin", the final Z magnet would show only ↑. Quantum mechanics says instead: measuring X <em>prepares</em> an X
      eigenstate, which has no definite Z value.
    </p>
  ),
  Viz: () => <SGChainViz />,
  steps: [
    {
      id: 'state',
      kind: 'choice',
      prompt: 'Which state enters the third magnet?',
      options: [
        { id: 'a', label: M`\ket+`, feedback: 'Yes — the X measurement collapsed the state onto |+⟩; the earlier |0⟩ is gone.' },
        { id: 'b', label: M`\ket0`, feedback: 'The X magnet measured the atom and collapsed it.' },
        { id: 'c', label: <>"both {M`\ket0`} and {M`\ket+`}" (↑ and +)</>, feedback: <>A qubit can't be in both: {M`\ket+ = \tfrac{1}{\sqrt2}(\ket0+\ket1)`} has no definite Z value.</> },
      ],
      answer: 'a',
      hints: ['After a projective measurement along x with outcome +, the state is the + eigenvector of X.'],
      solution: D`\ket0 \xrightarrow{\ X,\ +\ } \frac{P_+\ket0}{\|P_+\ket0\|} = \ket+`,
    },
    {
      id: 'pz',
      kind: 'numeric',
      label: 'P(\\uparrow) =',
      answer: 0.5,
      prompt: <>For atoms that reach the final Z magnet: what is {M`P(\uparrow)`}?</>,
      mistakes: [{ value: 1, message: "That's the classical 'two hidden bits' prediction. Compute |⟨0|+⟩|²." }],
      hints: [<>{M`|\langle 0|+\rangle|^2`}.</>],
      solution: D`P(\uparrow) = |\langle0|+\rangle|^2 = \tfrac12`,
    },
    {
      id: 'overall',
      kind: 'numeric',
      label: '\\text{fraction} =',
      answer: 0.125,
      prompt: <>What fraction of <em>all</em> atoms leaving the (unpolarized) oven ends up in the final ↑ spot?</>,
      mistakes: [
        { value: 0.25, message: 'Also account for the half lost at the first magnet: the oven is unpolarized.' },
        { value: 0.5, message: "That's the conditional probability at the last magnet only." },
      ],
      hints: ['Multiply the survival probabilities: first magnet (½), second (½), last (½).'],
      solution: D`\tfrac12\cdot\tfrac12\cdot\tfrac12 = \tfrac18`,
    },
    {
      id: 'why',
      kind: 'choice',
      prompt: <>Why does this rule out "each atom carries two classical bits (↑/↓ and +/−)"?</>,
      options: [
        { id: 'a', label: 'Measuring X disturbs Z: the state after the X magnet has no definite Z value. Quantum states are not lists of pre-existing answers.' },
        { id: 'b', label: 'The magnets are imperfect and randomize the spin.', feedback: 'Then Z → Z would also randomize — but it gives 100 % ↑.' },
        { id: 'c', label: 'Half of the atoms flip spontaneously in flight.', feedback: 'Z → Z shows no such flips.' },
      ],
      answer: 'a',
      hints: ['Compare with Z → Z (remove the middle magnet in the visualization).'],
      solution: <p>Z and X don't commute; their eigenbases are different. Sharpening X (preparing {M`\ket+`}) necessarily makes Z maximally uncertain.</p>,
    },
    {
      id: 'px',
      kind: 'numeric',
      label: 'P(+) =',
      answer: 1,
      prompt: <>Now orient the last field along x instead (try it). For atoms reaching it, what is {M`P(+)`}?</>,
      mistakes: [{ value: 0.5, message: <>The atom arrives in {M`\ket+`}, an X eigenstate. A repeated measurement along the same axis gives the same result.</> }],
      hints: [<>{M`|\langle+|+\rangle|^2`}.</>],
      solution: D`P(+) = |\langle+|+\rangle|^2 = 1,\qquad P(-) = 0`,
    },
    {
      id: 'pxall',
      kind: 'numeric',
      label: '\\text{fraction} =',
      answer: 0.25,
      prompt: 'With the last field along x: what fraction of all emitted atoms reaches the final + spot?',
      mistakes: [{ value: 0.125, message: 'The last magnet no longer halves the beam.' }],
      hints: ['½ · ½ · 1.'],
      solution: D`\tfrac12\cdot\tfrac12\cdot 1 = \tfrac14`,
    },
    {
      id: 'zz',
      kind: 'choice',
      prompt: <>Finally, remove the middle X magnet (Z, select ↑ → Z). The last magnet shows…</>,
      options: [
        { id: 'a', label: '100 % ↑' },
        { id: 'b', label: '50 % ↑, 50 % ↓', feedback: 'Without the X measurement, nothing disturbs |0⟩.' },
        { id: 'c', label: '75 % ↑', feedback: 'There is no partial disturbance here.' },
      ],
      answer: 'a',
      hints: [<>{M`|\langle0|0\rangle|^2`}.</>],
      solution: <p>{M`|\langle 0|0\rangle|^2 = 1`}. Repeated Z measurements agree; it is the intermediate X measurement that resets the Z statistics.</p>,
    },
  ],
  solution: (
    <>
      <p>
        After Z (↑ selected) the state is {M`\ket0`}; after X (+ selected) it is {M`\ket+`}. The last Z magnet gives {M`|\langle0|+\rangle|^2 = |\langle1|+\rangle|^2 = \tfrac12`}: two beams of equal intensity.
        With the last field along x instead: {M`|\langle+|+\rangle|^2 = 1`} — a single + beam.
      </p>
    </>
  ),
  intuition: (
    <p>
      A measurement is not a passive readout: it projects the state onto an eigenvector of the measured observable. The X magnet erases all Z information, because {M`\ket+`} sits on the equator —
      equidistant from both Z poles. Measuring the same axis twice is perfectly repeatable.
    </p>
  ),
  explore: [{ path: '/stern-gerlach', label: 'Stern–Gerlach simulator' }],
};

export const PROBLEMS: Problem[] = [pUnitarity, pDiagonal, pPerturbation, pAnticomm, pComm, pConjExp, pHadamard, pHadamardRot, pEigen, pXBasis, pSequential];

export const GROUPS: { id: Problem['group']; title: string; blurb: string }[] = [
  { id: 'Time evolution', title: 'Time evolution under the Schrödinger equation', blurb: 'Unitarity, diagonal Hamiltonians, and a perturbation that tilts the rotation axis.' },
  { id: 'Pauli algebra', title: 'Pauli matrices and the matrix exponential', blurb: 'Anticommutators, commutators, conjugation inside exponentials, Hadamard as a basis change.' },
  { id: 'Measurement', title: 'Spin measurement and the Stern–Gerlach experiment', blurb: 'Eigenvectors as measurement outcomes, X-basis measurements, sequential magnets.' },
];

