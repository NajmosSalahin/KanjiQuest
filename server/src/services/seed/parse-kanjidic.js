import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { XMLParser } from 'fast-xml-parser';

/**
 * KANJIDIC2 parser (§5.2/§5.3): XML -> map keyed by Unicode hex codepoint.
 * English meanings only (entries carry lang="fr"/"es" etc. alongside).
 */

function asArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * First value of a possibly-repeated tag as a finite number, else null.
 * KANJIDIC2 repeats `<stroke_count>` when a kanji has variant stroke counts
 * (e.g. 逢 -> ["10","9","11"]; first value = the Jōyō standard). `Number()`
 * on the whole array is NaN, which poisoned 525 docs with NaN strokeCount
 * (JSON-null, sorted first by sort=strokes) — DECISIONS.md bug #3 addendum.
 */
function toNumber(value) {
  const first = asArray(value)[0];
  if (first === undefined || first === null || first === '') return null;
  const n = Number(first);
  return Number.isFinite(n) ? n : null;
}

export function parseKanjidic2Xml(xmlString) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseTagValue: false,
    trimValues: true,
  });
  const doc = parser.parse(xmlString);
  const characters = asArray(doc.kanjidic2?.character);
  const map = new Map();

  for (const entry of characters) {
    const character = entry.literal;
    if (!character) continue;

    const codepoint = asArray(entry.codepoint?.cp_value).find((cp) => cp['@_cp_type'] === 'ucs')?.[
      '#text'
    ];
    if (!codepoint) continue;

    const misc = entry.misc ?? {};
    const rmgroup = asArray(entry.reading_meaning?.rmgroup);

    const readingsOn = [];
    const readingsKun = [];
    const meanings = [];
    for (const group of rmgroup) {
      for (const reading of asArray(group.reading)) {
        if (reading['@_r_type'] === 'ja_on') readingsOn.push(reading['#text']);
        if (reading['@_r_type'] === 'ja_kun') readingsKun.push(reading['#text']);
      }
      for (const meaning of asArray(group.meaning)) {
        // fast-xml-parser returns a bare string for attribute-less text tags;
        // only entries with lang="fr"/"es"/… become objects. English has no
        // lang attribute — keep it, skip translated glosses.
        if (typeof meaning === 'string') {
          if (meaning.length > 0) meanings.push(meaning);
          continue;
        }
        if (meaning['@_lang'] === undefined && meaning['#text'] !== undefined) {
          meanings.push(meaning['#text']);
        }
      }
    }

    const classicalRadical = asArray(entry.radical?.rad_value).find(
      (r) => r['@_rad_type'] === 'classical'
    );

    map.set(String(codepoint).toLowerCase(), {
      character,
      unicode: String(codepoint).toLowerCase(),
      meanings,
      readingsOn,
      readingsKun,
      nameReadings: asArray(entry.reading_meaning?.nanori).map((n) =>
        typeof n === 'string' ? n : n['#text']
      ),
      grade: toNumber(misc.grade),
      strokeCount: toNumber(misc.stroke_count),
      frequencyRank: toNumber(misc.freq),
      jlptLevel: toNumber(misc.jlpt),
      radicalNumber: toNumber(classicalRadical?.['#text']),
    });
  }

  return map;
}

/** Read + gunzip kanjidic2.xml.gz from .data/. */
export function loadKanjidic2(gzPath) {
  if (!existsSync(gzPath)) {
    throw new Error(`KANJIDIC2 not found at ${gzPath} — run download-data first`);
  }
  const xml = gunzipSync(readFileSync(gzPath)).toString('utf8');
  return parseKanjidic2Xml(xml);
}
