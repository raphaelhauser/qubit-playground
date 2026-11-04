import { ReactNode, useState } from 'react';
import { Button, Icon } from './ui';

/**
 * "Predict, then observe." The learner commits to a prediction before the result is shown.
 * `onRun` lets the host module run the actual experiment in its visualization.
 */
export function PredictionCard({
  question,
  options,
  answer,
  explanation,
  onRun,
  onReset,
  runLabel = 'Lock in & run experiment',
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
    <div className="rounded-xl border border-phase/25 bg-gradient-to-b from-phase/[0.07] to-transparent p-3.5">
      <div className="mb-2 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-phase">
        {Icon.bulb} Predict first
      </div>
      <div className="prose-q mb-2.5 text-[13.5px] text-ink-100">{question}</div>
      <div className="space-y-1.5">
        {options.map((o) => {
          const sel = choice === o.id;
          const showRight = revealed && o.id === answer;
          const showWrong = revealed && sel && o.id !== answer;
          return (
            <button
              key={o.id}
              disabled={revealed}
              onClick={() => setChoice(o.id)}
              className={`flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] ring-1 ring-inset transition-colors ${
                showRight
                  ? 'bg-good/10 text-ink-100 ring-good/50'
                  : showWrong
                    ? 'bg-bad/10 text-ink-100 ring-bad/40'
                    : sel
                      ? 'bg-ink-700 text-ink-100 ring-state/50'
                      : 'bg-ink-800/60 text-ink-200 ring-ink-700 hover:bg-ink-750'
              }`}
            >
              <span className={`mt-[3px] h-3 w-3 shrink-0 rounded-full border ${sel ? 'border-state bg-state' : 'border-ink-400'}`} />
              <span className="min-w-0">{o.label}</span>
            </button>
          );
        })}
      </div>
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
            Try again
          </Button>
        )}
      </div>
      {revealed && (
        <div className="mt-3 animate-fadein rounded-lg bg-ink-800/80 p-3 ring-1 ring-inset ring-ink-700">
          <div className={`mb-1 text-[12.5px] font-semibold ${correct ? 'text-good' : 'text-p1'}`}>
            {correct ? 'Your prediction was right.' : 'Not quite — look at the visualization.'}
          </div>
          <div className="prose-q text-[13px]">{explanation}</div>
        </div>
      )}
    </div>
  );
}
