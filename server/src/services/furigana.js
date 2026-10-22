import { createRequire } from 'node:module';
import path from 'node:path';
import Kuroshiro from 'kuroshiro';
import KuromojiAnalyzer from 'kuroshiro-analyzer-kuromoji';

/**
 * Render-time furigana (prompt.md §5.4): kuroshiro runs server-side, lazily
 * initialized (kuromoji dict ≈17 MB). Output is tokenized into
 * [{ text, reading? }] pairs instead of HTML so the client renders <ruby>
 * in JSX — no dangerouslySetInnerHTML anywhere (XSS-safe for Tatoeba text).
 * Results are cached in memory; markup is never stored (§5.4).
 */

const require = createRequire(import.meta.url);
const CACHE_MAX = 5000;

const cache = new Map();
let kuroshiroPromise = null;
let kuroshiroInstance = null;

function resolveDictPath() {
  const pkgPath = require.resolve('kuromoji/package.json');
  return path.join(path.dirname(pkgPath), 'dict');
}

async function getKuroshiro() {
  if (kuroshiroInstance) return kuroshiroInstance;
  if (!kuroshiroPromise) {
    kuroshiroPromise = (async () => {
      const kuroshiro = new Kuroshiro();
      await kuroshiro.init(new KuromojiAnalyzer({ dictPath: resolveDictPath() }));
      kuroshiroInstance = kuroshiro;
      return kuroshiro;
    })().catch((err) => {
      kuroshiroPromise = null; // allow retry on next request
      throw err;
    });
  }
  return kuroshiroPromise;
}

/**
 * Parse kuroshiro HTML output into safe tokens.
 * Input shape: "…<ruby>漢字<rt>かんじ</rt></ruby>…" interleaved with plain text.
 */
export function htmlToTokens(html) {
  const tokens = [];
  const re = /<ruby>(.*?)<rt>(.*?)<\/rt><\/ruby>|([^<]+)|(<[^>]+>)/gs;
  let match = re.exec(html);
  while (match !== null) {
    if (match[1] !== undefined) {
      tokens.push({ text: match[1], reading: match[2] });
    } else if (match[3] !== undefined) {
      const text = match[3];
      if (text.length > 0) tokens.push({ text });
    }
    match = re.exec(html);
  }
  return tokens;
}

/** @returns {Promise<Array<{text: string, reading?: string}>>} */
export async function furiganaTokens(sentence) {
  if (!sentence) return [];
  const cached = cache.get(sentence);
  if (cached) return cached;

  let tokens = [{ text: sentence }];
  try {
    const kuroshiro = await getKuroshiro();
    const html = await kuroshiro.parse(sentence, { output: 'html' });
    const parsed = htmlToTokens(String(html));
    if (parsed.length > 0) tokens = parsed;
  } catch {
    // Degrade to plain furigana-less text rather than failing the whole
    // detail request (e.g. dictionary not yet available).
    tokens = [{ text: sentence }];
  }

  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  cache.set(sentence, tokens);
  return tokens;
}

/** Warm the analyzer early (called once from app startup — non-blocking). */
export function warmFurigana() {
  getKuroshiro().catch(() => {});
}
