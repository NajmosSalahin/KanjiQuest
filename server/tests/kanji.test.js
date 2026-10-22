import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';

// Kuroshiro's dictionary init takes seconds — the routes test only cares that
// tokens are attached per sentence, so stub the service (htmlToTokens itself
// has its own unit test, and E2E exercises the real analyzer).
vi.mock('../src/services/furigana.js', () => ({
  furiganaTokens: async (sentence) => [{ text: sentence }],
  warmFurigana: () => {},
}));

import { createApp } from '../src/app.js';
import { Kanji } from '../src/models/Kanji.js';
import { Radical } from '../src/models/Radical.js';
import { startTestDb, stopTestDb, clearDb } from './helpers/db.js';

const app = createApp({ rateLimits: { general: 10_000, auth: 10_000 } });

let mongod;

/** Minimal KanjiVG-shaped SVG — exact filename group the seeder stores. */
const DAY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="109" height="109" viewBox="0 0 109 109">
<g id="kvg:StrokePaths_065e5" kvg:element="日">
<path id="kvg:065e5-s1" d="M19.5,29.5c9,7.5,22.5,27,26,39.5"/>
<path id="kvg:065e5-s2" d="M33.5,17c0,14,1,30,1,46.5"/>
<path id="kvg:065e5-s3" d="M20.5,45c13.5,3.5,30,7,47.5,5.5"/>
<path id="kvg:065e5-s4" d="M20.5,62c18,2.5,35.5,4,47.5,3"/>
<text class="number" x="13.5" y="24.5">1</text>
<text class="number" x="28.5" y="12.5">2</text>
<text class="number" x="15.5" y="41.5">3</text>
<text class="number" x="15.5" y="58.5">4</text>
</g>
<g id="kvg:ComponentPaths_065e5" kvg:element="日">
<path id="kvg:065e5-c1" d="M20,45c0,0,0,0"/>
</g>
</svg>`;

const KANJI = [
  {
    character: '日',
    unicode: '65e5',
    meanings: ['day', 'sun'],
    readingsOn: ['ニチ', 'ジツ'],
    readingsKun: ['ひ'],
    jlptLevel: 4,
    grade: 1,
    strokeCount: 4,
    radical: '日',
    radicals: ['日'],
    components: ['日'],
    strokeOrderSvg: DAY_SVG,
    hasStrokeOrder: true,
    frequencyRank: 13,
    isJoyo: true,
    isKyouiku: true,
    exampleWords: [
      { word: '日本', reading: 'にほん', meaning: 'Japan', jlptLevel: null, common: true },
    ],
    exampleSentences: [
      { japanese: '今日は晴れです。', english: 'It is sunny today.', audioUrl: null },
    ],
    mnemonic: 'The sun in a window — day after day.',
  },
  {
    character: '明',
    unicode: '660e',
    meanings: ['bright', 'clever'],
    readingsOn: ['メイ'],
    readingsKun: ['あか.るい'],
    jlptLevel: 4,
    grade: 2,
    strokeCount: 8,
    radical: '日',
    radicals: ['日', '月'],
    components: ['日', '月'],
    hasStrokeOrder: false,
    frequencyRank: 331,
    isJoyo: true,
    isKyouiku: true,
  },
  {
    character: '月',
    unicode: '6708',
    meanings: ['moon', 'month'],
    readingsOn: ['ゲツ'],
    readingsKun: ['つき'],
    jlptLevel: 4,
    grade: 1,
    strokeCount: 4,
    radical: '月',
    radicals: ['月'],
    components: ['月'],
    hasStrokeOrder: false,
    frequencyRank: 100,
    isJoyo: true,
    isKyouiku: true,
  },
  {
    character: '水',
    unicode: '6c34',
    meanings: ['water'],
    readingsOn: ['スイ'],
    readingsKun: ['みず'],
    jlptLevel: 5,
    strokeCount: 4,
    radical: '水',
    radicals: ['水'],
    components: ['水'],
    hasStrokeOrder: false,
    frequencyRank: 149,
    isJoyo: true,
    isKyouiku: true,
  },
  {
    character: '火',
    unicode: '706b',
    meanings: ['fire'],
    readingsOn: ['カ'],
    readingsKun: ['ひ'],
    jlptLevel: 5,
    strokeCount: 4,
    radical: '火',
    hasStrokeOrder: false,
    frequencyRank: 163,
    isJoyo: true,
    isKyouiku: true,
  },
  {
    character: '氷',
    unicode: '6c37',
    meanings: ['ice'],
    readingsOn: ['ヒょう'],
    readingsKun: ['こお.る'],
    jlptLevel: 3,
    strokeCount: 5,
    radical: '水',
    hasStrokeOrder: false,
    frequencyRank: null,
    isJoyo: true,
  },
  {
    character: '時',
    unicode: '6642',
    meanings: ['time', 'hour'],
    readingsOn: ['ジ'],
    readingsKun: ['とき'],
    jlptLevel: 3,
    strokeCount: 10,
    radical: '日',
    radicals: ['日'],
    components: ['日', '寺'],
    hasStrokeOrder: false,
    frequencyRank: 111,
    isJoyo: true,
  },
  {
    character: '寺',
    unicode: '5bfa',
    meanings: ['Buddhist temple'],
    readingsOn: ['ジ'],
    readingsKun: ['てら'],
    jlptLevel: null,
    strokeCount: 6,
    radical: '土',
    radicals: ['土'],
    components: ['土', '寸'],
    hasStrokeOrder: false,
    frequencyRank: null,
    isJoyo: true,
  },
  {
    character: '龍',
    unicode: '9f8d',
    meanings: ['dragon'],
    readingsOn: ['リョウ'],
    readingsKun: ['たつ'],
    jlptLevel: null,
    strokeCount: 16,
    radical: '龍',
    hasStrokeOrder: false,
    frequencyRank: null,
    isJoyo: false,
    isJinmeiyo: true,
  },
];

const RADICALS = [
  {
    character: '日',
    meaning: 'sun',
    mnemonic: 'The sun in a window — day after day.',
    strokeCount: 4,
    variants: [],
  },
  {
    character: '月',
    meaning: 'moon',
    mnemonic: 'The moon radical — a sliver of night, drawn in four strokes.',
    strokeCount: 4,
    variants: ['冃'],
  },
  {
    character: '水',
    meaning: 'water',
    mnemonic: 'Water flows in three drops.',
    strokeCount: 4,
    variants: ['氵', '氺'],
  },
  {
    character: '火',
    meaning: 'fire',
    mnemonic: 'Fire flickers in four sparks.',
    strokeCount: 4,
    variants: ['灬'],
  },
];

async function list(query = '') {
  const res = await request(app).get(`/api/v1/kanji${query}`);
  expect(res.status).toBe(200);
  return res.body.data;
}

const chars = (data) => data.items.map((item) => item.character);

beforeAll(async () => {
  mongod = await startTestDb();
  // $text search needs the meanings text index before the first query.
  await Kanji.syncIndexes();
  await Radical.syncIndexes();
});
afterAll(async () => {
  await stopTestDb(mongod);
});
beforeEach(async () => {
  await clearDb();
  await Kanji.insertMany(KANJI);
  await Radical.insertMany(RADICALS);
});

describe('GET /api/v1/kanji — §9 list', () => {
  it('paginates with total/hasMore', async () => {
    const page1 = await list('?page=1&limit=3');
    expect(page1.total).toBe(KANJI.length);
    expect(page1.items).toHaveLength(3);
    expect(page1.hasMore).toBe(true);

    const page3 = await list('?page=3&limit=3');
    expect(page3.items).toHaveLength(3);
    expect(page3.hasMore).toBe(false);

    const page4 = await list('?page=4&limit=3');
    expect(page4.items).toHaveLength(0);
    expect(page4.hasMore).toBe(false);
  });

  it('rejects out-of-range params with VALIDATION_ERROR fields', async () => {
    const res = await request(app).get('/api/v1/kanji?limit=51');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields.limit).toBeDefined();

    const badSort = await request(app).get('/api/v1/kanji?sort=nope');
    expect(badSort.status).toBe(400);
    expect(badSort.body.error.fields.sort).toBeDefined();

    const badPage = await request(app).get('/api/v1/kanji?page=0');
    expect(badPage.status).toBe(400);
    expect(badPage.body.error.fields.page).toBeDefined();
  });

  it('filters by jlpt, strokeCount, radical, joyo, jinmeiyo', async () => {
    expect(new Set(chars(await list('?jlpt=4')))).toEqual(new Set(['日', '月', '明']));
    expect(new Set(chars(await list('?strokeCount=4')))).toEqual(new Set(['日', '月', '水', '火']));
    expect(new Set(chars(await list('?radical=水')))).toEqual(new Set(['水', '氷']));
    const joyo = await list('?joyo=true');
    expect(joyo.total).toBe(KANJI.length - 1); // only 龍 is non-joyo
    expect(chars(await list('?jinmeiyo=true'))).toEqual(['龍']);
  });

  it('sorts by strokes ascending', async () => {
    const data = await list('?sort=strokes');
    expect(data.items.map((i) => i.strokeCount)).toEqual([4, 4, 4, 4, 5, 6, 8, 10, 16]);
  });

  it('sorts by frequency with unknown frequency last', async () => {
    const data = await list('?sort=frequency');
    expect(data.items[0].character).toBe('日'); // rank 13
    const nullFrom = data.items.findIndex((i) => i.frequencyRank == null);
    expect(nullFrom).toBeGreaterThan(0);
    expect(data.items.slice(nullFrom).every((i) => i.frequencyRank == null)).toBe(true);
    expect(data.items.slice(0, nullFrom).every((i) => i.frequencyRank != null)).toBe(true);
  });

  it('sorts by jlpt: N5 first, unknown last', async () => {
    const data = await list('?sort=jlpt');
    expect(data.items.map((i) => i.jlptLevel)).toEqual([5, 5, 4, 4, 4, 3, 3, null, null]);
  });

  it('searches meanings (text index), readings, and characters', async () => {
    expect(new Set(chars(await list('?q=sun')))).toEqual(new Set(['日']));
    expect(chars(await list('?q=ニチ'))).toEqual(['日']);
    // ひ is the kun-yomi of both 日 and 火 — OR semantics across readings.
    expect(new Set(chars(await list('?q=ひ')))).toEqual(new Set(['日', '火']));
    expect(chars(await list('?q=%E6%B0%B4'))).toEqual(['水']); // 水
  });

  it('returns an empty page for learning/mastered status (Phase 3 join)', async () => {
    const data = await list('?status=learning');
    expect(data).toMatchObject({ items: [], total: 0, hasMore: false });
  });

  it('never ships strokeOrderSvg, exampleWords, or helper sort fields', async () => {
    const data = await list('?sort=jlpt');
    for (const item of data.items) {
      expect(item).not.toHaveProperty('strokeOrderSvg');
      expect(item).not.toHaveProperty('exampleWords');
      expect(item).not.toHaveProperty('_freq');
      expect(item).not.toHaveProperty('_jlpt');
      expect(item).not.toHaveProperty('_id');
    }
  });
});

describe('GET /api/v1/kanji/:character — §9 detail', () => {
  const get = (character) => request(app).get(`/api/v1/kanji/${encodeURIComponent(character)}`);

  it('returns full doc, extracted strokes, radicals, related, sentence tokens', async () => {
    const res = await get('日');
    expect(res.status).toBe(200);
    const { kanji, strokes, radicals, components, related } = res.body.data;

    expect(kanji).toMatchObject({
      character: '日',
      meanings: ['day', 'sun'],
      strokeCount: 4,
      mnemonic: 'The sun in a window — day after day.',
    });
    expect(kanji).not.toHaveProperty('strokeOrderSvg');

    expect(strokes).toHaveLength(4);
    expect(strokes[0]).toMatchObject({ n: 1, x: '13.5', y: '24.5' });
    expect(strokes[0].d).toMatch(/^M19\.5/);

    expect(radicals.map((r) => r.character)).toEqual(['日']);
    expect(radicals[0].mnemonic).toContain('sun in a window');
    expect(components).toEqual([]);

    // Shares the 日 radical — sorted frequent-first, never self.
    expect(related.map((r) => r.character)).toEqual(['時', '明']);
    expect(related.some((r) => r.character === '日')).toBe(false);

    expect(kanji.exampleWords[0].word).toBe('日本');
    expect(kanji.exampleSentences[0].tokens).toEqual([{ text: '今日は晴れです。' }]);
    expect(kanji.exampleSentences[0].english).toBe('It is sunny today.');
  });

  it('resolves components beyond the radical list', async () => {
    const res = await get('時');
    expect(res.status).toBe(200);
    const { radicals, components } = res.body.data;
    expect(radicals.map((r) => r.character)).toEqual(['日']);
    expect(components.map((c) => c.character)).toEqual(['寺']);
    expect(components[0].meanings).toEqual(['Buddhist temple']);
  });

  it('404s an unknown character with KANJI_NOT_FOUND', async () => {
    const res = await get('鬱');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('KANJI_NOT_FOUND');
  });

  it('400s a multi-character path', async () => {
    const res = await get('日本');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('exposes hasStrokeOrder:false with no strokes (§7.4 empty state data)', async () => {
    const res = await get('龍');
    expect(res.status).toBe(200);
    expect(res.body.data.kanji.hasStrokeOrder).toBe(false);
    expect(res.body.data.strokes).toEqual([]);
    expect(res.body.data.kanji.exampleWords).toEqual([]);
    expect(res.body.data.kanji.exampleSentences).toEqual([]);
  });
});

describe('GET /api/v1/radicals — §7.3 pills', () => {
  it('lists radicals with counts, ordered by stroke count', async () => {
    const res = await request(app).get('/api/v1/radicals');
    expect(res.status).toBe(200);
    const items = res.body.data.radicals;
    expect(items.map((r) => r.character)).toEqual(['日', '月', '水', '火']);

    const byChar = Object.fromEntries(items.map((r) => [r.character, r.count]));
    expect(byChar).toEqual({ 日: 3, 月: 1, 水: 2, 火: 1 }); // 日/明/時, 水/氷
    expect(items[0].mnemonic).toContain('sun in a window');
    expect(items[0].variants).toEqual([]);
  });
});

describe('GET /api/v1/licenses — §5.8', () => {
  it('lists every source with license + link and the KanjiVG notice', async () => {
    const res = await request(app).get('/api/v1/licenses');
    expect(res.status).toBe(200);
    const { notice, sources } = res.body.data;

    expect(notice).toMatch(/KanjiVG/);
    expect(notice).toMatch(/CC BY-SA 3\.0/);
    expect(notice).toMatch(/Ulrich Apel/);

    expect(sources).toHaveLength(5);
    const names = sources.map((s) => s.name);
    expect(names).toEqual(
      expect.arrayContaining(['KANJIDIC2', 'KanjiVG', 'JMdict', 'Tatoeba', 'kanjiapi.dev'])
    );
    for (const source of sources) {
      expect(source.license).toBeTruthy();
      expect(source.url).toMatch(/^https:\/\//);
    }
  });
});
