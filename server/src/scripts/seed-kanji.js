#!/usr/bin/env node
/**
 * Phase 2 — seed all 13,108 kanji (prompt.md §5.3 merge strategy).
 * Requires: download-data first (all four sources) + seed-radicals before this
 * so radical lookups resolve. Reruns are idempotent (replaceOne upserts,
 * cached downloads + kanjiapi responses — §5.9).
 *
 * Usage: npm run seed-kanji -w server
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import AdmZip from 'adm-zip';
import { env } from '../config/env.js';
import { connectDB } from '../config/db.js';
import { Kanji } from '../models/Kanji.js';
import { Radical } from '../models/Radical.js';
import { KanjiApiClient } from '../services/kanjiapi.js';
import { loadKanjiSvgMap } from '../services/seed/kanjivg.js';
import { radicalChar, buildRadicalIndex, componentsFromSvg } from '../services/seed/kangxi.js';
import { loadKanjidic2 } from '../services/seed/parse-kanjidic.js';
import { buildExampleWords } from '../services/seed/parse-jmdict.js';
import { loadTatoeba, buildSentenceIndex } from '../services/seed/parse-tatoeba.js';

const SERVER_DIR = fileURLToPath(new URL('../../', import.meta.url));
const DATA_DIR = path.join(SERVER_DIR, '.data');
const BATCH = 500;

function log(message) {
  process.stdout.write(`${message}\n`);
}

/** jmdict-simplified zip -> parsed words array. */
function loadJmdictWords(zipPath) {
  const zip = new AdmZip(zipPath);
  const jsonEntry = zip.getEntries().find((e) => /\.json$/.test(e.entryName));
  if (!jsonEntry) throw new Error(`no .json entry inside ${zipPath}`);
  const parsed = JSON.parse(jsonEntry.getData().toString('utf8'));
  return parsed.words ?? [];
}

async function main() {
  if (!env.MONGODB_URI) {
    log('MONGODB_URI is not set — add it to .env');
    process.exit(1);
  }
  const started = Date.now();
  await connectDB(env.MONGODB_URI);

  // 0. Radical mnemonic index (variant forms -> canonical character).
  const mnemonics = JSON.parse(
    readFileSync(path.join(SERVER_DIR, 'data', 'radical-mnemonics.json'), 'utf8')
  );
  const mnemonicsByChar = new Map(mnemonics.map((entry) => [entry.character, entry]));
  const radicalIndex = buildRadicalIndex(mnemonics);
  const radicalDocs = await Radical.countDocuments();
  if (radicalDocs === 0) {
    log('warning: radicals collection is empty — run seed-radicals first');
  }

  // 1. KANJIDIC2 — the master list (§5.3 item 1).
  log('1/6 parsing KANJIDIC2…');
  const kanjidic = loadKanjidic2(path.join(DATA_DIR, 'kanjidic2.xml.gz'));
  log(`   ${kanjidic.size} characters`);

  // 2. KanjiVG SVGs + components (§5.3 item 2).
  log('2/6 loading KanjiVG SVGs…');
  const svgByHex = loadKanjiSvgMap(path.join(DATA_DIR, 'kanjivg.zip'));
  log(`   ${svgByHex.size} SVGs`);

  // 3. kanjiapi enrichment: joyo/jinmeiyo sets + per-character JLPT (§5.3 items 3–4).
  log('3/6 kanjiapi lists…');
  const kanjiapi = new KanjiApiClient(path.join(DATA_DIR, 'kanjiapi'), { log });
  const joyoSet = await kanjiapi.joyoCharacters();
  const jinmeiyoSet = await kanjiapi.jinmeiyoCharacters();
  log(`   joyo ${joyoSet.size}, jinmeiyo ${jinmeiyoSet.size}`);
  const jlptByHex = new Map();
  let fetched = 0;
  for (const [hex, entry] of kanjidic) {
    const jlpt = await kanjiapi.jlptLevel(hex, entry.character);
    jlptByHex.set(hex, jlpt);
    fetched++;
    if (fetched % 1000 === 0) {
      log(
        `   jlpt enrichment ${fetched}/${kanjidic.size} (~${Math.round((kanjidic.size - fetched) / 10 / 60)} min left)`
      );
    }
  }

  // 4. Example words (§5.3 item 5).
  log('4/6 matching JMdict example words…');
  const kanjiSet = new Set([...kanjidic.values()].map((entry) => entry.character));
  const jmdictWords = loadJmdictWords(path.join(DATA_DIR, 'jmdict-eng.zip'));
  log(`   ${jmdictWords.length} JMdict entries`);
  const wordsByChar = buildExampleWords(jmdictWords, kanjiSet);
  log(`   ${wordsByChar.size} kanji with example words`);

  // 5. Example sentences (§5.3 item 6).
  log('5/6 matching Tatoeba sentences…');
  const { sentencesCsv, linksCsv } = await loadTatoeba(DATA_DIR, log);
  const sentenceIndex = await buildSentenceIndex(sentencesCsv, linksCsv, log);

  // 6. Merge + upsert (§5.9: batches of 500, progress every 1,000).
  log('6/6 merging + upserting…');
  const coverage = {
    total: 0,
    withSvg: 0,
    withWords: 0,
    withSentences: 0,
    withJlpt: 0,
    joyo: 0,
    jinmeiyo: 0,
  };

  /** Build the replaceOne upsert op (+ coverage stats) for one KANJIDIC2 entry.
   *  Shared by the main pass and the verify/retry pass below.
   *  NOTE: ops go through the native driver (`Kanji.collection.bulkWrite`):
   *  mongoose `Model.bulkWrite` silently no-ops valid replaceOne upserts
   *  (observed during Atlas seeding — DECISIONS.md, found 2026-10-22). */
  const buildOp = (hex, entry) => {
    const svg = svgByHex.get(hex) ?? null;
    const components = svg ? componentsFromSvg(svg).filter((c) => c !== entry.character) : [];
    const radicals = [...new Set(components.map((c) => radicalIndex.get(c)).filter(Boolean))];
    const jlpt = jlptByHex.get(hex) ?? null;
    const words = wordsByChar.get(entry.character) ?? [];
    const sentence = sentenceIndex.get(entry.character) ?? null;
    const radicalCharacter = entry.radicalNumber ? radicalChar(entry.radicalNumber) : null;
    const radicalEntry = radicalCharacter ? mnemonicsByChar.get(radicalCharacter) : null;

    return {
      stats: { svg, words, sentence, jlpt },
      op: {
        replaceOne: {
          filter: { character: entry.character },
          replacement: {
            character: entry.character,
            unicode: hex,
            meanings: entry.meanings,
            readingsOn: entry.readingsOn,
            readingsKun: entry.readingsKun,
            nameReadings: entry.nameReadings,
            jlptLevel: jlpt,
            grade: entry.grade,
            strokeCount: entry.strokeCount ?? 0,
            radical: radicalCharacter,
            radicals,
            components,
            strokeOrderSvg: svg,
            hasStrokeOrder: svg !== null,
            frequencyRank: entry.frequencyRank,
            isJoyo: joyoSet.has(entry.character),
            isJinmeiyo: jinmeiyoSet.has(entry.character),
            isKyouiku: entry.grade !== null && entry.grade >= 1 && entry.grade <= 6,
            exampleWords: words,
            exampleSentences: sentence
              ? [{ japanese: sentence.japanese, english: sentence.english, audioUrl: null }]
              : [],
            mnemonic: radicalEntry?.mnemonic ?? null,
          },
          upsert: true,
        },
      },
    };
  };

  let batch = [];
  for (const [hex, entry] of kanjidic) {
    const { op, stats } = buildOp(hex, entry);
    batch.push(op);

    coverage.total++;
    if (stats.svg !== null) coverage.withSvg++;
    if (stats.words.length > 0) coverage.withWords++;
    if (stats.sentence) coverage.withSentences++;
    if (stats.jlpt !== null) coverage.withJlpt++;
    if (joyoSet.has(entry.character)) coverage.joyo++;
    if (jinmeiyoSet.has(entry.character)) coverage.jinmeiyo++;

    if (batch.length >= BATCH) {
      await Kanji.collection.bulkWrite(batch, { ordered: false });
      batch = [];
      if (coverage.total % 1000 === 0) log(`   upserted ${coverage.total}/${kanjidic.size}`);
    }
  }
  if (batch.length > 0) await Kanji.collection.bulkWrite(batch, { ordered: false });

  // Verify + retry: reconcile what the server actually stored before reporting
  // coverage, re-upserting anything that didn't land. Fails loudly rather than
  // printing a coverage report the DB can't back up.
  for (let round = 1; round <= 3; round++) {
    const stored = await Kanji.collection.find({}, { projection: { character: 1 } }).toArray();
    const storedChars = new Set(stored.map((doc) => doc.character));
    const missingOps = [];
    for (const [hex, entry] of kanjidic) {
      if (!storedChars.has(entry.character)) missingOps.push(buildOp(hex, entry).op);
    }
    if (missingOps.length === 0) break;
    if (round === 3) {
      throw new Error(
        `seed incomplete: ${missingOps.length} of ${kanjidic.size} docs failed to write`
      );
    }
    log(
      `   verify: ${missingOps.length} docs missing after upsert — re-upserting (round ${round})`
    );
    await Kanji.collection.bulkWrite(missingOps, { ordered: false });
  }

  // Indexes (§5.5) — after data load for speed.
  log('building indexes…');
  await Kanji.syncIndexes();

  const minutes = ((Date.now() - started) / 60000).toFixed(1);
  log('');
  log('coverage report (§5.7):');
  log(`  total kanji:              ${coverage.total}`);
  log(`  with stroke-order SVG:    ${coverage.withSvg}`);
  log(`  without SVG:              ${coverage.total - coverage.withSvg}`);
  log(`  with example words:       ${coverage.withWords}`);
  log(`  with example sentences:   ${coverage.withSentences}`);
  log(`  with JLPT level:          ${coverage.withJlpt}`);
  log(`  tagged Jōyō:              ${coverage.joyo}`);
  log(`  tagged Jinmeiyō:          ${coverage.jinmeiyo}`);
  log(`  done in ${minutes} min`);

  await mongoose.disconnect();
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  if (!existsSync(path.join(DATA_DIR, 'kanjidic2.xml.gz'))) {
    log('.data/kanjidic2.xml.gz missing — run download-data first');
    process.exit(1);
  }
  main().catch((err) => {
    process.stderr.write(`seed-kanji failed: ${err.stack ?? err.message}\n`);
    process.exit(1);
  });
}
