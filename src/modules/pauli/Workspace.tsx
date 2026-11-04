import { Fragment, useMemo, useState } from 'react';
import { BlochCanvas, Arrow, AxisLine, OrbitCircle, RotationArc, PointMarker } from '../../components/bloch';
import { Tex } from '../../components/Tex';
import { Card, Button, Segmented, KV, Callout, Label, Icon } from '../../components/ui';
import { useHighlight, useHoverKey } from '../../components/Highlight';
import { useTween } from '../../hooks/animation';
import { COLORS } from '../../theme';
import {
  Mat2,
  matMul,
  matAdd,
  matScaleR,
  dagger,
  transpose,
  commutator,
  anticommutator,
  matApproxEq,
  isHermitian,
  isUnitary,
  axisAngle,
  texMatrix,
  fmt,
  fmtAngle,
} from '../../quantum';
import { OpId, OPS, OP_IDS, PAULI_IDS, relation, pauliName, operatorAxis, unitaryPath, conjugate, Relation } from './pauliMath';

const REL_STYLE: Record<Relation, { label: string; cls: string }> = {
  commute: { label: 'commute: [A,B] = 0', cls: 'bg-good/10 text-good ring-good/30' },
  anticommute: { label: 'anticommute: {A,B} = 0', cls: 'bg-p1/10 text-p1 ring-p1/30' },
  neither: { label: 'neither commute nor anticommute', cls: 'bg-ink-700 text-ink-200 ring-ink-500' },
};

export function RelationBadge({ rel }: { rel: Relation }) {
  const st = REL_STYLE[rel];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-medium ring-1 ring-inset ${st.cls}`}>{st.label}</span>;
}

const fmtVec = (v: readonly number[]) => `(${fmt(v[0], 2)}, ${fmt(v[1], 2)}, ${fmt(v[2], 2)})`;

/** Matrix + its Pauli-sum name, e.g.  AB = (…) = iZ */
function MatLine({ lhs, M }: { lhs: string; M: Mat2 }) {
  const name = pauliName(M);
  return <Tex display>{`${lhs} = ${texMatrix(M)}${name.includes('.') ? '' : ` = ${name}`}`}</Tex>;
}

export function useWorkspace() {
  const [a, setA] = useState<OpId>('X');
  const [b, setB] = useState<OpId>('Y');
  return { a, setA, b, setB };
}

export function WorkspaceViz({ a, b, progress }: { a: OpId; b: OpId; progress: number }) {
  const { active } = useHighlight();
  const A = OPS[a];
  const B = OPS[b];
  const aa = axisAngle(A);
  const bAxis = operatorAxis(B);
  // image of B's axis under conjugation by the partial path U(s) of A — computed from U(s) B U(s)†
  const img = operatorAxis(conjugate(unitaryPath(A, progress), B));
  const imgFull = operatorAxis(conjugate(A, B));
  const rel = relation(A, B);
  return (
    <BlochCanvas
      labels="xyz"
      overlay={
        <>
          <div className="absolute left-3 top-3 space-y-1 rounded-lg bg-ink-900/75 px-3 py-2 text-[12.5px] ring-1 ring-ink-700 backdrop-blur">
            <div className="flex items-center gap-2"><span className="h-0.5 w-4" style={{ background: COLORS.axis }} /> rotation axis of <Tex>{`A = ${a}`}</Tex> {aa.trivial ? '(none: A ∝ I)' : `— π turn`}</div>
            <div className="flex items-center gap-2"><span className="h-0.5 w-4" style={{ background: COLORS.p0 }} /> axis of <Tex>{`B = ${b}`}</Tex> {bAxis ? '' : '(none: B ∝ I)'}</div>
            <div className="flex items-center gap-2"><span className="h-0.5 w-4" style={{ background: COLORS.p1 }} /> axis of <Tex>{'ABA^{\\dagger}'}</Tex></div>
          </div>
          <div className="absolute right-3 top-3 hidden sm:block"><RelationBadge rel={rel} /></div>
          <div className="absolute bottom-2 left-3 max-w-[75%] text-[11.5px] text-ink-400">
            Conjugating by <Tex>{'A'}</Tex> rotates the axis of <Tex>{'B'}</Tex> by A's rotation. Same axis ⇒ commute; reversed axis ⇒ anticommute.
          </div>
        </>
      }
    >
      {!aa.trivial && <AxisLine n={aa.axis} color={COLORS.axis} dashed lineWidth={active === 'A' ? 3 : 2} label={a} />}
      {bAxis && (
        <>
          <Arrow v={bAxis} color={COLORS.p0} label={b} radius={active === 'B' ? 0.026 : 0.02} />
          {!aa.trivial && <OrbitCircle n={aa.axis} through={bAxis} opacity={0.4} />}
          {!aa.trivial && progress > 0.01 && progress < 0.999 && <RotationArc n={aa.axis} from={bAxis} angle={aa.angle * progress} color={COLORS.axis} lineWidth={1.8} />}
        </>
      )}
      {img && (progress > 0.999 ? imgFull : img) && (
        <Arrow v={(progress > 0.999 ? imgFull : img)!} color={COLORS.p1} label={progress > 0.999 ? 'ABA^{\\dagger}' : undefined} radius={active === 'conj' ? 0.026 : 0.018} opacity={0.95} />
      )}
      {img && <PointMarker v={img} color={COLORS.p1} size={0.035} />}
    </BlochCanvas>
  );
}

export function WorkspaceControls({ a, setA, b, setB, onAnimate, running }: { a: OpId; setA: (o: OpId) => void; b: OpId; setB: (o: OpId) => void; onAnimate: () => void; running: boolean }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
      <Card title="Choose two matrices" kicker="workspace">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="w-6 text-[13px] text-ink-300"><Tex>A</Tex></span>
            <Segmented value={a} onChange={setA} options={OP_IDS.map((o) => ({ value: o, label: o, tex: o }))} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="w-6 text-[13px] text-ink-300"><Tex>B</Tex></span>
            <Segmented value={b} onChange={setB} options={OP_IDS.map((o) => ({ value: o, label: o, tex: o }))} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => { setA(b); setB(a); }}>swap A ↔ B</Button>
            <Button size="sm" variant="primary" onClick={onAnimate} disabled={running}>
              {Icon.play} animate <Tex>{'A B A^\\dagger'}</Tex>
            </Button>
          </div>
        </div>
      </Card>
      <PauliTable a={a} b={b} onPick={(x, y) => { setA(x); setB(y); }} />
      <CyclicDiagram onPick={(x, y) => { setA(x); setB(y); }} a={a} b={b} />
      <Card title="Index form" kicker="all nine products at once">
        <Tex display>{'\\sigma_j\\sigma_k = \\delta_{jk}\\,I + i\\,\\varepsilon_{jkl}\\,\\sigma_l'}</Tex>
        <p className="text-[12.5px] leading-relaxed text-ink-400">
          Symmetrizing gives <Tex>{'\\{\\sigma_j,\\sigma_k\\} = 2\\delta_{jk}I'}</Tex>, antisymmetrizing gives{' '}
          <Tex>{'[\\sigma_j,\\sigma_k] = 2i\\varepsilon_{jkl}\\sigma_l'}</Tex>. Every product of two Paulis is again a Pauli, times a phase{' '}
          <Tex>{'\\pm 1, \\pm i'}</Tex>.
        </p>
      </Card>
    </div>
  );
}

export function WorkspacePanel({ a, b }: { a: OpId; b: OpId }) {
  const A = OPS[a];
  const B = OPS[b];
  const AB = matMul(A, B);
  const BA = matMul(B, A);
  const comm = commutator(A, B);
  const anti = anticommutator(A, B);
  const rel = relation(A, B);
  const conj = conjugate(A, B);
  const ABdag = dagger(AB);
  const okRev = matApproxEq(ABdag, matMul(dagger(B), dagger(A)));
  const okFwd = matApproxEq(ABdag, matMul(dagger(A), dagger(B)));
  const okSplit = matApproxEq(AB, matAdd(matScaleR(comm, 0.5), matScaleR(anti, 0.5)));
  const hover = useHoverKey();
  return (
    <>
      <Card title="Products" kicker="order matters" right={<RelationBadge rel={rel} />}>
        <MatLine lhs={`${a}${b}`} M={AB} />
        <MatLine lhs={`${b}${a}`} M={BA} />
        {rel === 'anticommute' && <p className="text-[12.5px] text-ink-400">Reversing the order flips the sign: <Tex>{`${b}${a} = -${a}${b}`}</Tex>.</p>}
        {rel === 'commute' && <p className="text-[12.5px] text-ink-400">The order does not matter: <Tex>{`${a}${b} = ${b}${a}`}</Tex>.</p>}
      </Card>
      <Card title="Commutator and anticommutator" kicker="(anti)commutation">
        <MatLine lhs={`[${a},${b}]`} M={comm} />
        <MatLine lhs={`\\{${a},${b}\\}`} M={anti} />
        <div className="mt-1 text-[12px] text-ink-400">
          check <Tex>{'AB = \\tfrac12[A,B] + \\tfrac12\\{A,B\\}'}</Tex> <span className={okSplit ? 'text-good' : 'text-bad'}>{okSplit ? '✓' : '✗'}</span>
        </div>
      </Card>
      <Card title="Conjugation" kicker="the geometric meaning">
        <div {...hover('conj', 'A B A† — the axis of B rotated by A.')}>
          <MatLine lhs={`${a}${b}${a}^{\\dagger}`} M={conj} />
        </div>
        <p className="text-[12.5px] leading-relaxed text-ink-400">
          If <Tex>{'B = \\vec b\\cdot\\vec\\sigma'}</Tex> then <Tex>{'ABA^\\dagger = (R_A\\vec b)\\cdot\\vec\\sigma'}</Tex>, where <Tex>{'R_A'}</Tex> is the Bloch rotation of{' '}
          <Tex>{'A'}</Tex>. For Pauli pairs <Tex>{'ABA^\\dagger = \\pm B'}</Tex>: <Tex>{'+'}</Tex> exactly when they commute, <Tex>{'-'}</Tex> when they anticommute.
        </p>
        <div className="mt-2 space-y-0.5">
          <KV k="axis of B" v={operatorAxis(B) ? fmtVec(operatorAxis(B)!) : '— (B ∝ I)'} />
          <KV k="axis of ABA†" v={operatorAxis(conj) ? fmtVec(operatorAxis(conj)!) : '—'} />
          <KV k="rotation of A" v={axisAngle(A).trivial ? 'none' : `${fmtAngle(axisAngle(A).angle)} about ${fmtVec(axisAngle(A).axis)}`} />
        </div>
      </Card>
      <Card title="Hermitian conjugation" kicker="dagger = conjugate transpose">
        <Tex display>{`${a}^{T} = ${texMatrix(transpose(A))},\\quad ${a}^{\\dagger} = \\overline{${a}^{T}} = ${texMatrix(dagger(A))}`}</Tex>
        <div className="grid grid-cols-2 gap-x-4 text-[12.5px]">
          <KV k={<Tex>{`${a}^\\dagger = ${a}`}</Tex>} v={<span className={isHermitian(A) ? 'text-good' : 'text-bad'}>{isHermitian(A) ? 'Hermitian ✓' : 'no'}</span>} />
          <KV k={<Tex>{`${a}^\\dagger ${a} = I`}</Tex>} v={<span className={isUnitary(A) ? 'text-good' : 'text-bad'}>{isUnitary(A) ? 'unitary ✓' : 'no'}</span>} />
          <KV k={<Tex>{`${b}^\\dagger = ${b}`}</Tex>} v={<span className={isHermitian(B) ? 'text-good' : 'text-bad'}>{isHermitian(B) ? 'Hermitian ✓' : 'no'}</span>} />
          <KV k={<Tex>{`${b}^\\dagger ${b} = I`}</Tex>} v={<span className={isUnitary(B) ? 'text-good' : 'text-bad'}>{isUnitary(B) ? 'unitary ✓' : 'no'}</span>} />
        </div>
        <Label className="mb-1 mt-3">identities, checked numerically</Label>
        <MatLine lhs={`(${a}${b})^{\\dagger}`} M={ABdag} />
        <div className="space-y-0.5 text-[12.5px]">
          <KV k={<Tex>{'(AB)^\\dagger = B^\\dagger A^\\dagger'}</Tex>} v={<span className={okRev ? 'text-good' : 'text-bad'}>{okRev ? '✓ always' : '✗'}</span>} />
          <KV k={<Tex>{'(AB)^\\dagger = A^\\dagger B^\\dagger'}</Tex>} v={<span className={okFwd ? 'text-good' : 'text-ink-400'}>{okFwd ? '✓ (here, since they commute)' : '✗ order reversed!'}</span>} />
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-ink-400">
          All five matrices are Hermitian <em>and</em> unitary, so <Tex>{'A^2 = A^\\dagger A = I'}</Tex>. Their product <Tex>{'AB'}</Tex> is unitary but Hermitian only when they
          commute — e.g. <Tex>{'XY = iZ'}</Tex> is anti-Hermitian.
        </p>
      </Card>
      {rel === 'neither' && (
        <Callout tone="insight" title="Neither?">
          Commuting and anticommuting are special: they happen when the axes are parallel or perpendicular. <Tex>{'H'}</Tex>'s axis sits at 45° to x and z, so it does
          neither with <Tex>{'X'}</Tex> or <Tex>{'Z'}</Tex> — conjugation maps <Tex>{'X \\leftrightarrow Z'}</Tex> instead.
        </Callout>
      )}
    </>
  );
}

function PauliTable({ a, b, onPick }: { a: OpId; b: OpId; onPick: (a: OpId, b: OpId) => void }) {
  const cells = useMemo(
    () => PAULI_IDS.map((r) => PAULI_IDS.map((c) => ({ r, c, name: pauliName(matMul(OPS[r], OPS[c])), rel: relation(OPS[r], OPS[c]) }))),
    [],
  );
  return (
    <Card title="Multiplication table" kicker="row × column — click a cell">
      <div className="grid grid-cols-5 gap-1 text-center text-[13px]">
        <div />
        {PAULI_IDS.map((c) => (
          <div key={c} className="py-1 text-ink-400"><Tex>{c}</Tex></div>
        ))}
        {cells.map((row, i) => (
          <Fragment key={i}>
            <div className="py-1.5 text-ink-400"><Tex>{PAULI_IDS[i]}</Tex></div>
            {row.map((cell) => {
              const on = cell.r === a && cell.c === b;
              return (
                <button
                  key={cell.r + cell.c}
                  onClick={() => onPick(cell.r, cell.c)}
                  className={`rounded-md py-1.5 ring-1 ring-inset transition-colors ${
                    on ? 'bg-state/20 ring-state' : cell.rel === 'anticommute' ? 'bg-p1/[0.06] ring-ink-700 hover:bg-p1/15' : 'bg-good/[0.05] ring-ink-700 hover:bg-good/15'
                  }`}
                >
                  <Tex>{cell.name}</Tex>
                </button>
              );
            })}
          </Fragment>
        ))}
      </div>
      <div className="mt-2 flex gap-4 text-[11.5px] text-ink-400">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-good/30" /> commuting pair</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-p1/30" /> anticommuting pair</span>
      </div>
    </Card>
  );
}

function CyclicDiagram({ onPick, a, b }: { onPick: (a: OpId, b: OpId) => void; a: OpId; b: OpId }) {
  const nodes: Record<'X' | 'Y' | 'Z', [number, number]> = { X: [100, 22], Y: [172, 140], Z: [28, 140] };
  const edges: { from: 'X' | 'Y' | 'Z'; to: 'X' | 'Y' | 'Z'; third: string }[] = [
    { from: 'X', to: 'Y', third: 'Z' },
    { from: 'Y', to: 'Z', third: 'X' },
    { from: 'Z', to: 'X', third: 'Y' },
  ];
  const [hov, setHov] = useState<number | null>(null);
  const current = edges.findIndex((e) => (e.from === a && e.to === b) || (e.to === a && e.from === b));
  const forward = current >= 0 && edges[current].from === a;
  const shown = hov ?? (current >= 0 ? current : null);
  return (
    <Card title="The cyclic rule" kicker="XY = iZ and cyclic">
      <div className="grid grid-cols-[150px_1fr] items-center gap-3">
        <svg viewBox="0 0 200 165" className="w-full">
          <defs>
            <marker id="cyc-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0 0 L10 5 L0 10 z" fill={COLORS.axis} />
            </marker>
          </defs>
          {edges.map((e, i) => {
            const [x1, y1] = nodes[e.from];
            const [x2, y2] = nodes[e.to];
            const k = 0.22;
            const sx = x1 + (x2 - x1) * k;
            const sy = y1 + (y2 - y1) * k;
            const ex = x1 + (x2 - x1) * (1 - k);
            const ey = y1 + (y2 - y1) * (1 - k);
            const hot = shown === i;
            return (
              <g key={i} className="cursor-pointer" onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)} onClick={() => onPick(e.from as OpId, e.to as OpId)}>
                <line x1={sx} y1={sy} x2={ex} y2={ey} stroke="transparent" strokeWidth={16} />
                <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={COLORS.axis} strokeWidth={hot ? 3 : 1.8} markerEnd="url(#cyc-head)" opacity={hot ? 1 : 0.75} />
              </g>
            );
          })}
          {(Object.keys(nodes) as ('X' | 'Y' | 'Z')[]).map((k) => (
            <g key={k}>
              <circle cx={nodes[k][0]} cy={nodes[k][1]} r={16} fill={COLORS.panel} stroke={COLORS[k.toLowerCase() as 'x' | 'y' | 'z']} strokeWidth={1.5} />
              <text x={nodes[k][0]} y={nodes[k][1] + 5} textAnchor="middle" fill={COLORS.text} fontSize={15} fontStyle="italic" fontFamily="KaTeX_Math, serif">
                {k}
              </text>
            </g>
          ))}
          <text x={100} y={102} textAnchor="middle" fill={COLORS.muted} fontSize={11}>× i</text>
        </svg>
        <div className="space-y-1 text-[13px]">
          {edges.map((e, i) => (
            <button
              key={i}
              onClick={() => onPick(e.from as OpId, e.to as OpId)}
              onMouseEnter={() => setHov(i)}
              onMouseLeave={() => setHov(null)}
              className={`grid w-full grid-cols-2 gap-2 whitespace-nowrap rounded-md px-2 py-0.5 text-left ${shown === i ? 'bg-ink-750' : 'hover:bg-ink-800'}`}
            >
              <Tex>{`${e.from}${e.to} = i${e.third}`}</Tex>
              <span className="text-ink-300"><Tex>{`${e.to}${e.from} = -i${e.third}`}</Tex></span>
            </button>
          ))}
          <p className="pt-1 text-[12px] leading-snug text-ink-400">
            Along the arrows: <Tex>{'+i'}</Tex>. Against them: <Tex>{'-i'}</Tex>. {current >= 0 && <>Selected: {forward ? 'along' : 'against'} the arrow.</>}
          </p>
        </div>
      </div>
    </Card>
  );
}

export function useConjugationTween() {
  return useTween();
}
