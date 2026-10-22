import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * kanjiapi.dev enrichment client (§5.2): JLPT levels + official-list
 * membership. Rate-limited to 10 req/s; every response cached in
 * .data/kanjiapi/ so reruns are instant (§5.9).
 */

const BASE = 'https://kanjiapi.dev/v1';
const MIN_INTERVAL_MS = 100; // 10 requests/second

export class KanjiApiClient {
  constructor(cacheDir, { log } = {}) {
    this.cacheDir = cacheDir;
    this.log = log ?? ((message) => process.stdout.write(`${message}\n`));
    this.nextSlot = 0;
    mkdirSync(cacheDir, { recursive: true });
  }

  cachePath(slug) {
    return path.join(this.cacheDir, `${slug}.json`);
  }

  async throttle() {
    const now = Date.now();
    const wait = Math.max(0, this.nextSlot - now);
    this.nextSlot = Math.max(now, this.nextSlot) + MIN_INTERVAL_MS;
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  }

  async fetchJson(slug, url) {
    const cacheFile = this.cachePath(slug);
    if (existsSync(cacheFile)) {
      return JSON.parse(readFileSync(cacheFile, 'utf8'));
    }
    await this.throttle();
    const res = await fetch(url, { headers: { 'User-Agent': 'kanjigarden-seed' } });
    if (!res.ok) throw new Error(`kanjiapi ${slug} failed (HTTP ${res.status})`);
    const json = await res.json();
    writeFileSync(cacheFile, JSON.stringify(json));
    return json;
  }

  /** All kanji characters known to kanjiapi. */
  async allCharacters() {
    const list = await this.fetchJson('all', `${BASE}/kanji/all`);
    return Array.isArray(list) ? list : [];
  }

  async joyoCharacters() {
    const list = await this.fetchJson('joyo', `${BASE}/kanji/joyo`);
    return new Set(Array.isArray(list) ? list : []);
  }

  async jinmeiyoCharacters() {
    const list = await this.fetchJson('jinmeiyo', `${BASE}/kanji/jinmeiyo`);
    return new Set(Array.isArray(list) ? list : []);
  }

  /** Per-character record; cached under its codepoint hex. */
  async character(unicodeHex, character) {
    const json = await this.fetchJson(
      `char-${unicodeHex}`,
      `${BASE}/kanji/${encodeURIComponent(character)}`
    );
    return json;
  }

  /** jlpt level (1..5) or null. */
  async jlptLevel(unicodeHex, character) {
    try {
      const record = await this.character(unicodeHex, character);
      const jlpt = record?.jlpt;
      return Number.isInteger(jlpt) && jlpt >= 1 && jlpt <= 5 ? jlpt : null;
    } catch (err) {
      this.log(`  kanjiapi jlpt ${character}: ${err.message} — continuing with null`);
      return null;
    }
  }
}
