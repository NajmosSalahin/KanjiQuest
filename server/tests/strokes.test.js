import { describe, it, expect } from 'vitest';
import { extractStrokes } from '../src/services/strokes.js';

/**
 * KanjiVG stroke extraction (§7.4). Two real-world shapes exist:
 * current releases nest paths under an inner `<g id="kvg:<hex>">` inside
 * StrokePaths_ and put number labels in a separate StrokeNumbers_ group;
 * older/fixture-style files keep both directly in StrokePaths_. The flat
 * fixture alone passed while all production SVGs extracted 0 strokes — both
 * shapes are locked down here.
 */

const REALISTIC = `<?xml version="1.0" encoding="UTF-8"?>
<!--
Copyright (C) 2009/2010/2011 Ulrich Apel. Distributed under CC BY-SA 3.0.
-->
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.0//EN" "http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd">
<svg xmlns="http://www.w3.org/2000/svg" width="109" height="109" viewBox="0 0 109 109" xmlns:kvg="https://kanjivg.tagaini.net/">
<g id="kvg:StrokePaths_065e5" style="fill:none;stroke:#000000;stroke-width:3;">
<g id="kvg:065e5" kvg:element="日" kvg:radical="general">
	<path id="kvg:065e5-s1" kvg:type="㇑" d="M31.5,24.5c1.12,1.12,1.74,2.75,1.74,4.75"/>
	<path id="kvg:065e5-s2" kvg:type="㇕a" d="M33.48,26c0.8-0.05,37.67-3.01,40.77-3.25"/>
	<path id="kvg:065e5-s3" kvg:type="㇐a" d="M34.22,55.25c7.78-0.5,35.9-2.5,44.06-2.75"/>
</g>
</g>
<g id="kvg:StrokeNumbers_065e5" style="font-size:8;fill:#808080">
	<text transform="matrix(1 0 0 1 25.25 32.63)">1</text>
	<text transform="matrix(1 0 0 1 46.50 31.50)">2</text>
	<text transform="matrix(1 0 0 1 39.50 54.50)">3</text>
</g>
<g id="kvg:ComponentPaths_065e5">
	<path id="kvg:065e5-c1" d="M10,10"/>
</g>
</svg>`;

const FLAT = `<svg>
<g id="kvg:StrokePaths_65e5" kvg:element="日">
	<path id="kvg:65e5-s1" d="M19.5,27.5"/>
	<path id="kvg:65e5-s2" d="M19.5,41.5"/>
	<text class="number" x="13.5" y="24.5">1</text>
	<text class="number" x="30.5" y="38.5">2</text>
</g>
</svg>`;

describe('extractStrokes (§7.4 stroke card)', () => {
  it('handles real KanjiVG: nested paths + external StrokeNumbers labels', () => {
    const strokes = extractStrokes(REALISTIC);
    expect(strokes).toHaveLength(3);
    // Labels are class-less <text> with position in a matrix transform.
    expect(strokes[0]).toEqual({
      n: 1,
      d: 'M31.5,24.5c1.12,1.12,1.74,2.75,1.74,4.75',
      x: '25.25',
      y: '32.63',
    });
    expect(strokes[2]).toMatchObject({ n: 3, x: '39.50', y: '54.50' });
    // ComponentPaths_ id must never be picked up as a stroke.
    expect(strokes.map((s) => s.d)).not.toContain('M10,10');
  });

  it('handles flat fixture shape: paths and labels inside StrokePaths_', () => {
    const strokes = extractStrokes(FLAT);
    expect(strokes).toHaveLength(2);
    expect(strokes[0]).toMatchObject({ n: 1, x: '13.5', y: '24.5' });
    expect(strokes[1]).toMatchObject({ n: 2, d: 'M19.5,41.5' });
  });

  it('returns [] for missing or non-stroke SVGs', () => {
    expect(extractStrokes(undefined)).toEqual([]);
    expect(extractStrokes('')).toEqual([]);
    expect(extractStrokes('<svg><g id="other"/></svg>')).toEqual([]);
  });
});
