import AdmZip from 'adm-zip';

/**
 * KanjiVG (§5.3 item 2): codepoint hex -> raw SVG text, from the zip's exact
 * `<hex>.svg` files (stroke components are derived separately, from the same
 * entries — see kangxi.js). KANJIDIC hex keys are lowercase with no leading
 * zeros (`65e5`), while KanjiVG filenames are zero-padded to five digits
 * (`065e5.svg`) — keys are canonicalized (`parseInt(hex, 16).toString(16)`)
 * so lookups match on both sides (a bare filename capture matched only
 * naturally five-digit codes, silently dropping every BMP stroke order).
 */
export function loadKanjiSvgMap(zipPath) {
  const zip = new AdmZip(zipPath);
  const map = new Map();
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const match = /(?:^|\/)([0-9a-f]{4,6})\.svg$/.exec(entry.entryName);
    if (!match) continue;
    map.set(Number.parseInt(match[1], 16).toString(16), entry.getData().toString('utf8'));
  }
  return map;
}
