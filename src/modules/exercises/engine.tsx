/**
 * Exercise engine: step definitions, numerical answer checking and the step UI.
 *
 * Answers are never compared as strings. Every typed expression is parsed into an AST and
 * evaluated at several random parameter values; the result is compared with the exact
 * quantum-mechanical expression from src/quantum. Common mistakes (missing 1/2, forgotten
 * complex conjugate, wrong sign of i, missing global phase…) are detected the same way.
 */
import { ComponentType, ReactNode, useMemo, useState } from 'react';
import {
  Complex,
  Mat2,
  Vec2,
  Vec3,
  c,
  abs,
  add,
  sub,
  mul,
  div,
  conj,
  arg,
  transpose,
  conjugate,
  dagger,
  matScale,
  matSub,
  frobenius,
  norm,
  inner,
  mulberry32,
  fmt,
} from '../../quantum';
import { parseExpression, evaluate, astToTex, Ast, ParseError, EvalError } from '../../quantum/parse';
import { Tex } from '../../components/Tex';
import { Button, Icon } from '../../components/ui';

// ---------------------------------------------------------------------------
// types
// ---------------------------------------------------------------------------

export interface VarSpec {
  /** canonical name used in expressions */
  name: string;
  /** KaTeX rendering */
  tex: string;
  min: number;
  max: number;
  /** alternative spellings (e.g. Greek letters) */
  aliases?: string[];
}

export type NumVars = Record<string, number>;

export interface Feedback {
  ok: boolean;
  message?: ReactNode;
}

interface StepBase {
  id: string;
  prompt: ReactNode;
  hints: ReactNode[];
  solution: ReactNode;
  /** extra remark shown when answered correctly */
  success?: ReactNode;
}

export interface ChoiceStep extends StepBase {
  kind: 'choice';
  options: { id: string; label: ReactNode; feedback?: ReactNode }[];
  answer: string;
}

export interface NumericStep extends StepBase {
  kind: 'numeric';
  /** KaTeX shown in front of the input, e.g. '\\bar\\omega =' */
  label?: string;
  answer: number;
  tol?: number;
  mistakes?: { value: number; message: ReactNode }[];
}

interface SymbolicBase extends StepBase {
  label: string;
  vars?: VarSpec[];
  /** derived quantities the learner may use (e.g. r, Δω from ω₁, ω₂, ε) */
  derive?: (v: NumVars) => NumVars;
  derivedSpecs?: { name: string; tex: string; aliases?: string[] }[];
  placeholder?: string;
}

export interface ExprStep extends SymbolicBase {
  kind: 'expr';
  expected: (v: NumVars) => Complex;
  /** 'value': compare values; 'phase': compare e^{i·value} (angles modulo 2π) */
  mode?: 'value' | 'phase';
  mistakes?: { f: (v: NumVars) => Complex; message: ReactNode }[];
}

export interface MatrixStep extends SymbolicBase {
  kind: 'matrix';
  expected: (v: NumVars) => Mat2;
  upToPhase?: boolean;
  mistakes?: { f: (v: NumVars) => Mat2; message: ReactNode }[];
}

export interface VectorStep extends SymbolicBase {
  kind: 'vector';
  expected: (v: NumVars) => Vec2;
  upToPhase?: boolean;
  mistakes?: { f: (v: NumVars) => Vec2; message: ReactNode; upToPhase?: boolean }[];
}

export interface Vec3Step extends StepBase {
  kind: 'vec3';
  label: string;
  expected: Vec3;
  tol?: number;
  mistakes?: { value: Vec3; message: ReactNode }[];
}

export type Step = ChoiceStep | NumericStep | ExprStep | MatrixStep | VectorStep | Vec3Step;

export interface Problem {
  id: string;
  group: 'Time evolution' | 'Pauli algebra' | 'Measurement';
  part: string;
  title: string;
  /** the task statement */
  statement: ReactNode;
  /** short conceptual introduction */
  intro: ReactNode;
  Viz: ComponentType;
  steps: Step[];
  solution: ReactNode;
  intuition: ReactNode;
  explore: { path: string; label: string }[];
}

export type StepStatus = 'open' | 'solved' | 'revealed';

// ---------------------------------------------------------------------------
// sampling & comparison
// ---------------------------------------------------------------------------

const TOL = 1e-6;

export function makeSamples(vars: VarSpec[] = [], derive?: (v: NumVars) => NumVars, n = 6, seed = 1234): NumVars[] {
  const rng = mulberry32(seed);
  const out: NumVars[] = [];
  for (let k = 0; k < n; k++) {
    const v: NumVars = {};
    for (const s of vars) v[s.name] = s.min + (s.max - s.min) * rng();
    out.push(derive ? { ...v, ...derive(v) } : v);
  }
  return out;
}

const close = (a: Complex, b: Complex, tol = TOL) => abs(sub(a, b)) <= tol * Math.max(1, abs(b));
const matClose = (A: Mat2, B: Mat2, tol = TOL) => frobenius(matSub(A, B)) <= tol * Math.max(1, frobenius(B));
const vecClose = (u: Vec2, v: Vec2, tol = TOL) => close(u[0], v[0], tol) && close(u[1], v[1], tol);

/** λ such that A ≈ λB (null if not proportional). */
function matRatio(A: Mat2, B: Mat2): Complex | null {
  // Frobenius inner product ⟨P, Q⟩ = Σ conj(P_ij) Q_ij
  const ip = (P: Mat2, Q: Mat2) => {
    let s = c(0);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) s = add(s, mul(conj(P[i][j]), Q[i][j]));
    return s;
  };
  const bb = ip(B, B).re;
  if (bb < 1e-14) return null;
  const lam = div(ip(B, A), c(bb));
  return matClose(A, matScale(B, lam), 1e-6) ? lam : null;
}
function vecRatio(u: Vec2, v: Vec2): Complex | null {
  const vv = norm(v) ** 2;
  if (vv < 1e-14) return null;
  const lam = div(inner(v, u), c(vv));
  return vecClose(u, [mul(v[0], lam), mul(v[1], lam)], 1e-6) ? lam : null;
}
function scalarRatio(a: Complex, b: Complex): Complex | null {
  if (abs(b) < 1e-12) return null;
  return div(a, b);
}

/** Describe a constant ratio λ between the answer and the truth. */
function describeRatio(ratios: (Complex | null)[], upToPhaseOk: boolean): ReactNode | null {
  if (ratios.some((r) => r === null)) return null;
  const rs = ratios as Complex[];
  const allUnit = rs.every((r) => Math.abs(abs(r) - 1) < 1e-6);
  const constant = rs.every((r) => close(r, rs[0], 1e-6));
  if (allUnit) {
    if (constant && close(rs[0], c(-1))) return 'The overall sign is flipped.';
    if (constant && close(rs[0], c(0, 1))) return <>Off by a factor of <Tex>{'i'}</Tex> — check the sign/placement of the imaginary unit.</>;
    if (constant && close(rs[0], c(0, -1))) return <>Off by a factor of <Tex>{'-i'}</Tex> — check the sign/placement of the imaginary unit.</>;
    if (upToPhaseOk) return null;
    return (
      <>
        Correct up to a phase factor{constant ? <> (ratio <Tex>{`\\approx e^{i\\,${fmt(arg(rs[0]), 3)}}`}</Tex>)</> : ' that depends on the parameters'}. Physically equivalent — but this step asks for the
        exact expression, including the phase.
      </>
    );
  }
  if (constant && Math.abs(rs[0].im) < 1e-6) {
    const k = rs[0].re;
    const known: [number, string][] = [
      [2, '2'],
      [0.5, '1/2'],
      [Math.SQRT2, '√2'],
      [Math.SQRT1_2, '1/√2'],
      [-2, '−2'],
      [-0.5, '−1/2'],
    ];
    for (const [v, s] of known) if (Math.abs(k - v) < 1e-6) return `Off by a constant factor of ${s}. Check normalization and factors of 1/2.`;
    return `Off by a constant factor (≈ ${fmt(k, 3)}).`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// compiled user input
// ---------------------------------------------------------------------------

export interface Compiled {
  ast: Ast | null;
  error: string | null;
}

function buildNameTables(vars: VarSpec[] = [], derived: { name: string; tex: string; aliases?: string[] }[] = []) {
  const names: string[] = [];
  const aliases: Record<string, string> = {};
  const tex: Record<string, string> = {};
  for (const v of [...vars, ...derived]) {
    names.push(v.name);
    tex[v.name] = v.tex;
    for (const a of v.aliases ?? []) aliases[a] = v.name;
  }
  return { names, aliases, tex };
}

export function compile(src: string, names: string[], aliases: Record<string, string>): Compiled {
  if (!src.trim()) return { ast: null, error: null };
  try {
    return { ast: parseExpression(src, { vars: names, aliases }), error: null };
  } catch (e) {
    return { ast: null, error: e instanceof ParseError ? e.message : String((e as Error).message) };
  }
}

function evalAt(ast: Ast, v: NumVars): Complex {
  return evaluate(ast, v);
}

// ---------------------------------------------------------------------------
// checkers
// ---------------------------------------------------------------------------

export function checkMatrix(step: MatrixStep, asts: Ast[]): Feedback {
  const samples = makeSamples(step.vars, step.derive);
  let users: Mat2[];
  try {
    users = samples.map((s) => {
      const e = asts.map((a) => evalAt(a, s));
      return [
        [e[0], e[1]],
        [e[2], e[3]],
      ] as Mat2;
    });
  } catch (err) {
    return { ok: false, message: err instanceof EvalError ? err.message : String(err) };
  }
  const exp = samples.map((s) => step.expected(s));
  if (users.every((U, i) => matClose(U, exp[i]))) return { ok: true };
  if (step.upToPhase && users.every((U, i) => {
    const r = matRatio(U, exp[i]);
    return r !== null && Math.abs(abs(r) - 1) < 1e-6;
  })) return { ok: true, message: 'Correct (up to an irrelevant global phase).' };
  for (const m of step.mistakes ?? []) if (users.every((U, i) => matClose(U, m.f(samples[i])))) return { ok: false, message: m.message };
  if (users.every((U, i) => matClose(transpose(U), exp[i]))) return { ok: false, message: 'This is the transpose of the correct matrix — check which index is the row and which the column.' };
  if (users.every((U, i) => matClose(conjugate(U), exp[i]))) return { ok: false, message: <>This is the complex conjugate of the right answer — every <Tex>{'i'}</Tex> has the wrong sign.</> };
  if (users.every((U, i) => matClose(dagger(U), exp[i]))) return { ok: false, message: <>This is the adjoint <Tex>{'(\\cdot)^\\dagger'}</Tex> of the right answer.</> };
  const ratio = describeRatio(users.map((U, i) => matRatio(U, exp[i])), !!step.upToPhase);
  if (ratio) return { ok: false, message: ratio };
  // which entries are wrong?
  const labels = ['(1,1)', '(1,2)', '(2,1)', '(2,2)'];
  const wrong = labels.filter((_, k) => users.some((U, i) => !close(U[k >> 1][k & 1], exp[i][k >> 1][k & 1])));
  if (wrong.length < 4) return { ok: false, message: `Not yet. ${wrong.length === 1 ? 'Entry' : 'Entries'} ${wrong.join(', ')} ${wrong.length === 1 ? 'is' : 'are'} off; the others are right.` };
  return { ok: false, message: 'Not yet — none of the entries match. Try a hint.' };
}

export function checkVector(step: VectorStep, asts: Ast[]): Feedback {
  const samples = makeSamples(step.vars, step.derive);
  let users: Vec2[];
  try {
    users = samples.map((s) => [evalAt(asts[0], s), evalAt(asts[1], s)] as Vec2);
  } catch (err) {
    return { ok: false, message: err instanceof EvalError ? err.message : String(err) };
  }
  const exp = samples.map((s) => step.expected(s));
  if (users.every((u, i) => vecClose(u, exp[i]))) return { ok: true };
  const ratios = users.map((u, i) => vecRatio(u, exp[i]));
  if (step.upToPhase && ratios.every((r) => r !== null && Math.abs(abs(r) - 1) < 1e-6)) return { ok: true, message: 'Correct — up to a global phase, which is physically irrelevant.' };
  for (const m of step.mistakes ?? [])
    if (users.every((u, i) => {
      const t = m.f(samples[i]);
      if (m.upToPhase) {
        const r = vecRatio(u, t);
        return r !== null && Math.abs(abs(r) - 1) < 1e-6;
      }
      return vecClose(u, t);
    }))
      return { ok: false, message: m.message };
  if (ratios.every((r) => r !== null)) {
    const ns = users.map((u) => norm(u));
    if (ns.some((n) => Math.abs(n - 1) > 1e-6) && exp.every((e) => Math.abs(norm(e) - 1) < 1e-9)) {
      return { ok: false, message: `Right direction, but not normalized: ‖v‖ = ${fmt(ns[0], 3)}. Divide by the norm.` };
    }
  }
  const ratio = describeRatio(ratios, !!step.upToPhase);
  if (ratio) return { ok: false, message: ratio };
  return { ok: false, message: 'Not yet — this is not the right vector. Check each component separately.' };
}

export function checkExpr(step: ExprStep, ast: Ast): Feedback {
  const samples = makeSamples(step.vars, step.derive);
  let users: Complex[];
  try {
    users = samples.map((s) => evalAt(ast, s));
  } catch (err) {
    return { ok: false, message: err instanceof EvalError ? err.message : String(err) };
  }
  const exp = samples.map((s) => step.expected(s));
  const eq = (a: Complex, b: Complex) => (step.mode === 'phase' ? Math.abs(a.im) < 1e-9 && close(c(Math.cos(a.re), Math.sin(a.re)), c(Math.cos(b.re), Math.sin(b.re))) : close(a, b));
  if (users.every((u, i) => eq(u, exp[i]))) return { ok: true };
  for (const m of step.mistakes ?? []) if (users.every((u, i) => eq(u, m.f(samples[i])))) return { ok: false, message: m.message };
  if (step.mode !== 'phase') {
    if (users.every((u, i) => close(conj(u), exp[i]))) return { ok: false, message: <>This is the complex conjugate of the right answer — check the sign of <Tex>{'i'}</Tex>.</> };
    const ratio = describeRatio(users.map((u, i) => scalarRatio(u, exp[i])), false);
    if (ratio) return { ok: false, message: ratio };
    if (users.every((u, i) => Math.abs(abs(u) - abs(exp[i])) < 1e-6 * Math.max(1, abs(exp[i]))))
      return { ok: false, message: 'The magnitude is right everywhere, but the phase is not. Check factors of i and phase factors like e^{−iω̄t}.' };
  } else if (users.every((u, i) => Math.abs(u.re + exp[i].re) < 1e-6)) {
    return { ok: false, message: 'Right magnitude, opposite sign.' };
  }
  return { ok: false, message: 'Not yet — the value differs from the correct expression at the test points.' };
}

export function checkNumeric(step: NumericStep, value: Complex): Feedback {
  if (Math.abs(value.im) > 1e-9) return { ok: false, message: 'Enter a real number.' };
  const x = value.re;
  const tol = step.tol ?? 1e-3;
  if (Math.abs(x - step.answer) <= tol * Math.max(1, Math.abs(step.answer))) return { ok: true };
  for (const m of step.mistakes ?? []) if (Math.abs(x - m.value) <= tol * Math.max(1, Math.abs(m.value))) return { ok: false, message: m.message };
  if (Math.abs(x + step.answer) <= tol * Math.max(1, Math.abs(step.answer)) && Math.abs(step.answer) > 1e-9) return { ok: false, message: 'Right magnitude, wrong sign.' };
  return { ok: false, message: 'Not yet.' };
}

// ---------------------------------------------------------------------------
// UI pieces
// ---------------------------------------------------------------------------

const inputCls =
  'h-9 w-full min-w-0 rounded-lg bg-ink-950/70 px-2.5 font-mono text-[13px] text-ink-100 placeholder:text-ink-500 outline-none ring-1 ring-inset ring-ink-600 focus:ring-state/70';

function ExprField({ value, onChange, compiled, placeholder, onEnter, ariaLabel }: { value: string; onChange: (s: string) => void; compiled: Compiled; placeholder?: string; onEnter?: () => void; ariaLabel?: string }) {
  return (
    <input
      aria-label={ariaLabel}
      spellCheck={false}
      autoComplete="off"
      className={`${inputCls} ${compiled.error ? 'ring-bad/60' : ''}`}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
    />
  );
}

function VarsHelp({ vars = [], derived = [] }: { vars?: VarSpec[]; derived?: { name: string; tex: string; aliases?: string[] }[] }) {
  const all = [...vars, ...derived];
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-400">
      {all.length > 0 && (
        <span>
          variables:{' '}
          {all.map((v, i) => (
            <span key={v.name} className="mr-1.5 whitespace-nowrap">
              <code className="rounded bg-ink-800 px-1 text-ink-200">{v.name}</code> <Tex>{`= ${v.tex}`}</Tex>
              {i < all.length - 1 ? '' : ''}
            </span>
          ))}
        </span>
      )}
      <span>
        also <code className="text-ink-300">i pi sqrt() exp() e^() cos() sin()</code>
      </span>
    </div>
  );
}

function Preview({ tex, error }: { tex: string | null; error: string | null }) {
  if (error) return <div className="mt-1 text-[12px] text-bad">{error}</div>;
  if (!tex) return null;
  return (
    <div className="mt-1.5 flex items-center gap-2 overflow-x-auto text-[13px] text-ink-300">
      <span className="shrink-0 text-[11px] uppercase tracking-wider text-ink-500">read as</span>
      <Tex>{tex}</Tex>
    </div>
  );
}

// --- choice ---------------------------------------------------------------

function ChoiceInput({ step, disabled, onCheck }: { step: ChoiceStep; disabled: boolean; onCheck: (f: Feedback) => void }) {
  const [sel, setSel] = useState<string | null>(null);
  return (
    <div>
      <div className="space-y-1.5">
        {step.options.map((o) => (
          <button
            key={o.id}
            disabled={disabled}
            onClick={() => setSel(o.id)}
            className={`flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] ring-1 ring-inset transition-colors ${
              sel === o.id ? 'bg-ink-700 text-ink-100 ring-state/60' : 'bg-ink-800/60 text-ink-200 ring-ink-700 hover:bg-ink-750'
            } ${disabled ? 'cursor-default opacity-80' : ''}`}
          >
            <span className={`mt-[3px] h-3 w-3 shrink-0 rounded-full border ${sel === o.id ? 'border-state bg-state' : 'border-ink-400'}`} />
            <span className="min-w-0">{o.label}</span>
          </button>
        ))}
      </div>
      {!disabled && (
        <div className="mt-2.5">
          <Button
            variant="primary"
            size="sm"
            disabled={!sel}
            onClick={() => {
              const o = step.options.find((x) => x.id === sel)!;
              onCheck(sel === step.answer ? { ok: true, message: o.feedback } : { ok: false, message: o.feedback ?? 'Not this one.' });
            }}
          >
            Check
          </Button>
        </div>
      )}
    </div>
  );
}

// --- numeric --------------------------------------------------------------

function NumericInput({ step, disabled, onCheck }: { step: NumericStep; disabled: boolean; onCheck: (f: Feedback) => void }) {
  const [s, setS] = useState('');
  const comp = useMemo(() => compile(s, [], {}), [s]);
  const value = useMemo(() => {
    if (!comp.ast) return null;
    try {
      return evaluate(comp.ast, {});
    } catch {
      return null;
    }
  }, [comp]);
  const go = () => value && onCheck(checkNumeric(step, value));
  return (
    <div>
      <div className="flex items-center gap-2">
        {step.label && (
          <span className="shrink-0 text-[14px]">
            <Tex>{step.label}</Tex>
          </span>
        )}
        <div className="w-full max-w-[220px]">
          <ExprField value={s} onChange={setS} compiled={comp} placeholder="e.g. 0.5 or pi/4" onEnter={go} ariaLabel="numeric answer" />
        </div>
        {!disabled && (
          <Button variant="primary" size="sm" disabled={!value} onClick={go}>
            Check
          </Button>
        )}
      </div>
      {comp.error ? (
        <Preview tex={null} error={comp.error} />
      ) : value && comp.ast && comp.ast.k !== 'num' ? (
        <div className="mt-1 text-[12px] text-ink-400">
          = <span className="font-mono text-ink-200">{Math.abs(value.im) < 1e-12 ? fmt(value.re, 4) : `${fmt(value.re, 4)} ${value.im < 0 ? '−' : '+'} ${fmt(Math.abs(value.im), 4)}i`}</span>
        </div>
      ) : null}
    </div>
  );
}

// --- symbolic expression ----------------------------------------------------

function ExprInput({ step, disabled, onCheck }: { step: ExprStep; disabled: boolean; onCheck: (f: Feedback) => void }) {
  const tables = useMemo(() => buildNameTables(step.vars, step.derivedSpecs), [step]);
  const [s, setS] = useState('');
  const comp = useMemo(() => compile(s, tables.names, tables.aliases), [s, tables]);
  const go = () => comp.ast && onCheck(checkExpr(step, comp.ast));
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 text-[14px]">
          <Tex>{step.label}</Tex>
        </span>
        <div className="min-w-[200px] flex-1">
          <ExprField value={s} onChange={setS} compiled={comp} placeholder={step.placeholder} onEnter={go} ariaLabel="expression answer" />
        </div>
        {!disabled && (
          <Button variant="primary" size="sm" disabled={!comp.ast} onClick={go}>
            Check
          </Button>
        )}
      </div>
      <Preview tex={comp.ast ? astToTex(comp.ast, tables.tex) : null} error={comp.error} />
      <VarsHelp vars={step.vars} derived={step.derivedSpecs} />
    </div>
  );
}

// --- matrix / vector --------------------------------------------------------

function GridInput({
  n,
  labels,
  values,
  setValues,
  comps,
  onEnter,
  shape,
}: {
  n: number;
  labels: string[];
  values: string[];
  setValues: (v: string[]) => void;
  comps: Compiled[];
  onEnter: () => void;
  shape: 'matrix' | 'column';
}) {
  return (
    <div className="flex items-stretch gap-1.5">
      <div className="w-2 rounded-l-md border-y-2 border-l-2 border-ink-400" />
      <div className={`grid flex-1 gap-1.5 ${shape === 'matrix' ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {Array.from({ length: n }, (_, k) => (
          <ExprField
            key={k}
            ariaLabel={`entry ${labels[k]}`}
            value={values[k]}
            onChange={(s) => {
              const nv = values.slice();
              nv[k] = s;
              setValues(nv);
            }}
            compiled={comps[k]}
            placeholder={labels[k]}
            onEnter={onEnter}
          />
        ))}
      </div>
      <div className="w-2 rounded-r-md border-y-2 border-r-2 border-ink-400" />
    </div>
  );
}

function MatrixVectorInput({ step, disabled, onCheck }: { step: MatrixStep | VectorStep; disabled: boolean; onCheck: (f: Feedback) => void }) {
  const isM = step.kind === 'matrix';
  const n = isM ? 4 : 2;
  const tables = useMemo(() => buildNameTables(step.vars, step.derivedSpecs), [step]);
  const [factor, setFactor] = useState('1');
  const [vals, setVals] = useState<string[]>(Array(n).fill(''));
  const comps = useMemo(() => vals.map((s) => compile(s, tables.names, tables.aliases)), [vals, tables]);
  const fcomp = useMemo(() => compile(factor || '1', tables.names, tables.aliases), [factor, tables]);
  const ready = comps.every((cp) => cp.ast) && !!fcomp.ast;
  const go = () => {
    if (!ready) return;
    const asts = comps.map((cp) => ({ k: 'bin', op: '*', a: fcomp.ast!, b: cp.ast! }) as Ast);
    onCheck(isM ? checkMatrix(step as MatrixStep, asts) : checkVector(step as VectorStep, asts));
  };
  const labels = isM ? ['a₁₁', 'a₁₂', 'a₂₁', 'a₂₂'] : ['first (|0⟩) component', 'second (|1⟩) component'];
  const err = fcomp.error ?? comps.find((cp) => cp.error)?.error ?? null;
  const previewTex = ready
    ? (() => {
        const f = astToTex(fcomp.ast!, tables.tex);
        const e = comps.map((cp) => astToTex(cp.ast!, tables.tex));
        const body = isM ? `\\begin{pmatrix} ${e[0]} & ${e[1]} \\\\ ${e[2]} & ${e[3]} \\end{pmatrix}` : `\\begin{pmatrix} ${e[0]} \\\\ ${e[1]} \\end{pmatrix}`;
        return f === '1' ? body : `${f.length > 1 && !/^\\(frac|sqrt)/.test(f) ? `\\left(${f}\\right)` : f}\\,${body}`;
      })()
    : null;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 text-[14px]">
          <Tex>{step.label}</Tex>
        </span>
        <div className="w-[96px]">
          <ExprField value={factor} onChange={setFactor} compiled={fcomp} placeholder="factor" onEnter={go} ariaLabel="common factor" />
        </div>
        <span className="text-ink-400">×</span>
        <div className={isM ? 'min-w-[260px] flex-1' : 'min-w-[200px] flex-1 max-w-[340px]'}>
          <GridInput n={n} labels={labels} values={vals} setValues={setVals} comps={comps} onEnter={go} shape={isM ? 'matrix' : 'column'} />
        </div>
      </div>
      <Preview tex={previewTex} error={err} />
      <div className="mt-1 text-[11.5px] text-ink-500">The small box is a common factor multiplying every entry (e.g. <code>1/sqrt2</code>); leave it at 1 if not needed.</div>
      <VarsHelp vars={step.vars} derived={step.derivedSpecs} />
      {!disabled && (
        <div className="mt-2.5">
          <Button variant="primary" size="sm" disabled={!ready} onClick={go}>
            Check
          </Button>
        </div>
      )}
    </div>
  );
}

function Vec3Input({ step, disabled, onCheck }: { step: Vec3Step; disabled: boolean; onCheck: (f: Feedback) => void }) {
  const [vals, setVals] = useState(['', '', '']);
  const comps = useMemo(() => vals.map((s) => compile(s, [], {})), [vals]);
  const nums = comps.map((cp) => {
    if (!cp.ast) return null;
    try {
      const z = evaluate(cp.ast, {});
      return Math.abs(z.im) < 1e-9 ? z.re : null;
    } catch {
      return null;
    }
  });
  const ready = nums.every((x) => x !== null);
  const go = () => {
    if (!ready) return;
    const u = nums as number[];
    const tol = step.tol ?? 2e-3;
    const near = (a: readonly number[], b: readonly number[]) => a.every((x, i) => Math.abs(x - b[i]) <= tol);
    if (near(u, step.expected)) return onCheck({ ok: true });
    for (const m of step.mistakes ?? []) if (near(u, m.value)) return onCheck({ ok: false, message: m.message });
    const len = Math.hypot(u[0], u[1], u[2]);
    if (len > 1e-9 && Math.abs(len - 1) > tol && near(u.map((x) => x / len), step.expected))
      return onCheck({ ok: false, message: `Right direction, but not a unit vector (length ${fmt(len, 3)}).` });
    if (near(u.map((x) => -x), step.expected)) return onCheck({ ok: false, message: 'Points the opposite way.' });
    onCheck({ ok: false, message: 'Not yet.' });
  };
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 text-[14px]">
          <Tex>{step.label}</Tex>
        </span>
        <span className="text-[18px] text-ink-400">(</span>
        {[0, 1, 2].map((k) => (
          <div key={k} className="w-[92px]">
            <ExprField
              ariaLabel={`component ${k + 1}`}
              value={vals[k]}
              onChange={(s) => {
                const nv = vals.slice();
                nv[k] = s;
                setVals(nv);
              }}
              compiled={comps[k]}
              placeholder={['x', 'y', 'z'][k]}
              onEnter={go}
            />
          </div>
        ))}
        <span className="text-[18px] text-ink-400">)</span>
        {!disabled && (
          <Button variant="primary" size="sm" disabled={!ready} onClick={go}>
            Check
          </Button>
        )}
      </div>
      {comps.find((cp) => cp.error) && <Preview tex={null} error={comps.find((cp) => cp.error)!.error} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step card
// ---------------------------------------------------------------------------

export function StepCard({
  step,
  index,
  total,
  status,
  onStatus,
}: {
  step: Step;
  index: number;
  total: number;
  status: StepStatus;
  onStatus: (s: StepStatus) => void;
}) {
  const [attempts, setAttempts] = useState(0);
  const [hints, setHints] = useState(0);
  const [fb, setFb] = useState<Feedback | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [showSol, setShowSol] = useState(status === 'revealed');
  const [collapsed, setCollapsed] = useState(status !== 'open');
  const done = status !== 'open';

  const onCheck = (f: Feedback) => {
    setAttempts((a) => a + 1);
    setFb(f);
    if (f.ok) onStatus('solved');
  };

  const reveal = () => {
    setShowSol(true);
    setConfirm(false);
    if (status === 'open') onStatus('revealed');
  };

  const statusBadge =
    status === 'solved' ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-good/15 px-2 py-0.5 text-[11px] font-medium text-good">{Icon.check} solved</span>
    ) : status === 'revealed' ? (
      <span className="rounded-full bg-phase/15 px-2 py-0.5 text-[11px] font-medium text-phase">solution viewed</span>
    ) : (
      <span className="rounded-full bg-ink-700 px-2 py-0.5 text-[11px] font-medium text-ink-300">
        step {index + 1} / {total}
      </span>
    );

  if (collapsed && done) {
    return (
      <div className="rounded-xl border border-ink-700/70 bg-ink-850/60 px-4 py-2.5">
        <button className="flex w-full items-center justify-between gap-3 text-left" onClick={() => setCollapsed(false)}>
          <span className="min-w-0 truncate text-[13px] text-ink-300">
            <span className="mr-2 text-ink-500">{index + 1}.</span>
            {step.prompt}
          </span>
          {statusBadge}
        </button>
      </div>
    );
  }

  const disabled = done;
  return (
    <div className={`animate-fadein rounded-xl border bg-ink-850/90 p-4 shadow-panel ${status === 'open' ? 'border-ink-600' : 'border-ink-700/70'}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-400">Step {index + 1}</span>
        <div className="flex items-center gap-2">
          {statusBadge}
          {done && (
            <button className="text-[11px] text-ink-400 hover:text-ink-200" onClick={() => setCollapsed(true)}>
              collapse
            </button>
          )}
        </div>
      </div>
      <div className="prose-q mb-3 text-[13.5px] text-ink-100">{step.prompt}</div>

      {step.kind === 'choice' && <ChoiceInput step={step} disabled={disabled} onCheck={onCheck} />}
      {step.kind === 'numeric' && <NumericInput step={step} disabled={disabled} onCheck={onCheck} />}
      {step.kind === 'expr' && <ExprInput step={step} disabled={disabled} onCheck={onCheck} />}
      {(step.kind === 'matrix' || step.kind === 'vector') && <MatrixVectorInput step={step} disabled={disabled} onCheck={onCheck} />}
      {step.kind === 'vec3' && <Vec3Input step={step} disabled={disabled} onCheck={onCheck} />}

      {fb && (
        <div
          role="status"
          className={`mt-3 animate-fadein rounded-lg px-3 py-2 text-[13px] ring-1 ring-inset ${fb.ok ? 'bg-good/10 text-ink-100 ring-good/40' : 'bg-bad/10 text-ink-100 ring-bad/35'}`}
        >
          <div className={`mb-0.5 text-[12px] font-semibold ${fb.ok ? 'text-good' : 'text-bad'}`}>{fb.ok ? 'Correct.' : attempts > 1 ? `Not yet (attempt ${attempts}).` : 'Not yet.'}</div>
          {fb.message && <div className="prose-q text-[13px]">{fb.message}</div>}
          {fb.ok && step.success && <div className="prose-q mt-1 text-[13px]">{step.success}</div>}
        </div>
      )}

      {/* hints */}
      {hints > 0 && (
        <div className="mt-3 space-y-1.5">
          {step.hints.slice(0, hints).map((h, i) => (
            <div key={i} className="animate-fadein rounded-lg border border-state/20 bg-state/[0.05] px-3 py-2 text-[13px] text-ink-200">
              <span className="mr-1.5 text-[11px] font-semibold uppercase tracking-wider text-state">Hint {i + 1}</span>
              <span className="prose-q">{h}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!done && hints < step.hints.length && (
          <Button size="sm" variant="ghost" onClick={() => setHints((h) => h + 1)}>
            {Icon.bulb} {hints === 0 ? 'Hint' : 'Another hint'} <span className="text-ink-500">({hints}/{step.hints.length})</span>
          </Button>
        )}
        {!showSol && !confirm && (
          <Button size="sm" variant="ghost" onClick={() => (attempts > 0 || done ? reveal() : setConfirm(true))}>
            {Icon.eye} Show solution
          </Button>
        )}
        {confirm && (
          <span className="inline-flex flex-wrap items-center gap-2 rounded-lg bg-ink-800 px-2.5 py-1 text-[12px] text-ink-300 ring-1 ring-ink-600">
            You haven't tried yet — an attempt (even a wrong one) helps it stick. Reveal anyway?
            <Button size="sm" variant="danger" onClick={reveal}>
              Reveal
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
              I'll try
            </Button>
          </span>
        )}
      </div>

      {showSol && (
        <div className="mt-3 animate-fadein rounded-lg border border-phase/25 bg-phase/[0.05] px-3 py-2.5">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-phase">Solution</div>
          <div className="prose-q text-[13px]">{step.solution}</div>
        </div>
      )}
    </div>
  );
}
