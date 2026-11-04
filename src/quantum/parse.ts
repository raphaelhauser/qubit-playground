/**
 * A small parser/evaluator for complex-valued expressions typed by learners, e.g.
 *
 *   "1/sqrt(2)",  "-i e^(-i w1 t)",  "cos(theta/2)",  "√2 (1+i)/2",  "|a|^2",  "e^-iwt"
 *
 * Supported: decimal numbers, i, pi/π, e, + − * / ^ (also **), unary minus, parentheses,
 * |…| absolute value bars, implicit multiplication ("2i", "3(1+i)", "i pi", "√2", "it"),
 * functions sqrt/√, exp, sin, cos, tan, sinh, cosh, abs, conj, re, im, arg, ln/log,
 * Unicode minus/times signs, and caller-supplied variables (with optional aliases such as ω1 → w1).
 *
 * An exponent written without parentheses absorbs a chain of implicit products, so "e^-iwt"
 * means e^(−i·w·t). Function arguments without parentheses take a single factor: "sin t".
 * Scientific notation is not supported ("2e" means 2·e).
 */
import { Complex, c, add, sub, mul, div, neg, conj, abs, arg, cexp, csqrt, ONE, ZERO, I as IU } from './complex';

export type FnName = 'sqrt' | 'exp' | 'sin' | 'cos' | 'tan' | 'sinh' | 'cosh' | 'abs' | 'conj' | 're' | 'im' | 'arg' | 'ln';

export type Ast =
  | { k: 'num'; v: number }
  | { k: 'const'; name: 'i' | 'pi' | 'e' }
  | { k: 'var'; name: string }
  | { k: 'neg'; a: Ast }
  | { k: 'bin'; op: '+' | '-' | '*' | '/' | 'imp'; a: Ast; b: Ast }
  | { k: 'pow'; a: Ast; b: Ast }
  | { k: 'call'; fn: FnName; a: Ast }
  | { k: 'abs'; a: Ast };

export class ParseError extends Error {
  pos: number;
  constructor(message: string, pos: number) {
    super(message);
    this.pos = pos;
    this.name = 'ParseError';
  }
}

export class EvalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EvalError';
  }
}

const FUNCTIONS: Record<string, FnName> = {
  sqrt: 'sqrt',
  exp: 'exp',
  sin: 'sin',
  cos: 'cos',
  tan: 'tan',
  sinh: 'sinh',
  cosh: 'cosh',
  abs: 'abs',
  conj: 'conj',
  re: 're',
  Re: 're',
  im: 'im',
  Im: 'im',
  arg: 'arg',
  ln: 'ln',
  log: 'ln',
};
const CONSTANTS: Record<string, 'i' | 'pi' | 'e'> = { i: 'i', pi: 'pi', π: 'pi', e: 'e' };

type Tok =
  | { t: 'num'; v: number; pos: number }
  | { t: 'id'; v: string; pos: number }
  | { t: 'op'; v: string; pos: number }
  | { t: 'end'; pos: number };

export interface ParseOptions {
  /** variable names that may appear */
  vars?: string[];
  /** alias → canonical variable name, e.g. { 'ω1': 'w1', 'ε': 'eps' } */
  aliases?: Record<string, string>;
}

function normalizeInput(src: string): string {
  return src
    .replace(/[−–—]/g, '-')
    .replace(/[·⋅×∗]/g, '*')
    .replace(/÷/g, '/')
    .replace(/\*\*/g, '^');
}

const ID_START = /[A-Za-z_Ͱ-Ͽ]/;
const ID_CONT = /[A-Za-z0-9_Ͱ-Ͽ̀-ͯ]/;

function tokenize(raw: string, opts: ParseOptions): Tok[] {
  const src = normalizeInput(raw);
  const vars = new Set(opts.vars ?? []);
  const aliases = opts.aliases ?? {};
  const known = (w: string) => w in FUNCTIONS || w in CONSTANTS || vars.has(w) || w in aliases;
  const toks: Tok[] = [];
  let p = 0;
  while (p < src.length) {
    const ch = src[p];
    if (/\s/.test(ch)) {
      p++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      const m = /^(\d+\.?\d*|\.\d+)/.exec(src.slice(p));
      if (!m || m[0] === '.') throw new ParseError(`Unexpected '.' at position ${p + 1}`, p);
      toks.push({ t: 'num', v: parseFloat(m[0]), pos: p });
      p += m[0].length;
      continue;
    }
    if (ch === '√') {
      toks.push({ t: 'id', v: 'sqrt', pos: p });
      p++;
      continue;
    }
    if (ID_START.test(ch)) {
      let q = p + 1;
      while (q < src.length && ID_CONT.test(src[q])) q++;
      const word = src.slice(p, q);
      if (known(word)) {
        toks.push({ t: 'id', v: aliases[word] ?? word, pos: p });
      } else {
        // split into known pieces, longest prefix first: "it" → i t, "sint" → sin t, "w1t" → w1 t
        let s = 0;
        while (s < word.length) {
          let found = '';
          for (let e = word.length; e > s; e--) {
            const piece = word.slice(s, e);
            if (known(piece)) {
              found = piece;
              break;
            }
          }
          if (found) {
            toks.push({ t: 'id', v: aliases[found] ?? found, pos: p + s });
            s += found.length;
            continue;
          }
          const dm = /^\d+(\.\d*)?/.exec(word.slice(s));
          if (dm) {
            toks.push({ t: 'num', v: parseFloat(dm[0]), pos: p + s });
            s += dm[0].length;
            continue;
          }
          // find the maximal unknown run for a helpful message
          let e = s + 1;
          while (e < word.length && !known(word.slice(e)) && !/\d/.test(word[e])) e++;
          const bad = word.slice(s, e);
          const avail = [...vars].concat(Object.keys(aliases));
          throw new ParseError(
            `Unknown symbol '${bad}'` + (avail.length ? `. Variables you can use: ${avail.join(', ')}` : ''),
            p + s,
          );
        }
      }
      p = q;
      continue;
    }
    if ('+-*/^()|,'.includes(ch)) {
      toks.push({ t: 'op', v: ch, pos: p });
      p++;
      continue;
    }
    if (ch === '[' || ch === '{') {
      toks.push({ t: 'op', v: '(', pos: p });
      p++;
      continue;
    }
    if (ch === ']' || ch === '}') {
      toks.push({ t: 'op', v: ')', pos: p });
      p++;
      continue;
    }
    throw new ParseError(`Unexpected character '${ch}' at position ${p + 1}`, p);
  }
  toks.push({ t: 'end', pos: src.length });
  return toks;
}

class Parser {
  private k = 0;
  private absDepth = 0;
  constructor(private toks: Tok[]) {}

  private peek(): Tok {
    return this.toks[this.k];
  }
  private next(): Tok {
    return this.toks[this.k++];
  }
  private isOp(v: string, tok = this.peek()): boolean {
    return tok.t === 'op' && tok.v === v;
  }
  private startsPrimary(tok = this.peek()): boolean {
    if (tok.t === 'num' || tok.t === 'id') return true;
    if (tok.t === 'op' && tok.v === '(') return true;
    if (tok.t === 'op' && tok.v === '|' && this.absDepth === 0) return true;
    return false;
  }

  parse(): Ast {
    if (this.peek().t === 'end') throw new ParseError('Empty expression', 0);
    const a = this.expr();
    const t = this.peek();
    if (t.t !== 'end') {
      if (t.t === 'op' && t.v === ')') throw new ParseError(`Unmatched ')' at position ${t.pos + 1}`, t.pos);
      throw new ParseError(`Unexpected '${t.t === 'op' || t.t === 'id' ? t.v : (t as { v: number }).v}' at position ${t.pos + 1}`, t.pos);
    }
    return a;
  }

  private expr(): Ast {
    let a = this.term();
    while (this.isOp('+') || this.isOp('-')) {
      const op = (this.next() as { v: string }).v as '+' | '-';
      a = { k: 'bin', op, a, b: this.term() };
    }
    return a;
  }

  private term(): Ast {
    let a = this.unary();
    for (;;) {
      if (this.isOp('*') || this.isOp('/')) {
        const op = (this.next() as { v: string }).v as '*' | '/';
        a = { k: 'bin', op, a, b: this.unary() };
      } else if (this.startsPrimary()) {
        a = { k: 'bin', op: 'imp', a, b: this.power() };
      } else break;
    }
    return a;
  }

  private unary(): Ast {
    if (this.isOp('-')) {
      this.next();
      return { k: 'neg', a: this.unary() };
    }
    if (this.isOp('+')) {
      this.next();
      return this.unary();
    }
    return this.power();
  }

  private power(): Ast {
    const base = this.primary();
    if (this.isOp('^')) {
      const caret = this.next();
      if (this.peek().t === 'end') throw new ParseError(`Missing exponent after '^' at position ${caret.pos + 1}`, caret.pos);
      return { k: 'pow', a: base, b: this.exponent() };
    }
    return base;
  }

  /** exponent: a parenthesized group, or a signed chain of implicit products ("-iwt") */
  private exponent(): Ast {
    if (this.isOp('(')) return this.power();
    if (this.isOp('-')) {
      this.next();
      return { k: 'neg', a: this.exponent() };
    }
    if (this.isOp('+')) {
      this.next();
      return this.exponent();
    }
    let a = this.power();
    while (this.startsPrimary() && !this.isOp('(')) a = { k: 'bin', op: 'imp', a, b: this.power() };
    return a;
  }

  private primary(): Ast {
    const t = this.next();
    if (t.t === 'num') return { k: 'num', v: t.v };
    if (t.t === 'id') {
      const fn = FUNCTIONS[t.v];
      if (fn) {
        if (!this.startsPrimary() && !this.isOp('-')) throw new ParseError(`Function '${t.v}' needs an argument, e.g. ${t.v}(2)`, t.pos);
        if (this.isOp('-')) {
          this.next();
          return { k: 'call', fn, a: { k: 'neg', a: this.power() } };
        }
        return { k: 'call', fn, a: this.power() };
      }
      const cst = CONSTANTS[t.v];
      if (cst) return { k: 'const', name: cst };
      return { k: 'var', name: t.v };
    }
    if (t.t === 'op' && t.v === '(') {
      if (this.isOp(')')) throw new ParseError(`Empty parentheses at position ${t.pos + 1}`, t.pos);
      const saved = this.absDepth;
      this.absDepth = 0;
      const a = this.expr();
      this.absDepth = saved;
      if (!this.isOp(')')) throw new ParseError(`Missing ')' for the '(' at position ${t.pos + 1}`, t.pos);
      this.next();
      return a;
    }
    if (t.t === 'op' && t.v === '|') {
      this.absDepth++;
      const a = this.expr();
      this.absDepth--;
      if (!this.isOp('|')) throw new ParseError(`Missing closing '|' for the one at position ${t.pos + 1}`, t.pos);
      this.next();
      return { k: 'abs', a };
    }
    if (t.t === 'end') throw new ParseError('Expression ends unexpectedly', t.pos);
    throw new ParseError(`Unexpected '${t.v}' at position ${t.pos + 1}`, t.pos);
  }
}

export function parseExpression(src: string, opts: ParseOptions = {}): Ast {
  return new Parser(tokenize(src, opts)).parse();
}

// ---------------------------------------------------------------------------
// evaluation
// ---------------------------------------------------------------------------

export type Vars = Record<string, number | Complex>;

const csin = (z: Complex): Complex => {
  // sin z = (e^{iz} − e^{−iz}) / (2i)
  const iz = mul(IU, z);
  return div(sub(cexp(iz), cexp(neg(iz))), c(0, 2));
};
const ccos = (z: Complex): Complex => {
  const iz = mul(IU, z);
  return mul(add(cexp(iz), cexp(neg(iz))), c(0.5));
};
const clog = (z: Complex): Complex => {
  if (abs(z) === 0) throw new EvalError('log(0) is undefined');
  return c(Math.log(abs(z)), arg(z));
};

function cpow(a: Complex, b: Complex): Complex {
  if (Math.abs(b.im) < 1e-14 && Math.abs(b.re - Math.round(b.re)) < 1e-14 && Math.abs(b.re) <= 64) {
    const n = Math.round(b.re);
    let r = ONE;
    const base = n >= 0 ? a : (() => {
      if (abs(a) === 0) throw new EvalError('Division by zero (0 to a negative power)');
      return div(ONE, a);
    })();
    for (let k = 0; k < Math.abs(n); k++) r = mul(r, base);
    return r;
  }
  if (abs(a) === 0) {
    if (b.re > 0) return ZERO;
    throw new EvalError('0 raised to a non-positive power');
  }
  return cexp(mul(b, clog(a)));
}

export function evaluate(ast: Ast, vars: Vars = {}): Complex {
  switch (ast.k) {
    case 'num':
      return c(ast.v);
    case 'const':
      return ast.name === 'i' ? IU : ast.name === 'pi' ? c(Math.PI) : c(Math.E);
    case 'var': {
      const v = vars[ast.name];
      if (v === undefined) throw new EvalError(`No value for '${ast.name}'`);
      return typeof v === 'number' ? c(v) : v;
    }
    case 'neg':
      return neg(evaluate(ast.a, vars));
    case 'bin': {
      const a = evaluate(ast.a, vars);
      const b = evaluate(ast.b, vars);
      switch (ast.op) {
        case '+':
          return add(a, b);
        case '-':
          return sub(a, b);
        case '*':
        case 'imp':
          return mul(a, b);
        case '/':
          if (b.re === 0 && b.im === 0) throw new EvalError('Division by zero');
          return div(a, b);
      }
      break;
    }
    case 'pow': {
      const b = evaluate(ast.b, vars);
      if (ast.a.k === 'const' && ast.a.name === 'e') return cexp(b);
      return cpow(evaluate(ast.a, vars), b);
    }
    case 'abs':
      return c(abs(evaluate(ast.a, vars)));
    case 'call': {
      const a = evaluate(ast.a, vars);
      switch (ast.fn) {
        case 'sqrt':
          return csqrt(a);
        case 'exp':
          return cexp(a);
        case 'sin':
          return csin(a);
        case 'cos':
          return ccos(a);
        case 'tan': {
          const d = ccos(a);
          if (abs(d) < 1e-15) throw new EvalError('tan is undefined here');
          return div(csin(a), d);
        }
        case 'sinh':
          return mul(sub(cexp(a), cexp(neg(a))), c(0.5));
        case 'cosh':
          return mul(add(cexp(a), cexp(neg(a))), c(0.5));
        case 'abs':
          return c(abs(a));
        case 'conj':
          return conj(a);
        case 're':
          return c(a.re);
        case 'im':
          return c(a.im);
        case 'arg':
          return c(arg(a));
        case 'ln':
          return clog(a);
      }
    }
  }
  throw new EvalError('Cannot evaluate expression');
}

/** Parse and evaluate in one go. Variable names are taken from `vars` (plus aliases). */
export function parseComplex(src: string, vars: Vars = {}, aliases: Record<string, string> = {}): Complex {
  return evaluate(parseExpression(src, { vars: Object.keys(vars), aliases }), vars);
}

export type TryResult = { ok: true; value: Complex; ast: Ast } | { ok: false; error: string; pos?: number };

export function tryParseComplex(src: string, vars: Vars = {}, aliases: Record<string, string> = {}): TryResult {
  try {
    const ast = parseExpression(src, { vars: Object.keys(vars), aliases });
    return { ok: true, value: evaluate(ast, vars), ast };
  } catch (e) {
    if (e instanceof ParseError) return { ok: false, error: e.message, pos: e.pos };
    if (e instanceof EvalError) return { ok: false, error: e.message };
    return { ok: false, error: String((e as Error).message ?? e) };
  }
}

/** Variable names an expression uses (canonical names). */
export function usedVariables(ast: Ast, out = new Set<string>()): Set<string> {
  switch (ast.k) {
    case 'var':
      out.add(ast.name);
      break;
    case 'neg':
    case 'call':
    case 'abs':
      usedVariables(ast.a, out);
      break;
    case 'bin':
    case 'pow':
      usedVariables(ast.a, out);
      usedVariables(ast.b, out);
      break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// pretty printing (so learners can see how their input was understood)
// ---------------------------------------------------------------------------

const PREC: Record<string, number> = { add: 1, mul: 2, neg: 3, pow: 4, atom: 5 };
function prec(ast: Ast): number {
  switch (ast.k) {
    case 'bin':
      return ast.op === '+' || ast.op === '-' ? PREC.add : ast.op === '/' ? PREC.atom : PREC.mul;
    case 'neg':
      return PREC.neg;
    case 'pow':
      return PREC.pow;
    default:
      return PREC.atom;
  }
}

function fmtNum(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return String(parseFloat(v.toPrecision(8)));
}

export function astToTex(ast: Ast, names: Record<string, string> = {}): string {
  const wrap = (a: Ast, min: number) => {
    const s = astToTex(a, names);
    return prec(a) < min ? `\\left(${s}\\right)` : s;
  };
  switch (ast.k) {
    case 'num':
      return fmtNum(ast.v);
    case 'const':
      return ast.name === 'pi' ? '\\pi' : ast.name;
    case 'var':
      return names[ast.name] ?? (ast.name.length > 1 ? `\\mathit{${ast.name}}` : ast.name);
    case 'neg':
      return `-${wrap(ast.a, PREC.mul)}`;
    case 'bin': {
      if (ast.op === '+') return `${astToTex(ast.a, names)} + ${wrap(ast.b, PREC.add)}`;
      if (ast.op === '-') return `${astToTex(ast.a, names)} - ${wrap(ast.b, PREC.mul)}`;
      if (ast.op === '/') return `\\frac{${astToTex(ast.a, names)}}{${astToTex(ast.b, names)}}`;
      const l = wrap(ast.a, PREC.mul);
      const r = wrap(ast.b, PREC.neg + 1);
      if (ast.op === '*') return `${l} \\cdot ${r}`;
      const needDot = ast.b.k === 'num' || (ast.b.k === 'neg');
      return needDot ? `${l} \\cdot ${r}` : ast.a.k === 'num' ? `${l}${r}` : `${l}\\,${r}`;
    }
    case 'pow': {
      const base = ast.a.k === 'call' || prec(ast.a) <= PREC.pow ? `\\left(${astToTex(ast.a, names)}\\right)` : astToTex(ast.a, names);
      return `{${base}}^{${astToTex(ast.b, names)}}`;
    }
    case 'abs':
      return `\\left|${astToTex(ast.a, names)}\\right|`;
    case 'call': {
      const inner = astToTex(ast.a, names);
      switch (ast.fn) {
        case 'sqrt':
          return `\\sqrt{${inner}}`;
        case 'abs':
          return `\\left|${inner}\\right|`;
        case 'conj':
          return `\\overline{${inner}}`;
        case 're':
          return `\\mathrm{Re}\\left(${inner}\\right)`;
        case 'im':
          return `\\mathrm{Im}\\left(${inner}\\right)`;
        case 'exp':
          return `\\exp\\left(${inner}\\right)`;
        default:
          return `\\${ast.fn}\\left(${inner}\\right)`;
      }
    }
  }
}
