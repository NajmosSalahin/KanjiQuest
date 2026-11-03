import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { QUIZ_MODES, QUIZ_SESSION_LENGTH } from '@kanjigarden/shared';
import { api } from '../lib/api.js';
import { QUIZ_MODE_INFO } from '../components/quiz/QuizIcons.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';

/**
 * Quiz hub — prompt.md §7.5. Counts come from GET /quiz/overview (D15);
 * the label switches to "practice set" whenever the N5 fallback is in play.
 */

function HubSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[960px]" data-testid="quiz-hub-skeleton">
      <Skeleton className="h-9 w-28" />
      <Skeleton className="mt-2 h-4 w-72" />
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-64 rounded-card" />
        ))}
      </div>
      <Skeleton className="mt-4 h-40 rounded-card" />
    </div>
  );
}

function ModeCard({ mode, count, label, onStart, wide = false }) {
  const { title, description, Icon } = QUIZ_MODE_INFO[mode];

  return (
    <article
      className={
        wide
          ? 'flex flex-col gap-5 rounded-card border border-line-subtle bg-surface p-6 shadow-sm md:flex-row md:items-center'
          : 'flex flex-col rounded-card border border-line-subtle bg-surface p-6 shadow-sm'
      }
      data-testid={`quiz-mode-${mode}`}
    >
      <div className="shrink-0" aria-hidden="true">
        <Icon />
      </div>

      <div className={wide ? 'min-w-0 flex-1' : 'mt-4 flex-1'}>
        <h2 className="font-display text-lg font-medium text-ink-primary">{title}</h2>
        <p className="mt-1 text-sm text-ink-secondary">{description}</p>
        <p className="mt-2 font-mono text-xs text-ink-muted">
          From your {label}: {count} kanji
        </p>
      </div>

      <div className={wide ? 'md:w-40' : 'mt-4'}>
        <Button
          variant="outline"
          className="w-full hover:border-vermillion hover:bg-vermillion hover:text-white"
          onClick={onStart}
          disabled={count === 0}
        >
          Start
        </Button>
      </div>
    </article>
  );
}

export default function QuizHub() {
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ['quiz', 'overview'],
    queryFn: () => api('/quiz/overview'),
  });

  if (query.isLoading) return <HubSkeleton />;

  if (query.isError) {
    return (
      <div className="mx-auto w-full max-w-[960px]">
        <div className="rounded-card border border-line-subtle bg-surface p-8 text-center shadow-sm">
          <h1 className="font-display text-2xl font-semibold text-ink-primary">
            Quiz could not be loaded
          </h1>
          <p className="mx-auto mt-2 max-w-[440px] text-sm text-ink-secondary">
            {query.error?.message ?? 'Something went wrong on our side.'}
          </p>
          <Button className="mt-4" onClick={() => query.refetch()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const overview = query.data;
  const practiceModes = QUIZ_MODES.filter((mode) => mode !== 'sprint');

  return (
    <div className="mx-auto w-full max-w-[960px]">
      <header>
        <h1 className="font-display text-3xl font-semibold text-ink-primary">Quiz</h1>
        <p className="mt-2 text-sm text-ink-secondary">
          Practice without the pressure of scheduling.
        </p>
      </header>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {practiceModes.map((mode) => (
          <ModeCard
            key={mode}
            mode={mode}
            count={overview.modes[mode]?.available ?? QUIZ_SESSION_LENGTH}
            label={overview.label}
            onStart={() => navigate(`/quiz/play/${mode}`)}
          />
        ))}
      </div>

      <div className="mt-4">
        <ModeCard
          mode="sprint"
          count={overview.modes.sprint?.available ?? 0}
          label={overview.label}
          onStart={() => navigate('/quiz/play/sprint')}
          wide
        />
      </div>
    </div>
  );
}
