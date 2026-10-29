import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, Clock, Coins, X } from 'lucide-react';
import { api } from '../lib/api.js';
import { cn } from '../lib/cn.js';
import { useAuth } from '../stores/auth.js';
import { useToast } from '../components/ui/Toast.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { Button } from '../components/ui/Button.jsx';
import { StreakLeaf } from '../components/StreakLeaf.jsx';
import { GoalRing } from '../components/GoalRing.jsx';
import {
  formatToday,
  formatClock,
  weekDateKeys,
  WEEKDAY_LETTERS,
  unlockToastMessage,
} from '../lib/gamification.js';

/** Dashboard — prompt.md §7.1. Quests (§5, Phase 5) and the mini-leaderboard
 *  (§7, Phase 7) are the only sections deferred; everything else — header
 *  row, streak card (tiered leaf + dot grid + milestone bar), daily goal
 *  card (ring), due card, streak-repair banner — ships in Phase 4. */

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { push: toast } = useToast();
  const mergeGamification = useAuth((s) => s.mergeGamification);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const profileQuery = useQuery({
    queryKey: ['gamification', 'profile'],
    queryFn: () => api('/gamification/profile'),
  });
  const dueQuery = useQuery({
    queryKey: ['progress', 'due', 'dashboard'],
    queryFn: () => api('/progress/due?limit=1'),
  });
  const statsQuery = useQuery({
    queryKey: ['progress', 'stats'],
    queryFn: () => api('/progress/stats'),
  });

  const repairMutation = useMutation({
    mutationFn: () => api('/gamification/streak/repair', { method: 'POST' }),
    onSuccess: (data) => {
      mergeGamification({
        coins: data.coins,
        totalXP: data.totalXP,
        currentStreak: data.currentStreak,
        currentLevel: data.level,
        xpToNextLevel: data.xpToNextLevel,
      });
      for (const achievement of data.newlyUnlocked ?? []) {
        toast({ message: unlockToastMessage(achievement), tone: 'success' });
      }
      toast({ message: `Streak repaired — back to ${data.currentStreak} days.`, tone: 'success' });
      queryClient.invalidateQueries({ queryKey: ['gamification'] });
    },
    onError: (err) => toast({ message: err.message, tone: 'info' }),
  });

  const profile = profileQuery.data;
  const due = dueQuery.data;
  const loading = profileQuery.isLoading || dueQuery.isLoading || statsQuery.isLoading;
  const gardenEmpty = !statsQuery.isLoading && (statsQuery.data?.total ?? 0) === 0;

  const weekKeys = useMemo(() => weekDateKeys(), []);
  const reviewsByDay = useMemo(() => {
    const map = new Map((profile?.week ?? []).map((slot) => [slot.date, slot.reviews]));
    return weekKeys.map((key) => map.get(key) ?? 0);
  }, [profile, weekKeys]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-32 rounded-card" />
        <Skeleton className="h-24 rounded-card" />
        <Skeleton className="h-24 rounded-card" />
      </div>
    );
  }

  if (gardenEmpty) {
    return (
      <EmptyState
        headline="Your garden is empty"
        description="Start by adding kanji to your review queue. N5 takes about 3 weeks at 20 reviews per day."
        action={{ label: 'Browse N5 kanji', onClick: () => navigate('/learn?jlpt=5') }}
      />
    );
  }

  const streak = profile.currentStreak ?? 0;
  const goalMet = profile.dailyXPProgress >= profile.dailyGoalXP;
  const dueTotal = due?.total ?? 0;
  const nextReviewAt = formatClock(due?.nextDueAt);
  const repair = profile.repair;
  const showRepairBanner = repair?.available && !bannerDismissed;

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
      {/* Header row (§7.1) */}
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-3xl font-semibold text-ink-primary">Today</h1>
        <p className="text-sm text-ink-muted">{formatToday(new Date())}</p>
      </div>

      {/* Streak repair banner (§11.4) */}
      {showRepairBanner ? (
        <div className="flex items-center gap-3 rounded-card border border-line-subtle bg-surface p-4 shadow-sm">
          <StreakLeaf streak={repair.streakLost} size={28} />
          <p className="flex-1 text-sm text-ink-primary">
            Your {repair.streakLost}-day streak ended yesterday. Repair for {repair.cost} coins?
          </p>
          <Button
            variant="outline"
            size="md"
            disabled={!repair.canAfford || repairMutation.isPending}
            onClick={() => repairMutation.mutate()}
          >
            <Coins size={14} aria-hidden="true" />
            {repair.canAfford ? 'Repair' : `Need ${repair.cost} coins`}
          </Button>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setBannerDismissed(true)}
            className="rounded-control p-1 text-ink-muted transition-colors duration-fast ease-out hover:text-ink-primary"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {/* Streak card (§7.1) */}
      <section
        aria-label="Current streak"
        className="rounded-card border border-line-subtle bg-surface p-6 shadow-sm"
      >
        <div className="flex items-center gap-4">
          <StreakLeaf streak={streak} size={32} />
          <div className="min-w-0 flex-1">
            {streak > 0 ? (
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[28px] leading-none text-ink-primary">
                  {streak}
                </span>
                <span className="text-sm text-ink-secondary">day streak</span>
              </div>
            ) : (
              <p className="text-sm text-ink-secondary">Start a streak today</p>
            )}

            {/* Milestone progress bar (§7.1: streak >= 7, "10 days to Sakura") */}
            {profile.nextMilestone ? (
              <div className="mt-3">
                <div className="h-px w-full bg-line-subtle">
                  <div
                    className="h-px bg-vermillion"
                    style={{
                      width: `${Math.min((streak / profile.nextMilestone.days) * 100, 100)}%`,
                    }}
                  />
                </div>
                <p className="mt-1.5 font-mono text-xs text-ink-muted">
                  {profile.nextMilestone.remaining} days to {profile.nextMilestone.name}
                </p>
              </div>
            ) : null}
          </div>

          {/* 7-day dot grid (§7.1): M T W T F S S */}
          <div className="flex flex-col items-center gap-1.5" aria-label="Reviews this week">
            <div className="flex gap-1.5">
              {reviewsByDay.map((reviews, index) => (
                <span
                  key={index}
                  aria-hidden="true"
                  className={cn(
                    'block h-2 w-2 rounded-full',
                    reviews > 0 ? 'bg-matcha' : 'border border-line-strong'
                  )}
                />
              ))}
            </div>
            <div className="flex gap-1.5 font-mono text-[10px] text-ink-muted">
              {WEEKDAY_LETTERS.map((letter, index) => (
                <span key={index} className="w-2 text-center">
                  {letter}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Daily goal card (§7.1) */}
      <section
        aria-label="Daily goal"
        className={cn(
          'rounded-card bg-surface p-6 shadow-sm',
          goalMet ? 'border border-matcha' : 'border border-line-subtle'
        )}
      >
        <div className="flex items-center gap-4">
          <GoalRing value={profile.dailyXPProgress ?? 0} total={profile.dailyGoalXP ?? 50} />
          <div>
            <p className="text-xs uppercase tracking-[0.05em] text-ink-muted">Daily goal</p>
            <p className="mt-1 font-mono text-sm text-ink-primary">
              {profile.dailyXPProgress ?? 0} / {profile.dailyGoalXP} XP
            </p>
            {goalMet ? (
              <p className="mt-1.5 flex items-center gap-1 text-sm font-medium text-matcha">
                <CheckCircle2 size={15} aria-hidden="true" />
                Goal met
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {/* Due reviews card (§7.1) */}
      {dueTotal > 0 ? (
        <section
          aria-label="Due reviews"
          className="flex items-center justify-between rounded-card border border-line-subtle bg-surface p-6 shadow-sm"
        >
          <div>
            <p className="font-display text-4xl font-bold leading-none text-ink-primary">
              {dueTotal}
            </p>
            <p className="mt-1 text-sm text-ink-secondary">due now</p>
          </div>
          <Button onClick={() => navigate('/review')}>
            Start review
            <ArrowRight size={16} aria-hidden="true" />
          </Button>
        </section>
      ) : (
        <section
          aria-label="Due reviews"
          className="flex items-center gap-2 rounded-card bg-subtle p-6"
        >
          <Clock size={16} aria-hidden="true" className="text-ink-muted" />
          <p className="text-sm text-ink-secondary">
            {nextReviewAt ? `All caught up — next review at ${nextReviewAt}` : 'All caught up'}
          </p>
        </section>
      )}

      {/* Daily quests (§5) and mini leaderboard (§7) arrive in Phases 5/7. */}
    </div>
  );
}
