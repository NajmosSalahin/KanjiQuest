import { Check, PencilLine } from 'lucide-react';
import { Button } from '../ui/Button.jsx';
import { DrawingCanvas } from './DrawingCanvas.jsx';
import { cn } from '../../lib/cn.js';

/**
 * Drawing-canvas question — prompt.md §7.6.
 * The score, verdict, attempts and template overlay all come from the server
 * (DECISIONS.md D14); this component only renders them.
 */

const VERDICT = {
  correct: { label: 'Correct', tone: 'text-matcha' },
  close: { label: 'Close — try again', tone: 'text-indigo' },
  notQuite: { label: 'Not quite — see the strokes', tone: 'text-crimson' },
};

function Readings({ label, values }) {
  if (!values?.length) return null;
  return (
    <span>
      <span className="text-ink-muted">{label} </span>
      <span className="font-jp text-ink-primary">{values.join('、')}</span>
    </span>
  );
}

export function DrawingQuestion({
  question,
  strokes,
  onStrokesChange,
  clearKey,
  result = null,
  checking = false,
  onCheck,
  onClear,
  onContinue,
}) {
  const verdict = result ? (VERDICT[result.verdict] ?? VERDICT.notQuite) : null;
  const done = !!result?.complete;

  return (
    <section aria-labelledby="quiz-question" data-testid="quiz-drawing">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Meaning</p>
        <p className="mt-1 text-lg font-medium text-ink-primary">{question.meaning}</p>
        <p className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
          <Readings label="On" values={question.readingsOn} />
          <Readings label="Kun" values={question.readingsKun} />
        </p>
      </div>

      <p
        id="quiz-question"
        className="mt-4 text-center text-sm uppercase tracking-[0.12em] text-ink-secondary"
      >
        {question.question}
      </p>

      <div className="mt-4">
        <DrawingCanvas
          strokes={strokes}
          onChange={onStrokesChange}
          disabled={checking || done}
          overlay={result?.overlay ?? null}
          clearKey={clearKey}
        />
      </div>

      {result ? (
        <div
          className="mt-4 rounded-card border border-line-subtle bg-surface p-4 text-center"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-baseline justify-center gap-2">
            <span className="font-mono text-3xl text-ink-primary">{result.score}</span>
            <span className="font-mono text-xs text-ink-muted">/ 100</span>
          </div>
          <p className={cn('mt-1 text-sm font-medium', verdict.tone)}>{verdict.label}</p>
          {!done ? (
            <p className="mt-1 font-mono text-xs text-ink-muted">
              {result.attemptsRemaining} check{result.attemptsRemaining === 1 ? '' : 's'} left
            </p>
          ) : null}
        </div>
      ) : null}

      {done ? (
        <>
          <Button className="mt-4 w-full" onClick={onContinue}>
            <Check size={16} aria-hidden="true" />
            Continue
          </Button>
          <p className="mt-2 text-center font-mono text-xs text-ink-muted">Space to continue</p>
        </>
      ) : (
        <>
          <Button
            className="mt-4 w-full"
            onClick={onCheck}
            disabled={checking || strokes.length === 0}
          >
            <PencilLine size={16} aria-hidden="true" />
            {checking ? 'Checking…' : result ? 'Check again' : 'Check drawing'}
          </Button>
          <Button
            variant="outline"
            className="mt-2 w-full"
            onClick={onClear}
            disabled={checking || strokes.length === 0}
          >
            Clear
          </Button>
        </>
      )}
    </section>
  );
}
