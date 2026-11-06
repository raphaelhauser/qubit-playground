import { ReactNode, useState } from 'react';
import { Button } from './ui';

const LETTERS = 'abcdefgh';

/**
 * "Predict, then observe." Set like an exam question: the learner commits to one lettered answer
 * before the experiment runs. `onRun` lets the host module run the actual experiment.
 */
export function PredictionCard({
  question,
  options,
  answer,
  explanation,
  onRun,
  onReset,
  runLabel = 'commit & run',
}: {
  question: ReactNode;
  options: { id: string; label: ReactNode }[];
  answer: string;
  explanation: ReactNode;
  onRun?: () => void;
  onReset?: () => void;
  runLabel?: string;
}) {
  const [choice, setChoice] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const correct = choice === answer;
  return (
    <section className="rounded-[10px] bg-ink-850 px-4 pb-4 pt-3.5 ring-1 ring-inset ring-ink-700">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[10.5px] tracking-[0.05em] text-ink-400">predict first</span>
        <span className="font-mono text-[10.5px] text-ink-500">{revealed ? 'observed' : 'commit to one answer'}</span>
      </div>
      <div className="prose-q mb-3 text-[15px] leading-snug text-ink-100">{question}</div>
      <ol className="space-y-1">
        {options.map((o, i) => {
          const sel = choice === o.id;
          const isAns = o.id === answer;
          const mark = revealed ? (isAns ? '✓' : sel ? '✗' : '') : '';
          return (
            <li key={o.id}>
              <button
                disabled={revealed}
                onClick={() => setChoice(o.id)}
                className={`group flex w-full items-start gap-3 rounded-[6px] px-2.5 py-1.5 text-left text-[14px] leading-snug transition-colors ${
                  revealed && isAns
                    ? 'bg-good/10 text-ink-100'
                    : revealed && sel
                      ? 'bg-bad/10 text-ink-100'
                      : sel
                        ? 'bg-ink-750 text-ink-100'
                        : 'text-ink-200 hover:bg-ink-800'
                } ${revealed && !isAns && !sel ? 'opacity-55' : ''}`}
              >
                <span
                  className={`mt-[1px] flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full font-mono text-[10.5px] ${
                    sel ? 'bg-ink-100 text-ink-900' : 'text-ink-400 ring-1 ring-inset ring-ink-500 group-hover:ring-ink-300'
                  }`}
                >
                  {LETTERS[i]}
                </span>
                <span className="min-w-0 flex-1">{o.label}</span>
                {mark && <span className={`font-mono text-[13px] ${isAns ? 'text-good' : 'text-bad'}`}>{mark}</span>}
              </button>
            </li>
          );
        })}
      </ol>
      <div className="mt-3 flex items-center gap-2">
        {!revealed ? (
          <Button
            variant="primary"
            size="sm"
            disabled={!choice}
            onClick={() => {
              setRevealed(true);
              onRun?.();
            }}
          >
            {runLabel}
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => {
              setRevealed(false);
              setChoice(null);
              onReset?.();
            }}
          >
            try again
          </Button>
        )}
      </div>
      {revealed && (
        <div className="mt-3 animate-fadein border-t border-ink-700 pt-3">
          <div className={`mb-1.5 font-mono text-[11px] tracking-[0.03em] ${correct ? 'text-good' : 'text-bad'}`}>
            {correct ? 'your prediction holds' : 'not what happens — compare with the figure'}
          </div>
          <div className="prose-q text-[14px]">{explanation}</div>
        </div>
      )}
    </section>
  );
}
