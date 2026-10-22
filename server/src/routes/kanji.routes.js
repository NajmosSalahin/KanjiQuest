import { Router } from 'express';
import { z } from 'zod';
import { Kanji } from '../models/Kanji.js';
import { Radical } from '../models/Radical.js';
import { extractStrokes } from '../services/strokes.js';
import { furiganaTokens } from '../services/furigana.js';
import { ok, fail } from '../utils/envelope.js';

export const kanjiRouter = Router();

/** Fields the browser needs (§7.3) — never ship strokeOrderSvg on lists. */
const LIST_FIELDS =
  'character unicode meanings jlptLevel grade strokeCount radical frequencyRank hasStrokeOrder isJoyo isJinmeiyo';
/** $project spec for the list aggregate (drops _id and helper sort fields). */
const LIST_PROJECT = { _id: 0 };
for (const field of LIST_FIELDS.split(' ')) LIST_PROJECT[field] = 1;

const listQuerySchema = z.object({
  jlpt: z.coerce.number().int().min(1).max(5).optional(),
  strokeCount: z.coerce.number().int().min(1).max(60).optional(),
  radical: z.string().max(4).optional(),
  joyo: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .transform((v) => v === true || v === 'true')
    .optional(),
  jinmeiyo: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .transform((v) => v === true || v === 'true')
    .optional(),
  q: z.string().trim().max(50).optional(),
  sort: z.enum(['frequency', 'strokes', 'jlpt']).default('frequency'),
  // §7.3 Status control. userProgress lands in Phase 3 — until then only
  // 'all' can return rows (everyone is 'new'), which the UI shows as an
  // empty list for learning/mastered. See DECISIONS.md.
  status: z.enum(['all', 'learning', 'mastered']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(50),
});

const CJK = /[㐀-鿿豈-﫿]/u;
const KANA = /[぀-ゟ゠-ヿ]/;
const LATIN = /[a-zA-Z]/;

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Build the shared filter from validated query params (§9 GET /kanji). */
export function buildFilter(query) {
  const filter = {};
  if (query.jlpt !== undefined) filter.jlptLevel = query.jlpt;
  if (query.strokeCount !== undefined) filter.strokeCount = query.strokeCount;
  if (query.radical !== undefined) filter.radical = query.radical;
  if (query.joyo !== undefined) filter.isJoyo = query.joyo;
  if (query.jinmeiyo !== undefined) filter.isJinmeiyo = query.jinmeiyo;

  const q = query.q;
  if (q && q.length > 0) {
    const clauses = [];
    if (LATIN.test(q)) clauses.push({ $text: { $search: q } });
    if (KANA.test(q)) {
      const prefix = { $regex: `^${escapeRegex(q)}`, $options: 'i' };
      clauses.push({ readingsOn: prefix }, { readingsKun: prefix });
    }
    const cjkChars = [...q].filter((ch) => CJK.test(ch));
    if (cjkChars.length > 0) {
      clauses.push({ character: { $in: cjkChars } });
    }
    if (clauses.length === 0) {
      clauses.push({ meanings: { $regex: escapeRegex(q), $options: 'i' } });
    }
    filter.$or = clauses;
  }
  return filter;
}

/**
 * Sort as an aggregation-pipeline stage list (nulls-last via $addFields
 * sentinels — a plain sort() would float unknown frequency/jlpt to the top,
 * and mongoose .sort() cannot take a pipeline).
 */
function buildSort(sort) {
  if (sort === 'strokes') return [{ $sort: { strokeCount: 1, character: 1 } }];
  const freq = { _freq: { $ifNull: ['$frequencyRank', Number.MAX_SAFE_INTEGER] } };
  if (sort === 'jlpt') {
    return [
      { $addFields: { ...freq, _jlpt: { $ifNull: ['$jlptLevel', 0] } } },
      { $sort: { _jlpt: -1, _freq: 1, character: 1 } },
    ];
  }
  return [{ $addFields: freq }, { $sort: { _freq: 1, character: 1 } }];
}

kanjiRouter.get('/', async (req, res, next) => {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const fields = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (!fields[key]) fields[key] = [];
        fields[key].push(issue.message);
      }
      return fail(res, 400, 'VALIDATION_ERROR', 'Check the highlighted fields.', fields);
    }
    const query = parsed.data;

    // Status filter needs userProgress (Phase 3). No kanji has progress yet.
    if (query.status !== 'all') {
      return ok(res, { items: [], total: 0, page: query.page, limit: query.limit, hasMore: false });
    }

    const filter = buildFilter(query);
    const skip = (query.page - 1) * query.limit;

    const [items, total] = await Promise.all([
      Kanji.aggregate([
        { $match: filter },
        ...buildSort(query.sort),
        { $skip: skip },
        { $limit: query.limit },
        { $project: LIST_PROJECT },
      ]),
      Kanji.countDocuments(filter),
    ]);

    return ok(res, {
      items,
      total,
      page: query.page,
      limit: query.limit,
      hasMore: skip + items.length < total,
    });
  } catch (err) {
    return next(err);
  }
});

kanjiRouter.get('/:character', async (req, res, next) => {
  try {
    const character = req.params.character;
    if ([...character].length !== 1) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Provide a single kanji character.');
    }

    const kanji = await Kanji.findOne({ character }).lean();
    if (!kanji) {
      return fail(res, 404, 'KANJI_NOT_FOUND', 'That kanji was not found.');
    }

    const strokes = extractStrokes(kanji.strokeOrderSvg);

    // Radical cards: every KanjiVG component that resolves to a radical,
    // plus the KANJIDIC2 classical radical, de-duplicated.
    const radicalChars = [...new Set([...(kanji.radicals ?? []), kanji.radical].filter(Boolean))];
    const radicalDocs = radicalChars.length
      ? await Radical.find({ character: { $in: radicalChars } }).lean()
      : [];

    // Related: 6 sharing a radical or component (§7.4), frequent first.
    const seeds = [
      ...new Set(
        [kanji.radical, ...(kanji.radicals ?? []), ...(kanji.components ?? [])].filter(Boolean)
      ),
    ];
    const related = seeds.length
      ? await Kanji.aggregate([
          {
            $match: {
              character: { $ne: kanji.character },
              $or: [{ radical: { $in: seeds } }, { radicals: { $in: seeds } }],
            },
          },
          { $addFields: { _freq: { $ifNull: ['$frequencyRank', Number.MAX_SAFE_INTEGER] } } },
          { $sort: { _freq: 1, character: 1 } },
          { $limit: 6 },
          {
            $project: {
              _id: 0,
              character: 1,
              meanings: 1,
              strokeCount: 1,
              hasStrokeOrder: 1,
              frequencyRank: 1,
            },
          },
        ])
      : [];

    // Components card (§7.4): components beyond the radical list (including
    // variant forms), with meanings/mnemonics resolved where they exist.
    const radicalCovered = new Set();
    for (const doc of radicalDocs) {
      radicalCovered.add(doc.character);
      for (const variant of doc.variants ?? []) radicalCovered.add(variant);
    }
    const extraComponents = [
      ...new Set(
        (kanji.components ?? []).filter((c) => c !== kanji.character && !radicalCovered.has(c))
      ),
    ];
    const componentDocs = extraComponents.length
      ? await Kanji.find({ character: { $in: extraComponents } })
          .select('character meanings mnemonic')
          .lean()
      : [];

    // Render-time furigana tokens per sentence (§5.4 — never stored).
    const exampleSentences = await Promise.all(
      (kanji.exampleSentences ?? []).map(async (sentence) => ({
        ...sentence,
        tokens: await furiganaTokens(sentence.japanese),
      }))
    );

    const { strokeOrderSvg: _omit, ...kanjiPublic } = kanji;

    return ok(res, {
      kanji: { ...kanjiPublic, exampleSentences },
      strokes,
      radicals: radicalDocs,
      components: componentDocs,
      related,
    });
  } catch (err) {
    return next(err);
  }
});
