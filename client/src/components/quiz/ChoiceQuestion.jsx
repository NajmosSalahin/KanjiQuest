import { ArrowLeft, Check, X } from 'lucide-react';
import { cn } from '../../lib/cn.js';

/**
 * Multiple-choice + reading-match question — prompt.md §7.6.
 * Feedback is driven entirely by the server response (`correctOptionId` and
 * the selected option), so the client never evaluates an answer itself.
 */

function OptionText({ option, mode }) {
  if (mode === 'reading') {
    return (
      <ruby className="font-jp text-xl leading-tight">
        {option.text}
        <rt className="font-mono text-[0.55rem] uppercase tracking-[0.08em] text-ink-muted">
          {option.readingType === 'on' ? 'On' : 'Kun'}
        </rt>
      </ruby>
    );
  }
  return <span className="text-base text-ink-primary">{option.text}</span>;
}

export function ChoiceQuestion({
  question,
  selectedId = null,
  correctOptionId = null,
  disabled = false,
  onSelect,
}) {
  const answered = correctOptionId !== null;
  const readAloud = question.mode === 'reading' ? 'Answer' : 'Meaning';

  return (
    <section aria-labelledby="quiz-question" data-testid="quiz-choice">
      <div
        className="flex min-h-32 items-center justify-center text-center font-jp-serif text-ink-primary"
        style={{ fontSize: '6rem', lineHeight: 1, fontWeight: 400 }}
        data-testid="quiz-kanji"
      >
        {question.character}
      </div>

      <p
        id="quiz-question"
        className="mt-5 text-center text-sm uppercase tracking-[0.12em] text-ink-secondary"
      >
        {question.question}
      </p>

      <div className="mt-5 space-y-2" role="group" aria-label={readAloud}>
        {question.options.map((option, index) => {
          const isCorrect = answered && option.id === correctOptionId;
          const isWrong = answered && option.id === selectedId && option.id !== correctOptionId;
          const showArrow = isCorrect && selectedId !== correctOptionId;

          return (
            <button
              key={option.id}
              type="button"
              disabled={disabled || answered}
              aria-pressed={option.id === selectedId}
              onClick={() => onSelect(option)}
              className={cn(
                'flex w-full items-center gap-3 rounded-control border bg-surface px-3 py-3 text-left',
                'transition-colors duration-fast ease-out',
                'disabled:pointer-events-none',
                !answered && 'hover:border-line-strong',
                isCorrect && 'border-matcha bg-matcha/20',
                isWrong && 'border-crimson bg-crimson/20',
                !isCorrect && !isWrong && 'border-line-subtle'
              )}
            >
              <span className="w-4 shrink-0 font-mono text-xs text-ink-muted">{index + 1}</span>
              <span className="min-w-0 flex-1">
                <OptionText option={option} mode={question.mode} />
              </span>
              {isCorrect && !showArrow ? (
                <Check size={18} className="shrink-0 text-matcha" aria-label="Correct" />
              ) : null}
              {isWrong ? (
                <X size={18} className="shrink-0 text-crimson" aria-label="Incorrect" />
              ) : null}
              {showArrow ? (
                <ArrowLeft size={18} className="shrink-0 text-matcha" aria-label="Correct answer" />
              ) : null}
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-center font-mono text-xs text-ink-muted">
        {answered
          ? correctOptionId === selectedId
            ? 'Correct'
            : 'Not quite'
          : 'Press 1–4 to answer'}
      </p>
    </section>
  );
}
