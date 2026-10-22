#!/usr/bin/env node
/**
 * Phase 2 — download the four seed sources into .data/ (gitignored).
 * prompt.md §5.2 (sources) + §5.9 (cache every download; skip existing).
 * Seed time only — never runtime.
 *
 * Usage: node src/scripts/download-data.js [--force]
 */
import { createWriteStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER_DIR = fileURLToPath(new URL('../../', import.meta.url));
export const DATA_DIR = path.join(SERVER_DIR, '.data');

const UA = 'kanjigarden-seed (data pipeline; contact: project owner)';

/** The pipeline runs as a CLI — plain stdout progress is intentional. */
const stdoutLog = (message) => process.stdout.write(`${message}\n`);

/** Fixed-URL sources (§5.2). */
export const DIRECT_SOURCES = [
  {
    key: 'KANJIDIC2',
    url: 'https://www.edrdg.org/kanjidic/kanjidic2.xml.gz',
    file: 'kanjidic2.xml.gz',
  },
  {
    key: 'Tatoeba sentences',
    url: 'https://downloads.tatoeba.org/exports/sentences.tar.bz2',
    file: 'sentences.tar.bz2',
  },
  {
    key: 'Tatoeba links',
    url: 'https://downloads.tatoeba.org/exports/links.tar.bz2',
    file: 'links.tar.bz2',
  },
];

/** GitHub "latest release" sources (§5.2). */
const RELEASE_SOURCES = [
  {
    key: 'KanjiVG',
    repo: 'KanjiVG/kanjivg',
    assetPattern: /^kanjivg-\d{8}-all\.zip$/,
    file: 'kanjivg.zip',
  },
  {
    key: 'jmdict-simplified',
    repo: 'scriptin/jmdict-simplified',
    assetPattern: /^jmdict-eng-\d.*\.json\.zip$/,
    file: 'jmdict-eng.zip',
  },
];

export async function latestReleaseAsset(repo, assetPattern) {
  const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: { 'User-Agent': UA, Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) {
    throw new Error(`GitHub release lookup failed for ${repo} (HTTP ${res.status})`);
  }
  const release = await res.json();
  const asset = release.assets.find((a) => assetPattern.test(a.name));
  if (!asset) {
    throw new Error(`No asset matching ${assetPattern} in ${repo} release ${release.tag_name}`);
  }
  return { url: asset.browser_download_url, name: asset.name, tag: release.tag_name };
}

export function formatBytes(bytes) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

export async function downloadFile(url, dest, label) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok || !res.body) {
    throw new Error(`Download failed for ${label} (HTTP ${res.status}): ${url}`);
  }
  const total = Number(res.headers.get('content-length')) || 0;
  const started = Date.now();
  let received = 0;
  let lastLogged = 0;

  const body = Readable.fromWeb(res.body);
  body.on('data', (chunk) => {
    received += chunk.length;
    if (total > 0 && received - lastLogged >= 8 * 1024 * 1024) {
      lastLogged = received;
      const pct = ((received / total) * 100).toFixed(0);
      process.stdout.write(
        `  ${label}: ${pct}% (${formatBytes(received)} / ${formatBytes(total)})\n`
      );
    }
  });

  await pipeline(body, createWriteStream(dest));
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  process.stdout.write(`  ${label}: done — ${formatBytes(received)} in ${secs}s\n`);
}

function isSkippable(dest) {
  return existsSync(dest) && statSync(dest).size > 0;
}

/** Download everything into .data/. Existing files are skipped (§5.9). */
export async function downloadAll({ force = false, log = stdoutLog } = {}) {
  mkdirSync(DATA_DIR, { recursive: true });
  const results = [];

  for (const source of DIRECT_SOURCES) {
    const dest = path.join(DATA_DIR, source.file);
    if (!force && isSkippable(dest)) {
      log(`  ${source.key}: cached, skipping (${formatBytes(statSync(dest).size)})`);
      results.push({ key: source.key, file: source.file, skipped: true });
      continue;
    }
    log(`  ${source.key}: downloading ${source.url}`);
    await downloadFile(source.url, dest, source.key);
    results.push({ key: source.key, file: source.file, skipped: false });
  }

  for (const source of RELEASE_SOURCES) {
    const dest = path.join(DATA_DIR, source.file);
    if (!force && isSkippable(dest)) {
      log(`  ${source.key}: cached, skipping (${formatBytes(statSync(dest).size)})`);
      results.push({ key: source.key, file: source.file, skipped: true });
      continue;
    }
    const asset = await latestReleaseAsset(source.repo, source.assetPattern);
    log(`  ${source.key}: downloading ${asset.name} (${asset.tag})`);
    await downloadFile(asset.url, dest, source.key);
    results.push({ key: source.key, file: source.file, skipped: false });
  }

  return results;
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  const force = process.argv.includes('--force');
  downloadAll({ force })
    .then((results) => {
      const skipped = results.filter((r) => r.skipped).length;
      process.stdout.write(
        `download-data: complete — ${results.length} sources (${skipped} cached) in .data/\n`
      );
      process.exit(0);
    })
    .catch((err) => {
      process.stderr.write(`download-data failed: ${err.message}\n`);
      process.exit(1);
    });
}
