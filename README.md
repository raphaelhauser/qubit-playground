# Qubit Playground

An interactive learning environment for single-qubit quantum mechanics: the Bloch sphere,
quantum gates, the Schrödinger equation, matrix exponentials, Pauli algebra and the
Stern–Gerlach experiment, with guided exercises and concept challenges.

Every picture is computed from the state vector and the operators acting on it. There are
no hand-tuned animations: a gate is animated as `R_n(s·θ)|ψ⟩` for `s ∈ [0, 1]`, time
evolution is `e^{−iHt}|ψ(0)⟩` at every frame, and Stern–Gerlach particles are sampled with
the Born rule and collapsed with projectors.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # numerical tests of identities and invariants
npm run build      # static site in dist/
```

The build is a fully static site with relative asset paths and hash-based routing, so it can
be served from any sub-path (for example GitHub Pages) without configuration.

## Deployment

`.github/workflows/deploy.yml` runs the tests, builds the site and publishes `dist/` to
GitHub Pages on every push to `main`. In the repository settings, set
**Pages → Build and deployment → Source** to **GitHub Actions**.

## Modules

| | Module | What you manipulate |
|---|---|---|
| A | Qubits & the Bloch sphere | drag the state; θ, φ, global phase γ; complex-plane amplitudes |
| B | Gates & rotations | X, Y, Z, H, S, T, R<sub>x,y,z</sub>(θ), arbitrary R<sub>n</sub>(θ); history & replay |
| C | Schrödinger equation | H = ω̄I + εX + ΔωZ, evolution time, trajectories, P(1,t) |
| D | Matrix exponentials | series terms & partial sums, eigen-decomposition, derivation of e^{−iθn·σ/2} |
| E | Pauli algebra | products, commutators, anticommutators, conjugation, HR<sub>x</sub>(θ)H = R<sub>z</sub>(θ) |
| F | Stern–Gerlach | measurement chains along X, Y, Z or any axis; blocking beams; histograms |
| G | Eigenvectors & bases | eigen-decomposition and the geometric Born rule |
| ✎ | Guided exercises | 11 step-by-step problems on time evolution, Pauli algebra and measurement |
| ? | Concept challenges | transfer questions with predictions |

## Conventions

* ħ = 1.
* `|ψ⟩ = cos(θ/2)|0⟩ + e^{iφ} sin(θ/2)|1⟩` ↔ Bloch vector `(sinθ cosφ, sinθ sinφ, cosθ)`;
  `|0⟩ = +z`, `|+⟩ = +x`, `|+i⟩ = +y`.
* `R_n(θ) = e^{−iθ n·σ/2} = cos(θ/2) I − i sin(θ/2) n·σ` rotates the Bloch vector by +θ about n
  (right-hand rule). `X = i R_x(π)`, `H = i R_{(x+z)/√2}(π)`.
* `H = ω̄I + εX + ΔωZ = ω̄I + r(v·σ)` with `r = √(ε² + Δω²)`, `v = (ε, 0, Δω)/r`, so
  `U_t = e^{−iω̄t} R_v(2rt)`. For level frequencies `H = diag(ω₁, ω₂) + εX`:
  `ω̄ = (ω₁+ω₂)/2`, `Δω = (ω₁−ω₂)/2`.

## Architecture

```
src/
  quantum/        pure TypeScript physics: complex numbers, 2×2 linear algebra, Bloch geometry,
                  gates, Hamiltonians, measurement, expression parsing, LaTeX formatting —
                  with vitest tests
  components/     KaTeX rendering with hover-linked highlights (\hl{key}{…}), the 3D Bloch
                  sphere (React Three Fiber) and its primitives, complex plane, plots, controls
  layout/         sidebar, hash router, module page shell
  modules/        one folder per learning module, plus guided exercises and concept challenges
```

Highlighting: wrap part of an equation as `\hl{theta}{\theta}` and hovering it highlights the
matching element in every visualization (and shows a tooltip); sliders do the same.

Built with React, TypeScript, Tailwind CSS, Three.js / React Three Fiber and KaTeX.
