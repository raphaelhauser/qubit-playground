import { describe, it, expect } from 'vitest';
import { parseComplex, tryParseComplex, parseExpression, astToTex, usedVariables, ParseError } from '../parse';
import { c, approxEq, expi, Complex } from '../complex';

const close = (a: Complex, b: Complex, tol = 1e-12) => {
  if (!approxEq(a, b, tol)) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};
const P = (s: string, vars = {}, aliases = {}) => parseComplex(s, vars, aliases);

describe('complex expression parser', () => {
  it('numbers and arithmetic with precedence', () => {
    close(P('1+2*3'), c(7));
    close(P('(1+2)*3'), c(9));
    close(P('2^3^2'), c(512));
    close(P('-2^2'), c(-4));
    close(P('1/4'), c(0.25));
    close(P('.5 + 1.25'), c(1.75));
    close(P('10 - 2 - 3'), c(5));
    close(P('8/2/2'), c(2));
  });
  it('the imaginary unit and constants', () => {
    close(P('i*i'), c(-1));
    close(P('i^2'), c(-1));
    close(P('2i'), c(0, 2));
    close(P('3 - 4i'), c(3, -4));
    close(P('pi'), c(Math.PI));
    close(P('π/2'), c(Math.PI / 2));
    close(P('e'), c(Math.E));
    close(P('e^(i pi)'), c(-1), 1e-12);
    close(P('e^(iπ/2)'), c(0, 1), 1e-12);
  });
  it('implicit multiplication', () => {
    close(P('3(1+i)'), c(3, 3));
    close(P('(1+i)(1-i)'), c(2));
    close(P('i pi'), c(0, Math.PI));
    close(P('ipi'), c(0, Math.PI));
    close(P('2pi i'), c(0, 2 * Math.PI));
    close(P('2 sqrt(2)'), c(2 * Math.SQRT2));
  });
  it('implicit multiplication binds like explicit (left to right)', () => {
    close(P('1/2i'), c(0, 0.5));
    close(P('1/(2i)'), c(0, -0.5));
  });
  it('square roots, including √ and sqrt2', () => {
    close(P('sqrt(2)'), c(Math.SQRT2));
    close(P('√2'), c(Math.SQRT2));
    close(P('1/√2'), c(Math.SQRT1_2));
    close(P('1/sqrt2'), c(Math.SQRT1_2));
    close(P('sqrt(-1)'), c(0, 1));
    close(P('√(3)/2'), c(Math.sqrt(3) / 2));
  });
  it('functions', () => {
    close(P('cos(pi)'), c(-1));
    close(P('sin(pi/2)'), c(1));
    close(P('exp(i pi/3)'), expi(Math.PI / 3));
    close(P('abs(3+4i)'), c(5));
    close(P('|3+4i|'), c(5));
    close(P('|1+i|^2'), c(2), 1e-12);
    close(P('conj(1+2i)'), c(1, -2));
    close(P('re(1+2i) + im(1+2i)'), c(3));
    close(P('tan(pi/4)'), c(1), 1e-12);
    close(P('ln(e)'), c(1));
    close(P('cosh(0) + sinh(0)'), c(1));
    close(P('sin t', { t: 0.3 }), c(Math.sin(0.3)));
    close(P('cos(i)'), c(Math.cosh(1)));
  });
  it('unicode operators', () => {
    close(P('3 − 1'), c(2));
    close(P('2·3 × 4'), c(24));
    close(P('2**3'), c(8));
    close(P('6 ÷ 3'), c(2));
  });
  it('variables, aliases and splitting of products', () => {
    const v = { t: 0.7, w1: 1.3, w2: -0.4, eps: 0.25, theta: 1.1 };
    close(P('e^(-i w1 t)', v), expi(-1.3 * 0.7));
    close(P('e^(-iw1t)', v), expi(-1.3 * 0.7));
    close(P('e^-iw1t', v), expi(-1.3 * 0.7));
    close(P('cos(theta/2)', v), c(Math.cos(0.55)));
    close(P('eps^2', v), c(0.0625));
    close(P('it', v), c(0, 0.7));
    close(P('ω1 t', v, { ω1: 'w1' }), c(1.3 * 0.7));
    close(P('ε', v, { ε: 'eps' }), c(0.25));
    close(P('θ/2', v, { θ: 'theta' }), c(0.55));
    close(P('e^(-i w1 t)/sqrt2', v), [expi(-0.91)].map((z) => c(z.re / Math.SQRT2, z.im / Math.SQRT2))[0]);
    close(P('-i e^(-i w1 t) sin(t)', v), (() => {
      const z = expi(-0.91);
      const s = Math.sin(0.7);
      return c(z.im * s, -z.re * s);
    })());
  });
  it('a parenthesized exponent does not swallow following factors', () => {
    const v = { t: 0.4 };
    close(P('e^(it)cos(t)', v), (() => {
      const z = expi(0.4);
      return c(z.re * Math.cos(0.4), z.im * Math.cos(0.4));
    })());
  });
  it('complex powers', () => {
    close(P('i^i'), c(Math.exp(-Math.PI / 2)), 1e-12);
    close(P('2^-1'), c(0.5));
    close(P('(1+i)^4'), c(-4), 1e-12);
    close(P('4^(1/2)'), c(2), 1e-12);
  });
  it('helpful errors', () => {
    const bad = (s: string, re: RegExp, vars = {}) => {
      const r = tryParseComplex(s, vars);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(re);
    };
    bad('', /Empty/);
    bad('(1+2', /Missing '\)'/);
    bad('1+2)', /Unmatched/);
    bad('x + 1', /Unknown symbol 'x'/);
    bad('sqrt', /needs an argument/);
    bad('1/0', /Division by zero/);
    bad('2^', /Missing exponent/);
    bad('3 $ 4', /Unexpected character/);
    bad('|1+2', /closing '\|'/);
    bad('()', /Empty parentheses/);
    bad('q t', /Variables you can use: t/, { t: 1 });
    expect(() => parseExpression('1 +')).toThrow(ParseError);
  });
  it('pretty prints to TeX', () => {
    const names = { w1: '\\omega_1', t: 't' };
    const tex = astToTex(parseExpression('e^(-i w1 t)/sqrt(2)', { vars: ['w1', 't'] }), names);
    expect(tex).toBe('\\frac{{e}^{-i\\,\\omega_1\\,t}}{\\sqrt{2}}');
    expect(astToTex(parseExpression('2i'))).toBe('2i');
    expect(astToTex(parseExpression('-(1+i)'))).toBe('-\\left(1 + i\\right)');
    expect(astToTex(parseExpression('|a|^2', { vars: ['a'] }))).toBe('{\\left|a\\right|}^{2}');
  });
  it('reports used variables', () => {
    const ast = parseExpression('cos(r t) - i dw/r sin(r t)', { vars: ['r', 't', 'dw'] });
    expect([...usedVariables(ast)].sort()).toEqual(['dw', 'r', 't']);
  });
});
