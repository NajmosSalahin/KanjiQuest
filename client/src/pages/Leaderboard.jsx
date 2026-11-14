import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trophy } from 'lucide-react';
import { api } from '../lib/api.js';
import { cn } from '../lib/cn.js';
import { useAuth } from '../stores/auth.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs.jsx';
import { Avatar } from '../components/ui/Avatar.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { Button } from '../components/ui/Button.jsx';

/** Leaderboard — prompt.md §6.12 / §7.9. */

function Rank({ rank, isYou }) {
  return (
    <span
      className={cn('font-mono text-sm', rank === null ? 'text-ink-muted' : 'text-ink-secondary')}
    >
      {rank ?? '—'}
      {isYou ? <span className="sr-only"> (you)</span> : null}
    </span>
  );
}

function BoardTable({ board, period }) {
  if (!board) return null;
  const entries = board.entries ?? [];
  const me = board.me;

  return (
    <div className="overflow-hidden rounded-card border border-line-subtle bg-surface shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line-subtle">
              <th className="w-14 px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-ink-muted">
                Rank
              </th>
              <th className="px-3 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-ink-muted">
                Player
              </th>
              <th className="hidden px-3 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-ink-muted sm:table-cell">
                Title
              </th>
              <th className="w-24 px-4 py-3 text-right font-mono text-[10px] font-medium uppercase tracking-[0.05em] text-ink-muted">
                XP
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10">
                  <EmptyState
                    compact
                    className="border-0 bg-transparent p-0 shadow-none"
                    headline={`No one has earned ${period === 'weekly' ? 'XP this week' : 'XP'} yet`}
                    description="A review or quiz is enough to claim the first rank."
                    action={{ label: 'Start reviewing', to: '/review' }}
                  />
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr
                  key={entry.userId}
                  className={cn(
                    'border-t border-line-subtle',
                    entry.isYou ? 'bg-subtle' : 'bg-surface'
                  )}
                >
                  <td
                    className={cn(
                      'px-4 py-3',
                      entry.rank <= 3
                        ? 'border-l-2 border-vermillion'
                        : 'border-l-2 border-transparent'
                    )}
                  >
                    <Rank rank={entry.rank} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar
                        size={28}
                        name={entry.displayName}
                        src={entry.avatarUrl}
                        frame={entry.equippedFrame}
                      />
                      <span className="font-medium text-ink-primary">
                        {entry.displayName}
                        {entry.isYou ? (
                          <span className="ml-2 font-mono text-[10px] uppercase tracking-wide text-vermillion">
                            You
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </td>
                  <td className="hidden px-3 py-3 text-ink-muted sm:table-cell">
                    {entry.title ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-ink-primary">
                    {entry.xp.toLocaleString('en-US')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {me ? (
            <tfoot>
              <tr className="sticky bottom-0 border-t border-line-strong bg-subtle">
                <td
                  className={cn(
                    'px-4 py-3',
                    me.rank !== null && me.rank <= 3
                      ? 'border-l-2 border-vermillion'
                      : 'border-l-2 border-transparent'
                  )}
                >
                  <Rank rank={me.rank} isYou />
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar
                      size={28}
                      name={me.displayName}
                      src={me.avatarUrl}
                      frame={me.equippedFrame}
                    />
                    <span className="font-medium text-ink-primary">
                      {me.displayName}
                      <span className="ml-2 font-mono text-[10px] uppercase tracking-wide text-vermillion">
                        You
                      </span>
                    </span>
                  </div>
                </td>
                <td className="hidden px-3 py-3 text-ink-muted sm:table-cell">{me.title ?? '—'}</td>
                <td className="px-4 py-3 text-right font-mono text-ink-primary">
                  {me.xp.toLocaleString('en-US')}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}

export default function Leaderboard() {
  const [period, setPeriod] = useState('weekly');
  const gamification = useAuth((state) => state.gamification);
  const query = useQuery({
    queryKey: ['leaderboard', period],
    queryFn: () => api(`/leaderboard?period=${period}`),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink-primary">Leaderboard</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-secondary">
            <Trophy size={15} aria-hidden="true" className="text-persimmon" />
            {period === 'weekly'
              ? 'This week · resets Monday 00:00 UTC'
              : 'All-time XP since the garden opened'}
          </p>
        </div>
        <span className="rounded-full border border-line-subtle bg-surface px-3 py-1.5 font-mono text-xs text-ink-muted">
          {gamification?.weeklyXP ?? 0} XP this week
        </span>
      </div>

      <Tabs value={period} onValueChange={setPeriod}>
        <TabsList aria-label="Leaderboard period">
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="allTime">All-time</TabsTrigger>
        </TabsList>

        {['weekly', 'allTime'].map((value) => (
          <TabsContent key={value} value={value}>
            {query.isLoading ? (
              <div className="space-y-2 rounded-card border border-line-subtle bg-surface p-4">
                {Array.from({ length: 8 }, (_, i) => (
                  <Skeleton key={i} className="h-10 rounded-control" />
                ))}
              </div>
            ) : query.isError ? (
              <EmptyState
                headline="The board is out of reach"
                description="We couldn't load the leaderboard. Try again in a moment."
                action={{ label: 'Retry', onClick: () => query.refetch() }}
              />
            ) : (
              <BoardTable board={query.data} period={value} />
            )}
          </TabsContent>
        ))}
      </Tabs>

      <div className="flex justify-center">
        <Button variant="ghost" onClick={() => query.refetch()} disabled={query.isFetching}>
          Refresh ranks
        </Button>
      </div>
    </div>
  );
}
