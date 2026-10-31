import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CheckCheck,
  Clock,
  Coins,
  Layers,
  Moon,
  Pencil,
  Sparkles,
  Sun,
  Target,
  Trophy,
  X,
  Zap,
} from 'lucide-react';
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

/** Dashboard — prompt.md §7.1. The mini-leaderboard is the only section
 *  deferred to Phase 7; quests ship in Phase 5. */

const QUEST_ICONS = {
  'review-10': Layers,
  'review-20': Layers,
  'correct-5': Target,
  'quiz-session': Sparkles,
  'quiz-perfect': Trophy,
  'earn-100xp': Zap,
  'learn-3': BookOpen,
  'clear-due': CheckCheck,
  'drawing-quiz': Pencil,
  'stroke-quiz': Pencil,
  'before-10': Sun,
  'after-20': Moon,
};

function QuestIcon({ id, completed }) {
  const Icon = QUEST_ICONS[id] ?? Sparkles;
  return (
    <span
      aria-hidden="true"
      className={cn(
        'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-control',
        completed ? 'bg-subtle text-matcha' : 'bg-subtle text-vermillion'
      )}
    >
      <Icon size={17} strokeWidth={1.8} />
    </span>
  );
}

function useQuestCountdown(queryClient) {
  const [now, setNow] = useState(() => new Date());
  const dayRef = useRef(now.toDateString());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const key = now.toDateString();
    if (dayRef.current !== key) {
      dayRef.current = key;
      queryClient.invalidateQueries({ queryKey: ['quests', 'today'] });
    }
  }, [now, queryClient]);

  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  const minutes = Math.max(0, Math.ceil((next.getTime() - now.getTime()) / 60_000));
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

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
  const questsQuery = useQuery({
    queryKey: ['quests', 'today'],
    queryFn: () => api('/quests/today'),
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
  const countdown = useQuestCountdown(queryClient);

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

      {/* Daily quests (§6.7 / §7.1) */}
      <section
        aria-label="Daily quests"
        className="rounded-card border border-line-subtle bg-surface p-6 shadow-sm"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink-primary">Daily quests</h2>
            <p className="mt-0.5 text-sm text-ink-muted">Three small wins for today.</p>
          </div>
          <p className="shrink-0 font-mono text-xs text-ink-muted">Resets in {countdown}</p>
        </div>

        {questsQuery.isLoading ? (
          <div className="mt-4 space-y-3">
            <Skeleton className="h-14 rounded-control" />
            <Skeleton className="h-14 rounded-control" />
            <Skeleton className="h-14 rounded-control" />
          </div>
        ) : questsQuery.isError ? (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-control bg-subtle px-3 py-2">
            <p className="text-sm text-ink-secondary">Today's quests are unavailable.</p>
            <Button size="md" variant="ghost" onClick={() => questsQuery.refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <>
            <ul className="mt-4 space-y-3">
              {(questsQuery.data?.quests ?? []).map((quest) => {
                const progress = Math.min(quest.progress ?? 0, quest.target ?? 1);
                const percent = Math.min(100, (progress / (quest.target || 1)) * 100);
                return (
                  <li
                    key={quest.id}
                    className={cn(
                      'rounded-control border px-3 py-3',
                      quest.completed ? 'border-matcha bg-subtle' : 'border-line-subtle bg-surface'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <QuestIcon id={quest.id} completed={quest.completed} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p
                              className={cn(
                                'truncate text-sm font-medium',
                                quest.completed ? 'text-ink-muted line-through' : 'text-ink-primary'
                              )}
                            >
                              {quest.title}
                            </p>
                            <p className="mt-0.5 text-xs text-ink-muted">{quest.description}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            {quest.completed ? (
                              <span className="inline-flex items-center gap-1 font-mono text-xs font-medium text-matcha">
                                <CheckCircle2 size={14} aria-hidden="true" />+
                                {quest.xpAwarded || quest.xpReward} XP
                              </span>
                            ) : (
                              <span className="font-mono text-xs text-ink-secondary">
                                {quest.xpReward} XP
                                <span className="mx-1 text-line-strong">·</span>
                                {quest.coinReward} coins
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="h-1 flex-1 overflow-hidden rounded-full bg-line-subtle">
                            <div
                              className={cn(
                                'h-1 rounded-full',
                                quest.completed ? 'bg-matcha' : 'bg-indigo'
                              )}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <span className="w-12 text-right font-mono text-[10px] text-ink-muted">
                            {progress}/{quest.target}
                          </span>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            {(questsQuery.data?.quests ?? []).length === 0 ? (
              <p className="mt-4 text-sm text-ink-muted">
                Today's quests arrive when you add your first kanji.
              </p>
            ) : (
              <p
                className={cn(
                  'mt-3 flex items-center gap-1.5 text-xs',
                  questsQuery.data?.sweepAwarded ? 'text-matcha' : 'text-ink-muted'
                )}
              >
                {questsQuery.data?.sweepAwarded ? (
                  <>
                    <CheckCheck size={14} aria-hidden="true" />
                    Daily sweep complete — +{questsQuery.data.sweepReward} XP
                  </>
                ) : (
                  <>Complete all three for +{questsQuery.data?.sweepReward ?? 30} XP.</>
                )}
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
