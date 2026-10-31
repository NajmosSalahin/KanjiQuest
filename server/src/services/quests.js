/**
 * Daily quests — prompt.md §6.7.
 *
 * Definitions are seeded into the `quests` collection. Three are selected
 * deterministically per user + local day, and progress is persisted in
 * `userQuests`. Phase 5 enables the review-completable definitions; the four
 * quiz definitions are seeded now and become selectable when Phase 6 starts
 * emitting quiz events (D12).
 */
import {
  DEFAULT_DAILY_GOAL_XP,
  LEVEL_TITLES,
  QUIZ_XP,
  XP_BOOST_MULTIPLIER,
} from '@kanjigarden/shared';
import { ensureGamificationProfile } from '../models/GamificationProfile.js';
import { QuestDef } from '../models/QuestDef.js';
import { UserQuest } from '../models/UserQuest.js';
import { evaluateAchievements } from './achievements.js';
import { localDay, localHour } from './time.js';
import { computeLevel } from './xp.js';

export const QUEST_DEFS = Object.freeze([
  {
    id: 'review-10',
    title: 'Review 10 cards',
    description: 'Complete 10 review cards today.',
    phase: 5,
    type: 'review',
    target: 10,
    xpReward: 25,
    coinReward: 5,
    order: 1,
  },
  {
    id: 'review-20',
    title: 'Review 20 cards',
    description: 'Complete 20 review cards today.',
    phase: 5,
    type: 'review',
    target: 20,
    xpReward: 40,
    coinReward: 8,
    order: 2,
  },
  {
    id: 'correct-5',
    title: 'Five in a row',
    description: 'Get 5 answers correct in a row.',
    phase: 5,
    type: 'review',
    target: 5,
    xpReward: 30,
    coinReward: 6,
    order: 3,
  },
  {
    id: 'quiz-session',
    title: 'A quiz session',
    description: 'Complete 1 quiz session.',
    phase: 6,
    type: 'quiz',
    target: 1,
    xpReward: 30,
    coinReward: 8,
    order: 4,
  },
  {
    id: 'quiz-perfect',
    title: 'Perfect quiz',
    description: 'Get a 100% accuracy quiz session.',
    phase: 6,
    type: 'quiz',
    target: 1,
    xpReward: 50,
    coinReward: 15,
    order: 5,
  },
  {
    id: 'earn-100xp',
    title: 'Earn 100 XP',
    description: 'Earn 100 XP today.',
    phase: 5,
    type: 'review',
    target: 100,
    xpReward: 35,
    coinReward: 7,
    order: 6,
  },
  {
    id: 'learn-3',
    title: 'Learn 3 new kanji',
    description: 'Review 3 kanji for the first time today.',
    phase: 5,
    type: 'review',
    target: 3,
    xpReward: 30,
    coinReward: 8,
    order: 7,
  },
  {
    id: 'clear-due',
    title: 'Clear the queue',
    description: 'Clear all due reviews.',
    phase: 5,
    type: 'review',
    target: 1,
    xpReward: 35,
    coinReward: 10,
    order: 8,
  },
  {
    id: 'drawing-quiz',
    title: 'Drawing practice',
    description: 'Complete a drawing-canvas quiz.',
    phase: 6,
    type: 'quiz',
    target: 1,
    xpReward: 40,
    coinReward: 10,
    order: 9,
  },
  {
    id: 'stroke-quiz',
    title: 'Stroke practice',
    description: 'Complete a stroke-order quiz.',
    phase: 6,
    type: 'quiz',
    target: 1,
    xpReward: 40,
    coinReward: 10,
    order: 10,
  },
  {
    id: 'before-10',
    title: 'Early bird',
    description: 'Review before 10am.',
    phase: 5,
    type: 'review',
    target: 1,
    xpReward: 20,
    coinReward: 5,
    order: 11,
  },
  {
    id: 'after-20',
    title: 'Night owl',
    description: 'Review after 8pm.',
    phase: 5,
    type: 'review',
    target: 1,
    xpReward: 20,
    coinReward: 5,
    order: 12,
  },
]);

/** Phase 5 selection pool. Phase 6 changes this to include quiz quests. */
export const CURRENT_QUEST_PHASE = 5;

export async function seedQuestDefs() {
  const ops = QUEST_DEFS.map((def) => ({
    updateOne: {
      filter: { id: def.id },
      update: { $set: { ...def, active: true } },
      upsert: true,
    },
  }));
  await QuestDef.bulkWrite(ops, { ordered: false });
}

export async function ensureQuestDefs() {
  const defs = await QuestDef.find().select('id active').lean();
  const ids = new Set(defs.filter((d) => d.active).map((d) => d.id));
  if (QUEST_DEFS.some((d) => !ids.has(d.id))) await seedQuestDefs();
}

export async function loadQuestDefs() {
  let rows = await QuestDef.find({ active: true }).sort({ order: 1 }).lean();
  if (!rows.length) {
    await seedQuestDefs();
    rows = await QuestDef.find({ active: true }).sort({ order: 1 }).lean();
  }
  if (rows.length) return rows;
  return QUEST_DEFS.map((d) => ({ ...d, active: true }));
}

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic 3-of-N selection per user + local day. */
export function selectDailyQuestIds(userId, date, defs = QUEST_DEFS) {
  const ids = defs
    .filter(
      (def) => def.active !== false && (def.phase ?? CURRENT_QUEST_PHASE) <= CURRENT_QUEST_PHASE
    )
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((def) => def.id);
  if (ids.length < 3) throw new Error('At least three quest definitions are required.');
  const seed = [...`${String(userId)}:${date}`].reduce(
    (acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0,
    0
  );
  const shuffled = [...ids];
  const rnd = mulberry32(seed);
  for (let i = 0; i < shuffled.length; i++) {
    const j = i + Math.floor(rnd() * (shuffled.length - i));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, 3);
}

function questSnapshot(doc) {
  const source = doc.toObject ? doc.toObject() : doc;
  return {
    userId: source.userId,
    date: source.date,
    questId: source.questId,
    title: source.title,
    description: source.description ?? '',
    target: source.target ?? 1,
    xpReward: source.xpReward ?? source.rewardXP ?? 0,
    coinReward: source.coinReward ?? source.rewardCoins ?? 0,
    order: source.order ?? 1,
    progress: 0,
    completed: false,
    completedAt: null,
    rewardClaimed: false,
    xpAwarded: 0,
    coinsAwarded: 0,
    sweepAwarded: false,
  };
}

export async function ensureDayQuests(userId, tz = 'UTC', now = new Date()) {
  await ensureQuestDefs();
  const date = localDay(now, tz);
  let rows = await UserQuest.find({ userId, date }).sort({ order: 1 }).lean();
  if (rows.length >= 3) return rows.slice(0, 3);

  const defs = await loadQuestDefs();
  const byId = new Map(defs.map((def) => [def.id, def]));
  const existing = new Set(rows.map((row) => row.questId));
  const ids = selectDailyQuestIds(userId, date, defs)
    .filter((id) => !existing.has(id))
    .slice(0, 3 - rows.length);

  for (const id of ids) {
    const def = byId.get(id);
    if (!def) continue;
    await UserQuest.updateOne(
      { userId, date, questId: id },
      { $setOnInsert: questSnapshot({ ...def, userId, date, questId: id }) },
      { upsert: true }
    );
  }
  rows = await UserQuest.find({ userId, date }).sort({ order: 1 }).lean();
  return rows.slice(0, 3);
}

export function publicQuest(row) {
  return {
    id: row.questId,
    date: row.date,
    title: row.title,
    description: row.description,
    progress: row.progress,
    target: row.target,
    completed: row.completed,
    completedAt: row.completedAt,
    xpReward: row.xpReward ?? row.rewardXP ?? 0,
    coinReward: row.coinReward ?? row.rewardCoins ?? 0,
    xpAwarded: row.xpAwarded ?? 0,
    coinsAwarded: row.coinsAwarded ?? 0,
  };
}

function questEffect(questId, event, hour) {
  if (event.type === 'review') {
    switch (questId) {
      case 'review-10':
      case 'review-20':
        return { inc: 1 };
      case 'correct-5':
        return event.rating >= 2 ? { inc: 1 } : { reset: true };
      case 'learn-3':
        return event.wasNew ? { inc: 1 } : null;
      case 'earn-100xp':
        return Number.isFinite(event.dailyXPProgress)
          ? { max: Math.min(100, Math.max(0, event.dailyXPProgress)) }
          : null;
      case 'clear-due':
        return event.dueCleared ? { inc: 1 } : null;
      case 'before-10':
        return hour < 10 ? { inc: 1 } : null;
      case 'after-20':
        return hour >= 20 ? { inc: 1 } : null;
      default:
        return null;
    }
  }
  if (event.type === 'quiz') {
    switch (questId) {
      case 'quiz-session':
        return event.quizCompleted ? { inc: 1 } : null;
      case 'quiz-perfect':
        return event.quizCompleted && event.quizPerfect ? { inc: 1 } : null;
      case 'drawing-quiz':
        return event.quizCompleted && event.quizMode === 'drawing' ? { inc: 1 } : null;
      case 'stroke-quiz':
        return event.quizCompleted && event.quizMode === 'stroke' ? { inc: 1 } : null;
      default:
        return null;
    }
  }
  return null;
}

async function applyQuestEffect(row, effect, now) {
  if (!effect) return null;
  if (effect.reset) {
    await UserQuest.updateOne(
      { _id: row._id, completed: false, progress: { $gt: 0 } },
      { $set: { progress: 0 } }
    );
    return null;
  }

  const update =
    effect.max !== undefined
      ? { $max: { progress: Math.min(row.target, effect.max) } }
      : { $inc: { progress: effect.inc } };

  const updated = await UserQuest.findOneAndUpdate({ _id: row._id, completed: false }, update, {
    new: true,
  });
  if (!updated || updated.progress < updated.target) return null;

  return UserQuest.findOneAndUpdate(
    { _id: row._id, completed: false, progress: { $gte: updated.target } },
    { $set: { progress: updated.target, completed: true, completedAt: now } },
    { new: true }
  );
}

function boosted(profile, amount, now) {
  return profile.xpBoostExpiresAt && profile.xpBoostExpiresAt > now
    ? Math.round(amount * XP_BOOST_MULTIPLIER)
    : amount;
}

async function settleRewards(user, date, claimableRows, sweepClaimed, now) {
  if (claimableRows.length === 0 && !sweepClaimed) {
    return { profile: null, questXP: 0, questCoins: 0, sweepXP: 0 };
  }
  const profile = await ensureGamificationProfile(
    user._id,
    user.preferences?.dailyGoalXP ?? DEFAULT_DAILY_GOAL_XP
  );
  const previousLevel = profile.currentLevel;
  let questXP = 0;
  let questCoins = 0;

  for (const row of claimableRows) {
    const xp = boosted(profile, row.xpReward ?? row.rewardXP ?? 0, now);
    const coins = row.coinReward ?? row.rewardCoins ?? 0;
    const claimed = await UserQuest.findOneAndUpdate(
      { _id: row._id, rewardClaimed: false, completed: true },
      { $set: { rewardClaimed: true, xpAwarded: xp, coinsAwarded: coins, rewardedAt: now } },
      { new: true }
    );
    if (!claimed) continue;
    questXP += xp;
    questCoins += coins;
  }

  let sweepXP = 0;
  if (sweepClaimed) {
    sweepXP = boosted(profile, QUIZ_XP.DAILY_SWEEP, now);
    await UserQuest.updateMany({ userId: user._id, date }, { $set: { sweepAwarded: true } });
  }

  if (questXP === 0 && questCoins === 0 && sweepXP === 0) {
    return { profile: null, questXP: 0, questCoins: 0, sweepXP: 0 };
  }

  profile.totalXP += questXP + sweepXP;
  profile.coins += questCoins;
  const provisional = computeLevel(profile.totalXP);
  profile.currentLevel = provisional.level;
  profile.xpToNextLevel = provisional.xpToNextLevel;

  const { newly, achievementXP } = await evaluateAchievements(profile, user, {
    now,
    ...(sweepClaimed ? { questSweep: 1 } : {}),
  });
  profile.totalXP += achievementXP;
  const finalLevel = computeLevel(profile.totalXP);
  profile.currentLevel = finalLevel.level;
  profile.xpToNextLevel = finalLevel.xpToNextLevel;
  await profile.save();

  const profileUpdate = {
    totalXP: profile.totalXP,
    level: finalLevel.level,
    xpToNextLevel: finalLevel.xpToNextLevel,
    title: LEVEL_TITLES[finalLevel.level - 1],
    coins: profile.coins,
    previousLevel,
    leveledUp: finalLevel.level > previousLevel,
    newlyUnlocked: newly,
  };

  return { profile: profileUpdate, questXP, questCoins, sweepXP };
}

/**
 * Apply one review/quiz/add event to today's quests, claim any completed
 * rewards + the daily sweep, and return the fresh quest rows.
 */
export async function trackQuestEvent(user, event = {}, now = new Date()) {
  const tz = user.timezone ?? 'UTC';
  const date = localDay(now, tz);
  const hour = localHour(now, tz);
  const rows = await ensureDayQuests(user._id, tz, now);
  const completedIds = [];

  for (const row of rows) {
    const completed = await applyQuestEffect(
      row,
      questEffect(row.questId, { ...event, hour }, hour),
      now
    );
    if (completed) completedIds.push(String(completed._id));
  }

  const allRows = await UserQuest.find({ userId: user._id, date }).sort({ order: 1 }).lean();
  const allDone = allRows.length === 3 && allRows.every((row) => row.completed);
  let sweepClaimed = false;
  if (allDone) {
    const target = allRows.find((row) => !row.sweepAwarded);
    if (target) {
      const claimed = await UserQuest.findOneAndUpdate(
        { _id: target._id, sweepAwarded: false },
        { $set: { sweepAwarded: true } },
        { new: true }
      );
      sweepClaimed = !!claimed;
    }
  }

  const claimableRows = await UserQuest.find({
    userId: user._id,
    date,
    completed: true,
    rewardClaimed: false,
  }).lean();

  const settled = await settleRewards(user, date, claimableRows, sweepClaimed, now);
  const finalRows = await UserQuest.find({ userId: user._id, date }).sort({ order: 1 }).lean();
  const byId = new Map(finalRows.map((row) => [String(row._id), row]));
  const completed = completedIds
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map(publicQuest);

  return {
    quests: finalRows.map(publicQuest),
    completed,
    beforeQuests: rows,
    sweep: sweepClaimed
      ? {
          awarded: settled.sweepXP,
          totalXP: settled.profile?.totalXP ?? null,
          level: settled.profile?.level ?? null,
          xpToNextLevel: settled.profile?.xpToNextLevel ?? null,
          title: settled.profile?.title ?? null,
          coins: settled.profile?.coins ?? null,
          leveledUp: settled.profile?.leveledUp ?? false,
          newlyUnlocked: settled.profile?.newlyUnlocked ?? [],
        }
      : null,
    profile: settled.profile,
    questXP: settled.questXP,
    questCoins: settled.questCoins,
  };
}

export async function getTodayQuests(userId, tz = 'UTC', now = new Date()) {
  const rows = await ensureDayQuests(userId, tz, now);
  const quests = rows.map(publicQuest);
  return {
    date: rows[0]?.date ?? localDay(now, tz),
    quests,
    allDone: quests.length === 3 && quests.every((q) => q.completed),
    sweepAwarded: rows.some((row) => row.sweepAwarded),
    sweepReward: QUIZ_XP.DAILY_SWEEP,
  };
}
