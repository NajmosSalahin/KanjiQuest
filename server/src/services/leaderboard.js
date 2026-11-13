/**
 * Leaderboards — prompt.md §6.12/§7.9. Weekly XP resets Monday 00:00 UTC
 * (D18). Live aggregation keeps ranks accurate without a materialized cache
 * (D19); equal XP shares a competition rank, and display order breaks ties by
 * profile creation time then id.
 */
import { storeItem } from '@kanjigarden/shared';
import { GamificationProfile } from '../models/GamificationProfile.js';
import { User } from '../models/User.js';
import { weekStartUTC } from './weekly.js';

const TOP_LIMIT = 100;

function displayTitle(equippedTitle) {
  return equippedTitle ? (storeItem(equippedTitle)?.name ?? null) : null;
}

function toEntry(row, rank) {
  return {
    rank,
    userId: String(row.userId),
    displayName: row.displayName ?? 'Learner',
    avatarUrl: row.userAvatarUrl ?? null,
    title: displayTitle(row.equippedTitle),
    equippedTitle: row.equippedTitle ?? null,
    equippedFrame: row.equippedFrame ?? null,
    xp: row.xp,
  };
}

export async function getLeaderboard(currentUserId, period = 'weekly', now = new Date()) {
  const weekly = period !== 'allTime';
  const weekStart = weekStartUTC(now);
  const xpField = weekly ? 'weeklyXP' : 'totalXP';
  const baseMatch = weekly
    ? { weeklyXPWeek: weekStart, weeklyXP: { $gt: 0 } }
    : { totalXP: { $gt: 0 } };

  const rows = await GamificationProfile.aggregate([
    { $match: baseMatch },
    { $sort: { [xpField]: -1, createdAt: 1, _id: 1 } },
    { $limit: TOP_LIMIT },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: '$user' },
    {
      $project: {
        _id: 0,
        userId: 1,
        equippedTitle: 1,
        equippedFrame: 1,
        xp: `$${xpField}`,
        displayName: '$user.displayName',
        userAvatarUrl: '$user.avatarUrl',
      },
    },
  ]);

  const entries = [];
  let lastXP = null;
  let lastRank = 0;
  rows.forEach((row, index) => {
    const rank = row.xp === lastXP ? lastRank : index + 1;
    lastXP = row.xp;
    lastRank = rank;
    entries.push({ ...toEntry(row, rank), isYou: row.userId.equals(currentUserId) });
  });

  const own = entries.find((entry) => entry.isYou);
  let me = own ?? null;
  if (!me) {
    const [profile, user] = await Promise.all([
      GamificationProfile.findOne({ userId: currentUserId })
        .select('totalXP weeklyXP weeklyXPWeek equippedTitle equippedFrame')
        .lean(),
      User.findById(currentUserId).select('displayName avatarUrl').lean(),
    ]);
    const xp = weekly
      ? profile?.weeklyXPWeek === weekStart
        ? (profile?.weeklyXP ?? 0)
        : 0
      : (profile?.totalXP ?? 0);
    const higher =
      xp > 0
        ? await GamificationProfile.countDocuments({
            ...baseMatch,
            [xpField]: { $gt: xp },
          })
        : 0;
    me = {
      rank: xp > 0 ? higher + 1 : null,
      userId: String(currentUserId),
      displayName: user?.displayName ?? 'Learner',
      avatarUrl: user?.avatarUrl ?? null,
      title: displayTitle(profile?.equippedTitle),
      equippedTitle: profile?.equippedTitle ?? null,
      equippedFrame: profile?.equippedFrame ?? null,
      xp,
      isYou: true,
    };
  }

  return {
    period: weekly ? 'weekly' : 'allTime',
    weekStart: weekly ? weekStart : null,
    entries,
    me,
  };
}
