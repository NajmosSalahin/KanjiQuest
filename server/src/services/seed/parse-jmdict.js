/**
 * jmdict-simplified example-word matching (§5.3 item 5):
 * for each kanji, find 2–4 words containing it, preferring words where the
 * kanji is one of ≤2 characters and words marked common.
 */

const MAX_CANDIDATES_PER_KANJI = 60;

/**
 * @param {Array} words jmdict-simplified `words` array
 * @param {Set<string>} kanjiSet every target kanji character
 * @param {number} perKanji how many words to keep per kanji
 * @returns {Map<string, Array>} character -> [{ word, reading, meaning, jlptLevel, common }]
 */
export function buildExampleWords(words, kanjiSet, perKanji = 4) {
  const candidates = new Map();

  for (const entry of words) {
    const kanjiElement = (entry.kanji ?? [])[0];
    if (!kanjiElement?.text) continue; // kana-only entries can't target a kanji
    const word = kanjiElement.text;
    const common = kanjiElement.common === true;
    const kanaList = entry.kana ?? [];
    const reading = (kanaList.find((k) => k.common) ?? kanaList[0])?.text;
    // jmdict-simplified senses: gloss = [{ lang, gender, type, text }] — take
    // the first English gloss (the build is multilingual).
    const glossList = entry.sense?.[0]?.gloss ?? [];
    const gloss = glossList.find((g) => g?.lang === 'eng') ?? glossList[0];
    const meaning = typeof gloss === 'string' ? gloss : gloss?.text;
    if (!reading || meaning === undefined) continue;

    const wordLength = [...word].length;
    for (const ch of new Set([...word])) {
      if (!kanjiSet.has(ch)) continue;
      let list = candidates.get(ch);
      if (!list) {
        list = [];
        candidates.set(ch, list);
      }
      if (list.length < MAX_CANDIDATES_PER_KANJI) {
        list.push({ word, reading, meaning: String(meaning), common, wordLength });
      }
    }
  }

  const result = new Map();
  for (const [ch, list] of candidates) {
    list.sort((a, b) => Number(b.common) - Number(a.common) || a.wordLength - b.wordLength);
    const picked = [];
    const seen = new Set();
    for (const candidate of list) {
      if (seen.has(candidate.word)) continue;
      seen.add(candidate.word);
      picked.push({
        word: candidate.word,
        reading: candidate.reading,
        meaning: candidate.meaning,
        jlptLevel: null,
        common: candidate.common,
      });
      if (picked.length >= perKanji) break;
    }
    result.set(ch, picked);
  }
  return result;
}
