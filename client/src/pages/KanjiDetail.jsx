import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Volume2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { cn } from '../lib/cn.js';
import { speakJa } from '../lib/speech.js';
import { useToast } from '../components/ui/Toast.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { StrokeOrderPlayer, FuriganaText } from '../components/StrokeOrderPlayer.jsx';

/** Kanji detail — prompt.md §7.4, matching the approved mockup layout. */

const cardHeadings = 'font-display text-lg font-medium text-ink-primary';

const STATE_LABELS = {
  new: 'New',
  learning: 'Learning',
  relearning: 'Learning again',
  review: 'Reviewing',
};

/** "next review tomorrow" style suffix (§7.4). */
function nextReviewText(progress) {
  if (progress.suspended) {
    return `buried until ${new Date(progress.suspendedUntil).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })}`;
  }
  const due = new Date(progress.dueDate);
  const diff = due.getTime() - Date.now();
  if (diff <= 0) return 'next review now';
  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOf(due) - startOf(new Date())) / 86_400_000);
  if (dayDiff <= 0) return 'next review later today';
  if (dayDiff === 1) return 'next review tomorrow';
  return `next review in ${dayDiff} days`;
}

function ReadingCard({ title, character, readings }) {
  if (!readings || readings.length === 0) return null;
  return (
    <div className="rounded-card border border-line-subtle bg-surface p-4">
      <div className="mb-3 text-xs uppercase tracking-[0.08em] text-ink-muted">{title}</div>
      <div className="flex flex-wrap gap-2">
        {readings.map((reading) => (
          <span
            key={reading}
            className="group inline-flex items-center gap-1.5 rounded-control border border-line-subtle bg-subtle px-2.5 py-1 font-jp text-xl leading-tight text-ink-primary"
          >
            <ruby>
              {character}
              <rt>{reading}</rt>
            </ruby>
            <button
              type="button"
              aria-label={`Play reading ${reading}`}
              onClick={() => speakJa(reading)}
              className="text-ink-muted transition-opacity duration-fast ease-out hover:text-ink-primary md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
            >
              <Volume2 size={14} aria-hidden="true" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

function RadicalList({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      {items.map((item, index) => (
        <div
          key={item.character}
          className={cn('flex gap-4 py-4', index > 0 ? 'border-t border-line-subtle' : '')}
        >
          <span className="font-jp-serif text-3xl leading-tight text-ink-primary">
            {item.character}
          </span>
          <div className="min-w-0">
            {item.meaning ? (
              <div className="text-sm font-medium text-ink-primary">{item.meaning}</div>
            ) : null}
            {item.mnemonic ? (
              <div className="mt-0.5 text-sm text-ink-secondary">{item.mnemonic}</div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function KanjiDetail() {
  const { character } = useParams();
  const navigate = useNavigate();
  const { push } = useToast();
  const queryClient = useQueryClient();

  const detailQuery = useQuery({
    queryKey: ['kanji-detail', character],
    queryFn: () => api(`/kanji/${encodeURIComponent(character)}`),
  });

  async function addToReview() {
    try {
      await api('/progress/add', { method: 'POST', body: { character } });
      push({ message: 'Added to your review garden.', tone: 'success' });
      await queryClient.invalidateQueries({ queryKey: ['kanji-detail', character] });
    } catch (err) {
      push({ message: err.message, tone: 'info' });
    }
  }

  // §7.4 "Remove from review" — D8 DELETE /progress/:character.
  async function removeFromReview() {
    try {
      await api(`/progress/${encodeURIComponent(character)}`, { method: 'DELETE' });
      push({ message: 'Removed from your review garden.', tone: 'success' });
      await queryClient.invalidateQueries({ queryKey: ['kanji-detail', character] });
    } catch (err) {
      push({ message: err.message, tone: 'info' });
    }
  }

  if (detailQuery.isLoading) {
    return (
      <div className="grid gap-8 lg:grid-cols-[60fr_40fr]">
        <div>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mx-auto mt-6 h-40 w-40" style={{ borderRadius: '12px' }} />
          <Skeleton className="mx-auto mb-6 h-4 w-48" />
          <Skeleton className="h-72 w-full" />
          <Skeleton className="mt-4 h-32 w-full" />
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      </div>
    );
  }

  if (detailQuery.isError) {
    return (
      <EmptyState
        headline={detailQuery.error.message || 'That kanji was not found.'}
        action={{ label: 'Back to Learn', onClick: () => navigate('/learn') }}
      />
    );
  }

  const { kanji, strokes, radicals, components, related, myProgress } = detailQuery.data;
  const hasWords = (kanji.exampleWords ?? []).length > 0;
  const sentence = (kanji.exampleSentences ?? [])[0] ?? null;

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[60fr_40fr]">
      {/* LEFT COLUMN */}
      <div>
        <Link
          to="/learn"
          className="mb-2 inline-block text-sm text-ink-muted transition-colors duration-fast ease-out hover:text-ink-secondary"
        >
          ← Back to Learn
        </Link>

        <div
          data-testid="big-kanji"
          className="py-12 text-center font-jp-serif text-ink-primary"
          style={{ fontSize: 'var(--text-kanji-2xl)', fontWeight: 400, lineHeight: 1 }}
        >
          {kanji.character}
        </div>

        <div className="mb-6 flex justify-center gap-3 text-sm text-ink-muted">
          <span>{kanji.strokeCount} strokes</span>
          <span aria-hidden="true">·</span>
          {kanji.radical ? <span>Radical: {kanji.radical}</span> : null}
        </div>

        {/* Stroke order card (§7.4 + D5 timings live in StrokeOrderPlayer;
            hasStrokeOrder:false keeps the card, replaces only the SVG) */}
        <StrokeOrderPlayer character={kanji.character} strokes={strokes} />

        {/* Readings — two-column grid, stacked mobile (§7.4) */}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <ReadingCard title="On-yomi" character={kanji.character} readings={kanji.readingsOn} />
          <ReadingCard title="Kun-yomi" character={kanji.character} readings={kanji.readingsKun} />
        </div>

        {/* Words */}
        <section className="mt-8">
          <h2 className={cn(cardHeadings, 'mb-3')}>Words</h2>
          {hasWords ? (
            <div className="space-y-2">
              {(kanji.exampleWords ?? []).map((word) => (
                <div
                  key={word.word}
                  className="flex items-baseline gap-4 rounded-card border border-line-subtle bg-surface p-4"
                >
                  <span className="font-jp-serif text-2xl text-ink-primary">{word.word}</span>
                  <span className="font-jp text-sm text-ink-muted">{word.reading}</span>
                  <span className="min-w-0 flex-1 text-sm text-ink-secondary">{word.meaning}</span>
                  {word.jlptLevel ? (
                    <span className="rounded-full border border-line-subtle bg-subtle px-2.5 py-0.5 font-mono text-xs text-ink-muted">
                      N{word.jlptLevel}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-secondary">No example words for this kanji.</p>
          )}
        </section>

        {/* In context */}
        <section className="mt-8">
          <h2 className={cn(cardHeadings, 'mb-3')}>In context</h2>
          {sentence ? (
            <div className="relative rounded-card border border-line-subtle bg-surface p-5">
              <button
                type="button"
                aria-label="Play sentence audio"
                onClick={() => speakJa(sentence.japanese)}
                className="absolute right-4 top-4 p-1 text-ink-muted transition-colors duration-fast ease-out hover:text-ink-primary"
              >
                <Volume2 size={16} aria-hidden="true" />
              </button>
              <p className="pr-8 font-jp-serif text-lg text-ink-primary" lang="ja">
                <FuriganaText tokens={sentence.tokens} />
              </p>
              <p className="mt-2 text-sm text-ink-secondary">{sentence.english}</p>
            </div>
          ) : (
            <p className="text-sm text-ink-secondary">No example sentence available.</p>
          )}
        </section>

        {/* Mnemonic */}
        {kanji.mnemonic ? (
          <section className="mt-8">
            <h2 className={cn(cardHeadings, 'mb-3')}>Remember it</h2>
            <div className="border-l-2 border-vermillion bg-subtle p-4 text-sm italic text-ink-secondary">
              {kanji.mnemonic}
            </div>
          </section>
        ) : null}
      </div>

      {/* RIGHT COLUMN (sticky) */}
      <aside className="flex flex-col gap-4 lg:sticky lg:top-[88px]">
        {myProgress ? (
          /* Already tracked (§7.4): current SRS state + remove */
          <div className="rounded-card border border-line-subtle bg-surface p-4">
            <p className="text-center text-sm text-ink-secondary">
              <span className="font-medium text-ink-primary">
                {myProgress.mastered
                  ? 'Mastered'
                  : (STATE_LABELS[myProgress.state] ?? myProgress.state)}
              </span>
              <span aria-hidden="true"> · </span>
              {nextReviewText(myProgress)}
            </p>
            <Button variant="outline" size="block" className="mt-3" onClick={removeFromReview}>
              Remove from review
            </Button>
          </div>
        ) : (
          <Button size="block" onClick={addToReview}>
            Add to review
          </Button>
        )}

        {radicals.length > 0 ? (
          <div className="rounded-card border border-line-subtle bg-surface p-5">
            <h2 className={cn(cardHeadings, 'mb-1')}>Radicals</h2>
            <RadicalList items={radicals} />
          </div>
        ) : null}

        {components.length > 0 ? (
          <div className="rounded-card border border-line-subtle bg-surface p-5">
            <h2 className={cn(cardHeadings, 'mb-1')}>Components</h2>
            <RadicalList items={components} />
          </div>
        ) : null}

        {related.length > 0 ? (
          <div className="rounded-card border border-line-subtle bg-surface p-5">
            <h2 className={cn(cardHeadings, 'mb-1')}>Related kanji</h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {related.map((entry) => (
                <Link
                  key={entry.character}
                  to={`/kanji/${encodeURIComponent(entry.character)}`}
                  className="rounded-card border border-line-subtle bg-subtle px-1 py-3 text-center transition duration-fast ease-out hover:border-line-strong hover:shadow-sm"
                >
                  <span className="block font-jp-serif text-2xl text-ink-primary">
                    {entry.character}
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] text-ink-muted">
                    {(entry.meanings ?? [])[0] ?? ''}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
