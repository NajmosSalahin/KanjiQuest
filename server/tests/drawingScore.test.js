import { describe, it, expect } from 'vitest';
import { samplePath, sampleTemplate, scoreDrawing } from '../src/services/drawingScore.js';

/**
 * Drawing scorer (§7.6 / D14). The algorithm is deliberately geometric, not
 * ML: KanjiVG paths are flattened, the learner's pointer trace is normalized
 * to the same 0–1 box, and precision/recall plus a stroke-count factor decide
 * correct (≥85), close (60–84) or not-quite (<60).
 */

const SQUARE = 'M10 10 L90 10 L90 90 L10 90 Z';

/** Canvas-space trace of the square (KanjiVG 10–90 maps to 30–270 on 300px). */
const TRACE_SQUARE = [
  { x: 30, y: 30 },
  { x: 270, y: 30 },
  { x: 270, y: 270 },
  { x: 30, y: 270 },
  { x: 30, y: 30 },
];

function near(point, x, y, epsilon = 0.5) {
  return Math.abs(point.x - x) <= epsilon && Math.abs(point.y - y) <= epsilon;
}

describe('samplePath', () => {
  it('flattens absolute line segments and closes with Z', () => {
    const points = samplePath(SQUARE);
    expect(points.length).toBeGreaterThan(100);
    expect(near(points[0], 10, 10)).toBe(true);
    expect(points.some((p) => near(p, 90, 10))).toBe(true);
    expect(points.some((p) => near(p, 90, 90))).toBe(true);
    expect(points.some((p) => near(p, 10, 90))).toBe(true);
    expect(near(points.at(-1), 10, 10)).toBe(true);
  });

  it('handles relative commands, H/V and implicit repeated pairs', () => {
    const points = samplePath('m10 10 l80 0 l0 80 h-80 z');
    expect(points.length).toBeGreaterThan(100);
    expect(near(points[0], 10, 10)).toBe(true);
    expect(points.some((p) => near(p, 90, 10))).toBe(true);
    expect(points.some((p) => near(p, 90, 90))).toBe(true);
    expect(near(points.at(-1), 10, 10)).toBe(true);

    // Implicit lineto after M: "M10 10 90 10 90 90"
    const implicit = samplePath('M10 10 90 10 90 90');
    expect(implicit.some((p) => near(p, 90, 10))).toBe(true);
    expect(implicit.some((p) => near(p, 90, 90))).toBe(true);
  });

  it('samples cubic, smooth and quadratic curves', () => {
    const cubic = samplePath('M10 10 C10 50 90 50 90 10');
    expect(cubic.length).toBeGreaterThan(8);
    expect(near(cubic[0], 10, 10)).toBe(true);
    expect(near(cubic.at(-1), 90, 10)).toBe(true);
    expect(cubic.some((p) => p.y > 25)).toBe(true);

    const smooth = samplePath('M10 10 C10 50 90 50 90 10 S170 50 170 10');
    expect(smooth.length).toBeGreaterThan(cubic.length);
    expect(near(smooth.at(-1), 170, 10)).toBe(true);

    const quad = samplePath('M10 10 Q50 70 90 10');
    expect(quad.length).toBeGreaterThan(8);
    expect(quad.some((p) => p.y > 20)).toBe(true);
    expect(near(quad.at(-1), 90, 10)).toBe(true);
  });

  it('samples arcs and returns to the endpoint', () => {
    const arc = samplePath('M10 10 A40 40 0 1 1 90 10');
    expect(arc.length).toBeGreaterThan(12);
    expect(near(arc[0], 10, 10)).toBe(true);
    expect(near(arc.at(-1), 90, 10)).toBe(true);
    // Sweep=1 goes clockwise, i.e. above the chord in SVG's y-down space.
    expect(arc.some((p) => p.y < -20)).toBe(true);

    // Degenerate radii fall back to a straight line.
    const flat = samplePath('M10 10 A0 0 0 0 1 90 10');
    expect(flat.every((p) => near(p, p.x, 10))).toBe(true);
  });

  it('returns [] for empty or non-path input', () => {
    expect(samplePath('')).toEqual([]);
    expect(samplePath(undefined)).toEqual([]);
    expect(samplePath(42)).toEqual([]);
    expect(samplePath('not a path')).toEqual([]);
  });

  it('handles multiple subpaths without connecting them', () => {
    const points = samplePath('M10 10 L90 10 M10 90 L90 90');
    expect(points.some((p) => near(p, 10, 10))).toBe(true);
    expect(points.some((p) => near(p, 10, 90))).toBe(true);
    // No samples may bridge the gap between the two lines.
    expect(points.every((p) => near(p, p.x, 10) || near(p, p.x, 90))).toBe(true);
  });
});

describe('sampleTemplate', () => {
  it('normalizes KanjiVG 109-unit paths into the 0–1 box', () => {
    const [stroke] = sampleTemplate([{ id: 's1', d: 'M0 0 L109 109' }]);
    expect(stroke.id).toBe('s1');
    expect(stroke.points[0]).toEqual({ x: 0, y: 0 });
    expect(stroke.points.at(-1).x).toBeCloseTo(1, 6);
    expect(stroke.points.at(-1).y).toBeCloseTo(1, 6);
  });

  it('drops empty and single-point strokes, and falls back to stroke number', () => {
    const strokes = sampleTemplate([
      { id: 'a', d: 'M10 10' },
      { id: 'b', d: '' },
      { n: 3, d: 'M10 10 L20 20' },
    ]);
    expect(strokes).toHaveLength(1);
    expect(strokes[0].id).toBe('3');
  });

  it('returns [] for missing strokes', () => {
    expect(sampleTemplate(undefined)).toEqual([]);
    expect(sampleTemplate([])).toEqual([]);
  });
});

describe('scoreDrawing', () => {
  const template = sampleTemplate([{ id: 's1', d: SQUARE }]);

  it('scores an exact trace as correct', () => {
    const result = scoreDrawing(template, [TRACE_SQUARE], { size: 300 });
    expect(result.verdict).toBe('correct');
    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.precision).toBeGreaterThan(0.9);
    expect(result.recall).toBeGreaterThan(0.9);
    expect(result.strokeCount).toBe(1);
    expect(result.templateStrokeCount).toBe(1);
  });

  it('resamples sparse pointer events so a fast stroke still scores', () => {
    const sparse = [
      { x: 30, y: 30 },
      { x: 270, y: 270 },
    ];
    // Two points cannot describe the square; the result must not be a false
    // positive just because both endpoints touch the template.
    const result = scoreDrawing(template, [sparse], { size: 300 });
    expect(result.verdict).toBe('notQuite');
  });

  it('gives partial credit for a partial trace', () => {
    const half = [
      [
        { x: 30, y: 30 },
        { x: 270, y: 30 },
        { x: 270, y: 270 },
      ],
    ];
    const result = scoreDrawing(template, half, { size: 300 });
    expect(result.verdict).toBe('close');
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.score).toBeLessThan(85);
    expect(result.recall).toBeLessThan(result.precision);
  });

  it('rejects a drawing shifted far from the template', () => {
    const shifted = [
      [
        { x: 180, y: 30 },
        { x: 270, y: 30 },
        { x: 270, y: 270 },
        { x: 180, y: 270 },
        { x: 180, y: 30 },
      ],
    ];
    const result = scoreDrawing(template, shifted, { size: 300 });
    expect(result.verdict).toBe('notQuite');
    expect(result.score).toBeLessThan(60);
  });

  it('penalizes an extra stroke even when the template is covered', () => {
    const withStray = [
      TRACE_SQUARE,
      [
        { x: 0, y: 0 },
        { x: 0, y: 300 },
      ],
    ];
    const result = scoreDrawing(template, withStray, { size: 300 });
    expect(result.strokeCount).toBe(2);
    expect(result.score).toBeLessThan(85);
    expect(result.verdict).not.toBe('correct');
  });

  it('penalizes drawing a multi-stroke kanji as one continuous stroke', () => {
    const twoStroke = sampleTemplate([
      { id: 's1', d: 'M10 10 L90 10 L90 90 L10 90 Z' },
      { id: 's2', d: 'M10 90 L90 10' },
    ]);
    const oneStroke = [[...TRACE_SQUARE, { x: 270, y: 30 }]];
    const result = scoreDrawing(twoStroke, oneStroke, { size: 300 });
    expect(result.templateStrokeCount).toBe(2);
    expect(result.strokeCount).toBe(1);
    expect(result.verdict).not.toBe('correct');
    expect(result.score).toBeLessThan(85);
  });

  it('returns zero when either side has no drawable points', () => {
    expect(scoreDrawing(template, [], { size: 300 })).toMatchObject({
      score: 0,
      verdict: 'notQuite',
      precision: 0,
      recall: 0,
    });
    expect(scoreDrawing([], [TRACE_SQUARE], { size: 300 })).toMatchObject({
      score: 0,
      verdict: 'notQuite',
    });
    expect(scoreDrawing(template, [[{ x: 30, y: 30 }]], { size: 300 })).toMatchObject({
      score: 0,
      verdict: 'notQuite',
    });
  });

  it('filters out-of-canvas and non-finite points', () => {
    const dirty = [
      [
        { x: -20, y: 30 },
        { x: 400, y: 30 },
        { x: Number.NaN, y: 30 },
        { x: 30, y: 30 },
        { x: 270, y: 30 },
        { x: 270, y: 270 },
        { x: 30, y: 270 },
        { x: 30, y: 30 },
      ],
    ];
    const result = scoreDrawing(template, dirty, { size: 300 });
    expect(result.verdict).toBe('correct');
    expect(result.precision).toBeGreaterThan(0.9);
  });

  it('normalizes the same drawing at different canvas sizes', () => {
    const at300 = scoreDrawing(template, [TRACE_SQUARE], { size: 300 });
    const at600 = scoreDrawing(
      template,
      [
        [
          { x: 60, y: 60 },
          { x: 540, y: 60 },
          { x: 540, y: 540 },
          { x: 60, y: 540 },
          { x: 60, y: 60 },
        ],
      ],
      { size: 600 }
    );
    expect(at600.score).toBe(at300.score);
  });

  it('honours a custom tolerance', () => {
    const shifted = [
      [
        { x: 180, y: 30 },
        { x: 270, y: 30 },
        { x: 270, y: 270 },
        { x: 180, y: 270 },
        { x: 180, y: 30 },
      ],
    ];
    const strict = scoreDrawing(template, shifted, { size: 300 });
    const loose = scoreDrawing(template, shifted, { size: 300, tolerance: 0.5 });
    expect(loose.score).toBeGreaterThan(strict.score);
    expect(loose.verdict).toBe('correct');
  });
});
