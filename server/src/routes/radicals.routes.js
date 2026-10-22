import { Router } from 'express';
import { Kanji } from '../models/Kanji.js';
import { Radical } from '../models/Radical.js';
import { ok } from '../utils/envelope.js';

export const radicalsRouter = Router();

/** Counts only change on reseed — cache the merged list briefly. */
let cache = { at: 0, items: null };
const CACHE_TTL_MS = 60_000;

/**
 * GET /radicals — §7.3 radical pills: every radical with its kanji count.
 * Counts are global (the full corpus), independent of active filters.
 */
radicalsRouter.get('/', async (req, res, next) => {
  try {
    if (cache.items && Date.now() - cache.at < CACHE_TTL_MS) {
      return ok(res, { radicals: cache.items });
    }

    const [radicals, counts] = await Promise.all([
      Radical.find().sort({ strokeCount: 1, character: 1 }).lean(),
      Kanji.aggregate([
        { $match: { radical: { $ne: null } } },
        { $group: { _id: '$radical', count: { $sum: 1 } } },
      ]).allowDiskUse(true),
    ]);

    const countByChar = new Map(counts.map((row) => [row._id, row.count]));
    const items = radicals.map((radical) => ({
      character: radical.character,
      meaning: radical.meaning,
      mnemonic: radical.mnemonic,
      strokeCount: radical.strokeCount,
      variants: radical.variants ?? [],
      count: countByChar.get(radical.character) ?? 0,
    }));

    cache = { at: Date.now(), items };
    return ok(res, { radicals: items });
  } catch (err) {
    return next(err);
  }
});
