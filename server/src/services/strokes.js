import { XMLParser } from 'fast-xml-parser';

/**
 * Extract drawable stroke data from a stored KanjiVG SVG (§7.4 stroke card).
 * Returns [{ n, d, x, y }] — path data plus the stroke-number label position.
 * React renders these as elements (no innerHTML), so stored SVG stays inert.
 */

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
  trimValues: true,
});

function asArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function findGroupBy(node, needle) {
  if (node === null || node === undefined || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findGroupBy(child, needle);
      if (found) return found;
    }
    return null;
  }
  if (typeof node['@_id'] === 'string' && node['@_id'].includes(needle)) {
    return node;
  }
  for (const value of Object.values(node)) {
    const found = findGroupBy(value, needle);
    if (found) return found;
  }
  return null;
}

/** Stroke paths in document order. Real KanjiVG nests them under an inner
 *  `<g id="kvg:<hex>" kvg:element="…">` inside StrokePaths_ (fixture-style
 *  flat groups also occur) — collect recursively at any depth. */
function collectStrokePaths(node, out) {
  if (node === null || node === undefined || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const child of node) collectStrokePaths(child, out);
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('@_') || key === '#text') continue;
    if (key === 'path') {
      for (const path of asArray(value)) {
        if (typeof path['@_id'] === 'string' && /-s\d+$/.test(path['@_id'])) out.push(path);
      }
      continue;
    }
    collectStrokePaths(value, out);
  }
}

/** `text.number` labels at any depth: { '1': { x, y }, … }.
 *  Real KanjiVG's StrokeNumbers_ texts carry no class and no x/y — the
 *  position is `transform="matrix(1 0 0 1 TX TY)"`; flat fixtures use
 *  class="number" with x/y attributes. Accept both. */
function labelPosition(text) {
  let x = text['@_x'] ?? null;
  let y = text['@_y'] ?? null;
  if ((x === null || y === null) && typeof text['@_transform'] === 'string') {
    const m =
      /matrix\(\s*1\s+0\s+0\s+1\s+([-\d.]+)\s+([-\d.]+)\s*\)/.exec(text['@_transform']) ??
      /translate\(\s*([-\d.]+)[\s,]+([-\d.]+)\s*\)/.exec(text['@_transform']);
    if (m) {
      x = x ?? m[1];
      y = y ?? m[2];
    }
  }
  return { x, y };
}

function collectNumberLabels(node, labels) {
  if (node === null || node === undefined || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const child of node) collectNumberLabels(child, labels);
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('@_') || key === '#text') continue;
    if (key === 'text') {
      for (const text of asArray(value)) {
        const raw = text['#text'];
        if (raw === undefined) continue;
        const cls = text['@_class'];
        if (cls !== undefined && cls !== 'number') continue;
        const num = String(raw).trim();
        if (cls === undefined && !/^\d+$/.test(num)) continue;
        labels.set(num, labelPosition(text));
      }
      continue;
    }
    collectNumberLabels(value, labels);
  }
}

const numberCache = new Map();

export function extractStrokes(svg) {
  if (!svg) return [];
  const cached = numberCache.get(svg);
  if (cached) return cached;

  let strokes = [];
  try {
    const doc = parser.parse(svg);
    const group = findGroupBy(doc, 'StrokePaths_');
    if (group) {
      const rawPaths = [];
      collectStrokePaths(group, rawPaths);
      const paths = rawPaths
        .map((p) => ({ id: p['@_id'], d: p['@_d'] }))
        .filter((p) => typeof p.d === 'string');
      const labels = new Map();
      collectNumberLabels(group, labels); // flat fixtures keep labels in-group
      const numbersGroup = findGroupBy(doc, 'StrokeNumbers_');
      if (numbersGroup) collectNumberLabels(numbersGroup, labels); // real KanjiVG
      strokes = paths
        .map((p, i) => {
          const n = i + 1;
          const label = labels.get(String(n)) ?? {};
          return { n, d: p.d, x: label.x ?? null, y: label.y ?? null };
        })
        .filter((s) => s.d);
    }
  } catch {
    strokes = [];
  }

  if (numberCache.size >= 500) numberCache.clear();
  numberCache.set(svg, strokes);
  return strokes;
}
