import { useEffect, useState } from 'react';
import { navigate } from '../../layout/router';
import { usePersistentState } from '../../hooks/animation';
import { Button, Callout, Icon } from '../../components/ui';
import { Tex } from '../../components/Tex';
import { StepCard, StepStatus, Problem } from './engine';
import { PROBLEMS, GROUPS } from './problems';

type Progress = Record<string, Record<string, Exclude<StepStatus, 'open'>>>;
export const PROGRESS_KEY = 'qp.exercises.v1';

function useProgress() {
  return usePersistentState<Progress>(PROGRESS_KEY, {});
}

function counts(p: Problem, prog: Progress) {
  const st = prog[p.id] ?? {};
  const solved = p.steps.filter((s) => st[s.id] === 'solved').length;
  const revealed = p.steps.filter((s) => st[s.id] === 'revealed').length;
  return { solved, revealed, done: solved + revealed, total: p.steps.length };
}

function ProgressBar({ solved, revealed, total }: { solved: number; revealed: number; total: number }) {
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
      <div className="h-full bg-good/80 transition-all" style={{ width: `${(100 * solved) / total}%` }} />
      <div className="h-full bg-ink-400 transition-all" style={{ width: `${(100 * revealed) / total}%` }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// overview
// ---------------------------------------------------------------------------

function Overview() {
  const [prog, setProg] = useProgress();
  const all = PROBLEMS.reduce(
    (acc, p) => {
      const k = counts(p, prog);
      return { solved: acc.solved + k.solved, revealed: acc.revealed + k.revealed, total: acc.total + k.total };
    },
    { solved: 0, revealed: 0, total: 0 },
  );
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-16 pt-7 lg:px-8">
      <div className="font-mono text-[11px] tracking-[0.06em] text-ink-400">practice</div>
      <h1 className="mt-1.5 text-[30px] font-semibold leading-[1.06] tracking-[-0.02em] text-ink-100 lg:text-[40px]">Guided exercises</h1>
      <div className="prose-q mt-2 max-w-[860px] text-ink-300">
        <p>
          Eleven problems on time evolution, Pauli algebra and spin measurement, each broken into one manageable question at a time. Type real answers — numbers, expressions, matrices, vectors — and they are checked
          numerically against the exact quantum mechanics, with targeted feedback for common slips (a missing {<Tex>{'\\tfrac12'}</Tex>}, a forgotten complex conjugate, the sign of{' '}
          {<Tex>{'i'}</Tex>}). Hints unfold one by one; solutions appear after you have tried.
        </p>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4 rounded-[10px] bg-ink-850 px-4 py-3 ring-1 ring-inset ring-ink-700">
        <div className="min-w-[200px] flex-1">
          <div className="mb-1.5 flex justify-between text-[12px] text-ink-300">
            <span>overall progress</span>
            <span className="font-mono">
              {all.solved + all.revealed}/{all.total} steps
            </span>
          </div>
          <ProgressBar {...all} />
        </div>
        <div className="flex gap-4 text-[12px] text-ink-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-good" /> solved
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-ink-400" /> solution viewed
          </span>
        </div>
        {all.solved + all.revealed > 0 && (
          <Button size="sm" variant="ghost" onClick={() => window.confirm('Reset progress for all exercises?') && setProg({})}>
            {Icon.reset} reset all
          </Button>
        )}
      </div>

      {GROUPS.map((g) => (
        <section key={g.id} className="mt-7">
          <h2 className="text-[15px] font-semibold text-ink-100">{g.title}</h2>
          <p className="mb-3 text-[13px] text-ink-400">{g.blurb}</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {PROBLEMS.filter((p) => p.group === g.id).map((p) => {
              const k = counts(p, prog);
              const complete = k.done === k.total;
              return (
                <button
                  key={p.id}
                  onClick={() => navigate(`/exercises/${p.id}`)}
                  className="group rounded-[10px] p-4 text-left ring-1 ring-inset ring-ink-700 transition-colors hover:bg-ink-850 hover:ring-ink-500"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-mono text-[10.5px] tracking-[0.05em] text-ink-400">
                        {p.group} · {p.part}
                      </div>
                      <div className="mt-0.5 text-[14.5px] font-semibold text-ink-100">{p.title}</div>
                    </div>
                    {complete && <span className="rounded-full bg-good/15 p-1 text-good">{Icon.check}</span>}
                  </div>
                  <div className="mt-3">
                    <ProgressBar solved={k.solved} revealed={k.revealed} total={k.total} />
                    <div className="mt-1.5 text-[11.5px] text-ink-400">
                      {k.done === 0 ? `${k.total} steps` : `${k.done} of ${k.total} steps`}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <div className="mt-8">
        <Callout tone="insight" title="Beyond the exercises">
          The <button className="text-phase underline decoration-phase/40 underline-offset-2" onClick={() => navigate('/concepts')}>concept challenges</button> test transfer: predicting what happens in
          situations the exercises don't cover, before seeing the answer.
        </Callout>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// one problem
// ---------------------------------------------------------------------------

function ProblemView({ problem }: { problem: Problem }) {
  const [prog, setProg] = useProgress();
  const [epoch, setEpoch] = useState(0);
  const [showFull, setShowFull] = useState(false);
  const [confirmFull, setConfirmFull] = useState(false);
  const [showIntuition, setShowIntuition] = useState(false);
  const st = prog[problem.id] ?? {};
  const statuses: StepStatus[] = problem.steps.map((s) => st[s.id] ?? 'open');
  const firstOpen = statuses.indexOf('open');
  const complete = firstOpen === -1;
  const visible = complete ? problem.steps.length : firstOpen + 1;
  const attempted = statuses.some((s) => s !== 'open');
  const idx = PROBLEMS.findIndex((p) => p.id === problem.id);
  const prev = PROBLEMS[idx - 1];
  const next = PROBLEMS[idx + 1];
  const Viz = problem.Viz;
  useEffect(() => {
    document.getElementById('main-scroll')?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, []);

  const setStatus = (stepId: string, s: StepStatus) =>
    setProg((p) => {
      const cur = { ...(p[problem.id] ?? {}) };
      if (s === 'open') delete cur[stepId];
      else if (cur[stepId] !== 'solved') cur[stepId] = s;
      return { ...p, [problem.id]: cur };
    });

  const resetProblem = () => {
    setProg((p) => {
      const n = { ...p };
      delete n[problem.id];
      return n;
    });
    setEpoch((e) => e + 1);
    setShowFull(false);
    setShowIntuition(false);
  };

  return (
    <div className="mx-auto w-full max-w-[1560px] px-4 pb-16 pt-7 lg:px-8">
      <nav className="mb-2 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-400">
        <button className="hover:text-ink-200" onClick={() => navigate('/exercises')}>
          Guided exercises
        </button>
        <span>/</span>
        <span>{problem.group}</span>
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="mt-1.5 text-[30px] font-semibold leading-[1.06] tracking-[-0.02em] text-ink-100 lg:text-[40px]">
          <span className="mr-2 text-ink-400">{problem.part}.</span>
          {problem.title}
        </h1>
        <div className="flex gap-1.5">
          <Button size="sm" variant="ghost" disabled={!prev} onClick={() => prev && navigate(`/exercises/${prev.id}`)}>
            {Icon.arrowL} prev
          </Button>
          <Button size="sm" variant="ghost" disabled={!next} onClick={() => next && navigate(`/exercises/${next.id}`)}>
            next {Icon.arrowR}
          </Button>
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-[10px] bg-ink-850 px-4 py-3 ring-1 ring-inset ring-ink-700">
          <div className="mb-1.5 font-mono text-[10.5px] tracking-[0.05em] text-ink-400">the problem</div>
          <div className="prose-q text-[13.5px] text-ink-100">{problem.statement}</div>
        </div>
        <div className="border-l-2 border-ink-400 py-1 pl-4">
          <div className="mb-1.5 font-mono text-[10.5px] tracking-[0.05em] text-ink-400">the idea</div>
          <div className="prose-q text-[13.5px]">{problem.intro}</div>
        </div>
      </div>

      <div className="mt-4 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(300px,400px)] lg:grid-cols-[minmax(0,1fr)_minmax(360px,520px)] xl:grid-cols-[minmax(0,1fr)_minmax(0,600px)]">
        {/* the visualization stays in view (below the top bar) while the steps scroll; a widget taller
            than the screen scrolls inside its own column */}
        <div className="notebook min-w-0 md:sticky md:top-[72px] md:max-h-[calc(100vh-88px)] md:self-start md:overflow-y-auto md:overscroll-contain">
          <Viz />
        </div>
        <div className="min-w-0 space-y-3">
          <div className="flex items-center justify-between gap-3 px-1">
            <div className="min-w-[160px] flex-1">
              <ProgressBar solved={statuses.filter((s) => s === 'solved').length} revealed={statuses.filter((s) => s === 'revealed').length} total={problem.steps.length} />
            </div>
            {attempted && (
              <button className="text-[11.5px] text-ink-400 hover:text-ink-200" onClick={resetProblem}>
                reset this problem
              </button>
            )}
          </div>
          {problem.steps.slice(0, visible).map((s, i) => (
            <StepCard key={`${problem.id}-${s.id}-${epoch}`} step={s} index={i} total={problem.steps.length} status={statuses[i]} onStatus={(x) => setStatus(s.id, x)} />
          ))}
          {!complete && (
            <div className="px-1 text-[12px] text-ink-500">
              {problem.steps.length - visible > 0 ? `${problem.steps.length - visible} more step${problem.steps.length - visible > 1 ? 's' : ''} unlock as you go.` : 'Last step.'}
            </div>
          )}

          {complete && (
            <div className="animate-fadein border-l-2 border-good/70 py-1 pl-4">
              <div className="flex items-center gap-2 text-[13.5px] font-semibold text-good">{Icon.check} All steps done.</div>
            </div>
          )}

          {/* full solution */}
          <div className="rounded-[10px] bg-ink-850 p-4 ring-1 ring-inset ring-ink-700">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[13.5px] font-semibold text-ink-100">Complete solution</div>
              {!showFull && !complete && !confirmFull && (
                <Button size="sm" variant="ghost" onClick={() => (attempted ? setShowFull(true) : setConfirmFull(true))}>
                  {Icon.eye} show
                </Button>
              )}
            </div>
            {confirmFull && !showFull && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] text-ink-300">
                Try at least the first step before reading the full solution?
                <Button size="sm" variant="danger" onClick={() => setShowFull(true)}>
                  Show anyway
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmFull(false)}>
                  I'll try first
                </Button>
              </div>
            )}
            {(showFull || complete) && <div className="prose-q mt-2 animate-fadein text-[13.5px]">{problem.solution}</div>}
            {!showFull && !complete && !confirmFull && <div className="mt-1 text-[12px] text-ink-500">Appears automatically once every step is done.</div>}
          </div>

          {/* intuition */}
          <div className="rounded-[10px] p-4 ring-1 ring-inset ring-ink-600">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[13.5px] font-semibold text-ink-100">
                <span className="text-phase">{Icon.bulb}</span> Physical intuition
              </div>
              {!complete && !showIntuition && (
                <Button size="sm" variant="ghost" onClick={() => setShowIntuition(true)}>
                  reveal
                </Button>
              )}
            </div>
            {(complete || showIntuition) && <div className="prose-q mt-2 animate-fadein text-[13.5px]">{problem.intuition}</div>}
          </div>

          <div className="flex flex-wrap items-center gap-2 px-1 text-[12.5px] text-ink-400">
            Explore further:
            {problem.explore.map((e) => (
              <Button key={e.path} size="sm" variant="ghost" onClick={() => navigate(e.path)}>
                {e.label} {Icon.arrowR}
              </Button>
            ))}
          </div>
          {complete && next && (
            <Button variant="primary" onClick={() => navigate(`/exercises/${next.id}`)}>
              Next: {next.title} {Icon.arrowR}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ExercisesModule({ subpath }: { subpath: string }) {
  const problem = PROBLEMS.find((p) => p.id === subpath);
  if (subpath && !problem) {
    return (
      <div className="p-8 text-ink-300">
        Unknown exercise “{subpath}”.{' '}
        <button className="text-state underline" onClick={() => navigate('/exercises')}>
          Back to the list
        </button>
      </div>
    );
  }
  return problem ? <ProblemView key={problem.id} problem={problem} /> : <Overview />;
}
