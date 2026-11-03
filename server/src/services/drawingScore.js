/**
 * Drawing-canvas stroke-overlap scoring — prompt.md §7.6 / DECISIONS.md D14.
 *
 * Not ML: the KanjiVG stroke paths are flattened into dense points, the
 * learner's pointer strokes are normalized to the same 0–1 box, and the
 * score combines how much of the drawing lies near the template (precision)
 * with how much of the template the drawing covers (recall). A stroke-count
 * factor keeps a single continuous scribble from scoring as a full kanji.
 */

import { QUIZ_DRAWING } from '@kanjigarden/shared';

const TEMPLATE_SIZE = 109; // KanjiVG viewBox
const SAMPLE_STEP = 1.6; // viewBox units between template samples
const USER_DEDUPE = 0.004; // normalized units
const DEFAULT_TOLERANCE = 0.075; // ~22px on the 300px canvas

function tokenize(d) {
  const tokens = [];
  const re = /([MmLlHhVvCcSsQqTtAaZz])|(-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)/gi;
  for (const match of d.matchAll(re)) {
    if (match[1]) tokens.push({ command: match[1] });
    else tokens.push({ number: Number(match[2]) });
  }
  return tokens;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pushPoint(points, point) {
  const last = points[points.length - 1];
  if (!last || distance(last, point) > 0.01) points.push(point);
}

function sampleLine(points, a, b) {
  const len = distance(a, b);
  const steps = Math.max(1, Math.ceil(len / SAMPLE_STEP));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    pushPoint(points, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
}

function sampleCubic(points, p0, c1, c2, p1) {
  const approx = distance(p0, c1) + distance(c1, c2) + distance(c2, p1);
  const steps = Math.max(8, Math.ceil(approx / SAMPLE_STEP));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    pushPoint(points, {
      x: mt * mt * mt * p0.x + 3 * mt * mt * t * c1.x + 3 * mt * t * t * c2.x + t * t * t * p1.x,
      y: mt * mt * mt * p0.y + 3 * mt * mt * t * c1.y + 3 * mt * t * t * c2.y + t * t * t * p1.y,
    });
  }
}

function sampleQuad(points, p0, c, p1) {
  const approx = distance(p0, c) + distance(c, p1);
  const steps = Math.max(8, Math.ceil(approx / SAMPLE_STEP));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    pushPoint(points, {
      x: mt * mt * p0.x + 2 * mt * t * c.x + t * t * p1.x,
      y: mt * mt * p0.y + 2 * mt * t * c.y + t * t * p1.y,
    });
  }
}

/** Endpoint-to-center arc conversion (SVG spec appendix F.6). */
function sampleArc(points, p0, rx, ry, rotation, largeArc, sweep, p1) {
  if (!rx || !ry) {
    sampleLine(points, p0, p1);
    return;
  }
  const phi = (rotation * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (p0.x - p1.x) / 2;
  const dy = (p0.y - p1.y) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;

  let rxa = Math.abs(rx);
  let rya = Math.abs(ry);
  const lambda = (x1p * x1p) / (rxa * rxa) + (y1p * y1p) / (rya * rya);
  if (lambda > 1) {
    const scale = Math.sqrt(lambda);
    rxa *= scale;
    rya *= scale;
  }

  const sign = largeArc === sweep ? -1 : 1;
  const numerator = Math.max(
    0,
    rxa * rxa * rya * rya - rxa * rxa * y1p * y1p - rya * rya * x1p * x1p
  );
  const denominator = rxa * rxa * y1p * y1p + rya * rya * x1p * x1p;
  const coef = denominator === 0 ? 0 : sign * Math.sqrt(numerator / denominator);
  const cxp = (coef * (rxa * y1p)) / rya;
  const cyp = (coef * (-rya * x1p)) / rxa;
  const cx = cos * cxp - sin * cyp + (p0.x + p1.x) / 2;
  const cy = sin * cxp + cos * cyp + (p0.y + p1.y) / 2;

  const angle = (ux, uy, vx, vy) => {
    const dot = ux * vx + uy * vy;
    const len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    const value = len === 0 ? 0 : Math.max(-1, Math.min(1, dot / len));
    const sign2 = ux * vy - uy * vx < 0 ? -1 : 1;
    return sign2 * Math.acos(value);
  };

  const theta1 = angle(1, 0, (x1p - cxp) / rxa, (y1p - cyp) / rya);
  let delta = angle((x1p - cxp) / rxa, (y1p - cyp) / rya, (-x1p - cxp) / rxa, (-y1p - cyp) / rya);
  if (!sweep && delta > 0) delta -= Math.PI * 2;
  if (sweep && delta < 0) delta += Math.PI * 2;

  const steps = Math.max(12, Math.ceil(Math.abs(delta) * Math.max(rxa, rya) * 0.8));
  for (let i = 1; i <= steps; i++) {
    const theta = theta1 + (delta * i) / steps;
    const x = cx + cos * rxa * Math.cos(theta) - sin * rya * Math.sin(theta);
    const y = cy + sin * rxa * Math.cos(theta) + cos * rya * Math.sin(theta);
    pushPoint(points, { x, y });
  }
}

/** Flatten one SVG path `d` into viewBox-space points. */
export function samplePath(d) {
  if (typeof d !== 'string' || d.length === 0) return [];
  const tokens = tokenize(d);
  const points = [];
  let i = 0;
  let cmd = null;
  let current = { x: 0, y: 0 };
  let subpath = { x: 0, y: 0 };
  let prevCubic = null;
  let prevQuad = null;

  const isNumber = () => i < tokens.length && tokens[i].number !== undefined;
  const num = () => (isNumber() ? tokens[i++].number : 0);

  while (i < tokens.length) {
    if (tokens[i].command) {
      cmd = tokens[i++].command;
      if (cmd === 'Z' || cmd === 'z') {
        sampleLine(points, current, subpath);
        current = { ...subpath };
        prevCubic = null;
        prevQuad = null;
      }
      continue;
    }
    if (!cmd) {
      i++;
      continue;
    }

    const relative = cmd === cmd.toLowerCase();
    const base = relative ? current : { x: 0, y: 0 };

    switch (cmd.toUpperCase()) {
      case 'M': {
        const x = base.x + num();
        const y = base.y + num();
        current = { x, y };
        subpath = { ...current };
        pushPoint(points, { ...current });
        cmd = relative ? 'l' : 'L'; // subsequent pairs are line-to
        prevCubic = null;
        prevQuad = null;
        break;
      }
      case 'L': {
        const next = { x: base.x + num(), y: base.y + num() };
        sampleLine(points, current, next);
        current = next;
        prevCubic = null;
        prevQuad = null;
        break;
      }
      case 'H': {
        const next = { x: base.x + num(), y: current.y };
        sampleLine(points, current, next);
        current = next;
        prevCubic = null;
        prevQuad = null;
        break;
      }
      case 'V': {
        const next = { x: current.x, y: base.y + num() };
        sampleLine(points, current, next);
        current = next;
        prevCubic = null;
        prevQuad = null;
        break;
      }
      case 'C': {
        const c1 = { x: base.x + num(), y: base.y + num() };
        const c2 = { x: base.x + num(), y: base.y + num() };
        const p1 = { x: base.x + num(), y: base.y + num() };
        sampleCubic(points, current, c1, c2, p1);
        current = p1;
        prevCubic = c2;
        prevQuad = null;
        break;
      }
      case 'S': {
        const c1 = prevCubic
          ? { x: 2 * current.x - prevCubic.x, y: 2 * current.y - prevCubic.y }
          : current;
        const c2 = { x: base.x + num(), y: base.y + num() };
        const p1 = { x: base.x + num(), y: base.y + num() };
        sampleCubic(points, current, c1, c2, p1);
        current = p1;
        prevCubic = c2;
        prevQuad = null;
        break;
      }
      case 'Q': {
        const c = { x: base.x + num(), y: base.y + num() };
        const p1 = { x: base.x + num(), y: base.y + num() };
        sampleQuad(points, current, c, p1);
        current = p1;
        prevQuad = c;
        prevCubic = null;
        break;
      }
      case 'T': {
        const c = prevQuad
          ? { x: 2 * current.x - prevQuad.x, y: 2 * current.y - prevQuad.y }
          : current;
        const p1 = { x: base.x + num(), y: base.y + num() };
        sampleQuad(points, current, c, p1);
        current = p1;
        prevQuad = c;
        prevCubic = null;
        break;
      }
      case 'A': {
        const rx = num();
        const ry = num();
        const rotation = num();
        const largeArc = num() ? 1 : 0;
        const sweep = num() ? 1 : 0;
        const p1 = { x: base.x + num(), y: base.y + num() };
        sampleArc(points, current, rx, ry, rotation, largeArc, sweep, p1);
        current = p1;
        prevCubic = null;
        prevQuad = null;
        break;
      }
      default:
        i++;
        break;
    }
    // Safety valve for malformed paths.
    if (points.length > 5000) break;
  }

  return points;
}

/** Normalize KanjiVG strokes into per-stroke 0–1 point arrays. */
export function sampleTemplate(strokes) {
  return (strokes ?? [])
    .map((stroke) => {
      const points = samplePath(stroke.d).map((p) => ({
        x: p.x / TEMPLATE_SIZE,
        y: p.y / TEMPLATE_SIZE,
      }));
      return { id: stroke.id ?? String(stroke.n), points };
    })
    .filter((stroke) => stroke.points.length > 1);
}

function dedupe(points, epsilon) {
  const out = [];
  for (const point of points) {
    const last = out[out.length - 1];
    if (!last || distance(last, point) > epsilon) out.push(point);
  }
  return out;
}

/** Pointer events can be sparse on fast strokes; resample so precision and
 *  recall see the same ink the learner actually drew. */
function resample(points, step) {
  if (points.length < 2) return points;
  const out = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const len = distance(a, b);
    const steps = Math.max(1, Math.ceil(len / step));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      if (out.length > 3000) return out;
    }
  }
  return out;
}

function normalizeUserStrokes(strokes, size) {
  return (strokes ?? [])
    .map((stroke) =>
      resample(
        dedupe(
          stroke
            .filter(
              (p) =>
                Number.isFinite(p?.x) &&
                Number.isFinite(p?.y) &&
                p.x >= 0 &&
                p.y >= 0 &&
                p.x <= size &&
                p.y <= size
            )
            .map((p) => ({ x: p.x / size, y: p.y / size })),
          USER_DEDUPE
        ),
        0.006
      )
    )
    .filter((stroke) => stroke.length > 1);
}

function gridKey(x, y, cell) {
  return `${Math.floor(x / cell)}:${Math.floor(y / cell)}`;
}

function buildGrid(points, cell) {
  const grid = new Map();
  for (const point of points) {
    const key = gridKey(point.x, point.y, cell);
    const bucket = grid.get(key);
    if (bucket) bucket.push(point);
    else grid.set(key, [point]);
  }
  return grid;
}

function hasNear(grid, point, tolerance, cell) {
  const cx = Math.floor(point.x / cell);
  const cy = Math.floor(point.y / cell);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const bucket = grid.get(`${cx + dx}:${cy + dy}`);
      if (!bucket) continue;
      for (const candidate of bucket) {
        if (distance(point, candidate) <= tolerance) return true;
      }
    }
  }
  return false;
}

function coverage(source, targetGrid, tolerance, cell) {
  if (source.length === 0) return 0;
  let hit = 0;
  for (const point of source) {
    if (hasNear(targetGrid, point, tolerance, cell)) hit += 1;
  }
  return hit / source.length;
}

/**
 * Score a learner drawing against sampled template strokes.
 * @param {Array<{id:string,points:Array<{x:number,y:number}>}>} template
 * @param {Array<Array<{x:number,y:number}>>} userStrokes canvas-space points
 * @param {{size?:number,tolerance?:number}} options
 */
export function scoreDrawing(template, userStrokes, options = {}) {
  const size = options.size ?? 300;
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;
  const cell = tolerance;

  const templatePoints = template.flatMap((stroke) => stroke.points);
  const user = normalizeUserStrokes(userStrokes, size);
  const userPoints = user.flat();

  if (templatePoints.length === 0 || userPoints.length === 0) {
    return {
      score: 0,
      verdict: 'notQuite',
      precision: 0,
      recall: 0,
      strokeCount: user.length,
      templateStrokeCount: template.length,
      tolerance,
    };
  }

  const templateGrid = buildGrid(templatePoints, cell);
  const userGrid = buildGrid(userPoints, cell);
  const precision = coverage(userPoints, templateGrid, tolerance, cell);
  const recall = coverage(templatePoints, userGrid, tolerance, cell);

  const diff = Math.abs(user.length - template.length);
  const strokeFactor = Math.max(0.55, Math.min(1, 1 - diff / Math.max(1, template.length)));
  const score = Math.max(
    0,
    Math.min(100, Math.round(100 * (precision * 0.5 + recall * 0.5) * strokeFactor))
  );

  return {
    score,
    verdict:
      score >= QUIZ_DRAWING.CORRECT
        ? 'correct'
        : score >= QUIZ_DRAWING.CLOSE
          ? 'close'
          : 'notQuite',
    precision: Math.round(precision * 100) / 100,
    recall: Math.round(recall * 100) / 100,
    strokeCount: user.length,
    templateStrokeCount: template.length,
    tolerance,
  };
}
