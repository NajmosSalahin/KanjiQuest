import { execFile, spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';

/**
 * Tatoeba example-sentence matching (§5.3 item 6): one Japanese sentence with
 * English translation per kanji, preferring sentences of ≤20 characters.
 * .tar.bz2: POSIX tars decompress bzip2 in-process; Windows bsdtar delegates
 * to an external `bzip2`, so on win32 we own the pipeline ourselves
 * (`bzip2 -dc` stdout -> `tar -xf -` stdin) instead of trusting libarchive's
 * external-program filter, which proved unreliable across stdio contexts.
 * No bz2 dependency added (see DECISIONS.md).
 */

const stdoutLog = (message) => process.stdout.write(`${message}\n`);

/** Absolute path of the first `name` on the CURRENT PATH (unmodified). */
function onPath(name) {
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, name);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** bzip2 on PATH, else Git for Windows' bundled copies (outside PATH). */
function locateBzip2Exe() {
  if (process.platform !== 'win32') return null;
  const fromPath = onPath('bzip2.exe');
  if (fromPath) return fromPath;
  const bundled = [
    'C:\\Program Files\\Git\\usr\\bin\\bzip2.exe',
    'C:\\Program Files (x86)\\Git\\usr\\bin\\bzip2.exe',
    'C:\\Program Files\\Git\\mingw64\\bin\\bzip2.exe',
    'C:\\Program Files\\Git\\mingw32\\bin\\bzip2.exe',
  ];
  for (const candidate of bundled) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** Resolve the tar on the CURRENT PATH before any modification — Git's
 *  usr/bin also ships a GNU tar that misparses `F:\…` as a remote archive. */
function resolveTar() {
  const exe = process.platform === 'win32' ? 'tar.exe' : 'tar';
  return onPath(exe) ?? (process.platform === 'win32' ? 'C:\\Windows\\System32\\tar.exe' : 'tar');
}

function tarExtract(tarPath, archivePath, outDir, env) {
  return new Promise((resolve, reject) => {
    execFile(tarPath, ['-xjf', archivePath, '-C', outDir], { env }, (err) =>
      err ? reject(err) : resolve()
    );
  });
}

/** win32: `bzip2 -dc file | tar -xf - -C out` with both ends under Node. */
function extractViaPipe(tarPath, bzip2Path, archivePath, outDir) {
  return new Promise((resolve, reject) => {
    const bzip2 = spawn(bzip2Path, ['-dc', archivePath], { stdio: ['ignore', 'pipe', 'pipe'] });
    const tar = spawn(tarPath, ['-xf', '-', '-C', outDir], { stdio: ['pipe', 'ignore', 'pipe'] });
    let bzErr = '';
    let tarErr = '';
    let bzCode = null;
    let tarCode = null;
    let settled = false;
    const fail = (message) => {
      if (settled) return;
      settled = true;
      reject(new Error(message));
    };
    const maybeDone = () => {
      if (bzCode === null || tarCode === null) return;
      if (bzCode === 0 && tarCode === 0) {
        settled = true;
        resolve();
        return;
      }
      fail(
        `bzip2 exit ${bzCode}${bzErr ? `: ${bzErr.trim()}` : ''} | ` +
          `tar exit ${tarCode}${tarErr ? `: ${tarErr.trim()}` : ''}`
      );
    };
    bzip2.stdout.pipe(tar.stdin);
    tar.stdin.on('error', () => {}); // EPIPE when tar dies first — bzip2's close reports it
    bzip2.stderr.on('data', (chunk) => {
      bzErr += chunk;
    });
    tar.stderr.on('data', (chunk) => {
      tarErr += chunk;
    });
    bzip2.on('error', (err) => fail(`bzip2 failed to start: ${err.message}`));
    tar.on('error', (err) => fail(`tar failed to start: ${err.message}`));
    bzip2.on('close', (code) => {
      bzCode = code;
      maybeDone();
    });
    tar.on('close', (code) => {
      tarCode = code;
      maybeDone();
    });
  });
}

export async function extractTarBz2(archivePath, outDir, log) {
  const write = log ?? stdoutLog;
  mkdirSync(outDir, { recursive: true });
  try {
    if (process.platform === 'win32') {
      const bzip2Path = locateBzip2Exe();
      if (!bzip2Path) {
        throw new Error(
          'no bzip2 executable found. Install bzip2 (Git for Windows bundles it) ' +
            'or add bzip2 to PATH, then re-run.'
        );
      }
      await extractViaPipe(resolveTar(), bzip2Path, archivePath, outDir);
    } else {
      await tarExtract(resolveTar(), archivePath, outDir, process.env);
    }
  } catch (err) {
    throw new Error(
      `tar extraction failed for ${archivePath}: ${err.message}. ` +
        'The system tar must support reading bzip2 streams (-j / piped stdin).'
    );
  }
  write(`  extracted ${path.basename(archivePath)} -> ${outDir}`);
}

/** Find sentences.csv / links.csv under dir (archive layout may nest). */
export async function findFileRecursive(dir, fileName) {
  const direct = path.join(dir, fileName);
  if (existsSync(direct) && statSync(direct).isFile()) return direct;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const found = await findFileRecursive(path.join(dir, entry.name), fileName);
      if (found) return found;
    }
  }
  return null;
}

function lines(filePath) {
  return createInterface({
    input: createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
}

const CJK = /[㐀-鿿぀-ヿ豈-﫿]/u;

/**
 * Build character -> { japanese, english } from the extracted CSVs.
 * Three streaming passes keep memory bounded to jpn + linked eng sentences.
 */
export async function buildSentenceIndex(sentencesCsv, linksCsv, log = stdoutLog) {
  // Pass 1: Japanese sentences (id -> text).
  const jpn = new Map();
  let lineCount = 0;
  for await (const line of lines(sentencesCsv)) {
    lineCount++;
    if (lineCount % 2_000_000 === 0) log(`  sentences pass 1: ${lineCount} lines…`);
    const first = line.indexOf('\t');
    if (first === -1) continue;
    const id = line.slice(0, first);
    const rest = line.slice(first + 1);
    const second = rest.indexOf('\t');
    if (second === -1) continue;
    const lang = rest.slice(0, second);
    if (lang === 'jpn') jpn.set(id, rest.slice(second + 1));
  }

  // Links: jpn id -> linked ids.
  const linked = new Map();
  const linkedIds = new Set();
  for await (const line of lines(linksCsv)) {
    const [id1, id2] = line.split('\t');
    if (id1 !== undefined && id2 !== undefined && jpn.has(id1)) {
      let list = linked.get(id1);
      if (!list) {
        list = [];
        linked.set(id1, list);
      }
      if (list.length < 3) list.push(id2);
      linkedIds.add(id2);
    }
  }

  // Pass 2: English text for linked ids only.
  const eng = new Map();
  lineCount = 0;
  for await (const line of lines(sentencesCsv)) {
    lineCount++;
    if (lineCount % 2_000_000 === 0) log(`  sentences pass 2: ${lineCount} lines…`);
    const first = line.indexOf('\t');
    if (first === -1) continue;
    const id = line.slice(0, first);
    if (!linkedIds.has(id)) continue;
    const rest = line.slice(first + 1);
    const second = rest.indexOf('\t');
    if (second === -1) continue;
    if (rest.slice(0, second) === 'eng') eng.set(id, rest.slice(second + 1));
  }

  // Assemble: character -> best sentence (prefer ≤20 chars).
  const index = new Map();
  for (const [jpnId, japanese] of jpn) {
    const ids = linked.get(jpnId);
    if (!ids) continue;
    let english = null;
    for (const id of ids) {
      const text = eng.get(id);
      if (text) {
        english = text;
        break;
      }
    }
    if (!english) continue;
    const short = [...japanese].length <= 20;
    for (const ch of new Set([...japanese])) {
      if (!CJK.test(ch)) continue;
      const current = index.get(ch);
      if (!current || (current.long && short)) {
        index.set(ch, { japanese, english, long: !short });
      }
    }
  }
  log(`  sentence index: ${index.size} characters covered`);
  return index;
}

export async function loadTatoeba(dataDir, log = stdoutLog) {
  const extractDir = path.join(dataDir, 'tatoeba');
  const sentencesArchive = path.join(dataDir, 'sentences.tar.bz2');
  const linksArchive = path.join(dataDir, 'links.tar.bz2');
  const cachedCsv = path.join(extractDir, 'sentences.csv');
  if (!existsSync(cachedCsv)) {
    await extractTarBz2(sentencesArchive, extractDir, log);
    await extractTarBz2(linksArchive, extractDir, log);
  }
  const sentencesCsv = await findFileRecursive(extractDir, 'sentences.csv');
  const linksCsv = await findFileRecursive(extractDir, 'links.csv');
  if (!sentencesCsv || !linksCsv) {
    throw new Error(`sentences.csv / links.csv not found under ${extractDir}`);
  }
  return { sentencesCsv, linksCsv };
}

export async function readJmdict(jsonPath) {
  const raw = await readFile(jsonPath, 'utf8');
  const parsed = JSON.parse(raw);
  return parsed.words ?? [];
}
