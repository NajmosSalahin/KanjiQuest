/**
 * Canonical Kangxi radical numbering, derived from Unicode's KangXi block
 * (U+2F00..U+2FD5 = radicals 1..214 in canonical order). NFKC maps each
 * compatibility character to its base form (⼼ -> 心).
 * KANJIDIC2 references radicals by this classical numbering (§5.3).
 */

export const KANGXI_COUNT = 214;
const KANGXI_BLOCK_START = 0x2f00;

/** A few Kangxi-block decompositions land on rare variant codepoints;
 *  map them to their standard forms so joins use the canonical character. */
const VARIANT_TO_STANDARD = new Map([
  [0x9751, '青'], // ⻘ decomposition -> standard 青
  [0x79b8, '禾'], // ⽲ (drooping grain radical form) -> 禾
]);

/** radicalNumber (1..214) -> radical character. */
export function radicalChar(number) {
  if (!Number.isInteger(number) || number < 1 || number > KANGXI_COUNT) return null;
  const char = String.fromCodePoint(KANGXI_BLOCK_START + number - 1).normalize('NFKC');
  return VARIANT_TO_STANDARD.get(char.codePointAt(0)) ?? char;
}

/**
 * Build a lookup map: any known form (base or variant, e.g. ⺼/忄/亻) ->
 * the canonical radical character. Reads the mnemonics file's variants[].
 */
export function buildRadicalIndex(mnemonicEntries) {
  const index = new Map();
  for (const entry of mnemonicEntries) {
    index.set(entry.character, entry.character);
    for (const variant of entry.variants ?? []) {
      index.set(variant, entry.character);
    }
  }
  return index;
}

/** Extract kvg:element component characters from a KanjiVG SVG string. */
export function componentsFromSvg(svg) {
  const elements = [];
  const re = /kvg:element="([^"]+)"/g;
  let match = re.exec(svg);
  while (match !== null) {
    elements.push(match[1]);
    match = re.exec(svg);
  }
  // First occurrence group is the whole kanji (StrokePaths); components come
  // after. De-dup while preserving order.
  return [...new Set(elements)];
}
