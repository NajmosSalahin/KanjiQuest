import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import AdmZip from 'adm-zip';
import {
  radicalChar,
  buildRadicalIndex,
  componentsFromSvg,
  KANGXI_COUNT,
} from '../src/services/seed/kangxi.js';
import { loadKanjiSvgMap } from '../src/services/seed/kanjivg.js';
import { parseKanjidic2Xml } from '../src/services/seed/parse-kanjidic.js';
import { buildExampleWords } from '../src/services/seed/parse-jmdict.js';
import { buildSentenceIndex, findFileRecursive } from '../src/services/seed/parse-tatoeba.js';

/** Tiny fixtures for the §5.3 ingestion pipeline (no big files in CI). */

let workDir;

beforeAll(() => {
  workDir = mkdtempSync(path.join(tmpdir(), 'kg-seed-test-'));
});
afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe('kangxi numbering (§5.3 classical radicals)', () => {
  it('maps canonical Kangxi numbers to characters', () => {
    expect(radicalChar(1)).toBe('一');
    expect(radicalChar(8)).toBe('亠');
    expect(radicalChar(9)).toBe('人');
    expect(radicalChar(11)).toBe('入');
    expect(radicalChar(12)).toBe('八');
    expect(radicalChar(18)).toBe('刀');
    expect(radicalChar(72)).toBe('日'); // KANJIDIC classical-radical anchor
    expect(radicalChar(162)).toBe('辵');
    expect(radicalChar(169)).toBe('門');
    expect(radicalChar(203)).toBe('黑');
    expect(radicalChar(KANGXI_COUNT)).toBe('龠');
  });

  it('rejects out-of-range and non-integer numbers', () => {
    expect(radicalChar(0)).toBeNull();
    expect(radicalChar(215)).toBeNull();
    expect(radicalChar(3.5)).toBeNull();
  });

  it('indexes variant forms to their canonical radical', () => {
    const index = buildRadicalIndex([
      { character: '水', variants: ['氵', '氺'] },
      { character: '心', variants: ['忄'] },
    ]);
    expect(index.get('氵')).toBe('水');
    expect(index.get('氺')).toBe('水');
    expect(index.get('忄')).toBe('心');
    expect(index.get('水')).toBe('水');
    expect(index.get('龍')).toBeUndefined();
  });

  it('extracts de-duplicated components from a KanjiVG svg', () => {
    const svg = [
      '<svg>',
      '<g id="kvg:StrokePaths_6c34" kvg:element="水">',
      '<path id="kvg:6c34-s1" d="M10,10"/>',
      '</g>',
      '<g id="kvg:ComponentPaths_6c34" kvg:element="水">',
      '<g kvg:element="氺"/>',
      '</g>',
      '</svg>',
    ].join('\n');
    expect(componentsFromSvg(svg)).toEqual(['水', '氺']);
  });
});

describe('KanjiVG svg map (§5.3 item 2)', () => {
  it('keys SVGs by canonical hex so KANJIDIC-style lookups match', () => {
    const zipPath = path.join(workDir, 'kanjivg-fixture.zip');
    const zip = new AdmZip();
    zip.addFile('065e5.svg', Buffer.from('<svg id="65e5"/>')); // padded BMP filename
    zip.addFile('kvg/03400.svg', Buffer.from('<svg id="3400"/>')); // dir prefix + padding
    zip.addFile('200a4.svg', Buffer.from('<svg id="200a4"/>')); // natural 5 digits
    zip.addFile('abcd.svg', Buffer.from('<svg id="abcd"/>')); // already canonical
    zip.addFile('readme.txt', Buffer.from('not an svg')); // wrong extension
    zip.addFile('12345.svg.bak', Buffer.from('not an exact .svg')); // suffix decoy
    zip.writeZip(zipPath);

    const map = loadKanjiSvgMap(zipPath);
    expect(map.size).toBe(4);
    // KANJIDIC hex keys are lowercase and unpadded — the padded filename form
    // must never survive as a key (that bug dropped every BMP stroke order).
    expect(map.has('065e5')).toBe(false);
    expect(map.get('65e5')).toBe('<svg id="65e5"/>');
    expect(map.get('3400')).toBe('<svg id="3400"/>');
    expect(map.get('200a4')).toBe('<svg id="200a4"/>');
    expect(map.get('abcd')).toBe('<svg id="abcd"/>');
    expect(map.has('12345')).toBe(false);
  });
});

describe('KANJIDIC2 parser (§5.3)', () => {
  const XML = `<?xml version="1.0" encoding="UTF-8"?>
<kanjidic2>
  <character>
    <literal>日</literal>
    <codepoint>
      <cp_value cp_type="ucs">65E5</cp_value>
      <cp_value cp_type="jis208">01-01-01</cp_value>
    </codepoint>
    <radical>
      <rad_value rad_type="classical">72</rad_value>
    </radical>
    <misc>
      <grade>1</grade>
      <stroke_count>4</stroke_count>
      <freq>13</freq>
      <jlpt>4</jlpt>
    </misc>
    <reading_meaning>
      <rmgroup>
        <reading r_type="ja_on">ニチ</reading>
        <reading r_type="ja_on">ジツ</reading>
        <reading r_type="ja_kun">ひ</reading>
        <meaning>day</meaning>
        <meaning>sun</meaning>
        <meaning lang="fr">jour</meaning>
      </rmgroup>
      <nanori>ひ</nanori>
    </reading_meaning>
  </character>
</kanjidic2>`;

  it('parses fields keyed by lowercase UCS hex, English meanings only', () => {
    const map = parseKanjidic2Xml(XML);
    expect(map.size).toBe(1);
    expect(map.get('65e5')).toEqual({
      character: '日',
      unicode: '65e5',
      meanings: ['day', 'sun'], // lang="fr" gloss skipped
      readingsOn: ['ニチ', 'ジツ'],
      readingsKun: ['ひ'],
      nameReadings: ['ひ'],
      grade: 1,
      strokeCount: 4,
      frequencyRank: 13,
      jlptLevel: 4,
      radicalNumber: 72,
    });
  });
});

describe('jmdict example words (§5.3 item 5)', () => {
  const words = [
    {
      kanji: [{ text: '日本', common: true }],
      kana: [{ text: 'にほん', common: true }],
      sense: [{ gloss: [{ lang: 'eng', gender: null, type: null, text: 'Japan' }] }],
    },
    {
      kanji: [{ text: '日本人', common: false }],
      kana: [{ text: 'にほんじん', common: false }],
      sense: [{ gloss: [{ lang: 'eng', gender: null, type: null, text: 'Japanese person' }] }],
    },
    {
      kanji: [{ text: '絵', common: false }],
      kana: [{ text: 'え', common: false }],
      // Non-English gloss first — the English one must win.
      sense: [
        {
          gloss: [
            { lang: 'fra', gender: null, type: null, text: 'image' },
            { lang: 'eng', gender: null, type: null, text: 'picture' },
          ],
        },
      ],
    },
    {
      // kana-only entry — never a candidate for a kanji
      kana: [{ text: 'かな', common: false }],
      sense: [{ gloss: [{ lang: 'eng', gender: null, type: null, text: 'kana' }] }],
    },
  ];

  it('prefers common, shorter words and caps per kanji', () => {
    const kanjiSet = new Set(['日', '本', '人', '絵']);
    const index = buildExampleWords(words, kanjiSet);

    expect(index.get('日').map((w) => w.word)).toEqual(['日本', '日本人']);
    expect(index.get('日')[0]).toEqual({
      word: '日本',
      reading: 'にほん',
      meaning: 'Japan',
      jlptLevel: null,
      common: true,
    });
    expect(index.get('絵')).toHaveLength(1);
    expect(index.get('絵')[0].meaning).toBe('picture'); // eng gloss wins over fra
  });
});

describe('Tatoeba sentence index (§5.3 item 6)', () => {
  let sentencesPath;
  let linksPath;

  beforeAll(async () => {
    sentencesPath = path.join(workDir, 'sentences.csv');
    linksPath = path.join(workDir, 'links.csv');
    const sentences = [
      '1\tjpn\t今日は晴れです。',
      '2\teng\tToday is sunny.',
      '3\tjpn\t私は学生です。',
      '4\teng\tI am a student.',
      '5\tjpn\tこれは非常に長すぎる日本語の文であって絶対に二十文字を超えていないはずはないという気がします。',
      '6\teng\tA very long sentence.',
      '7\tjpn\t明日行く。',
    ].join('\n');
    const links = ['1\t2', '3\t4', '5\t6'].join('\n'); // 7 has no translation
    writeFileSync(sentencesPath, sentences, 'utf8');
    writeFileSync(linksPath, links, 'utf8');
  });

  it('indexes only linked sentences, preferring ≤20 characters', async () => {
    const index = await buildSentenceIndex(sentencesPath, linksPath, () => {});

    expect(index.get('日')).toMatchObject({
      japanese: '今日は晴れです。',
      english: 'Today is sunny.',
      long: false,
    });
    expect(index.get('絶')).toMatchObject({
      long: true,
      english: 'A very long sentence.',
    });
    // Sentence 7 has no English link — its characters never enter the index.
    expect(index.has('行')).toBe(false);
  });

  it('finds files recursively in extracted archives', async () => {
    const nested = path.join(workDir, 'extracted', 'deep');
    mkdirSync(nested, { recursive: true });
    writeFileSync(path.join(nested, 'sentences.csv'), 'x', 'utf8');
    const found = await findFileRecursive(path.join(workDir, 'extracted'), 'sentences.csv');
    expect(found).toBe(path.join(nested, 'sentences.csv'));
  });
});
