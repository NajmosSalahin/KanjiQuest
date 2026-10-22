import { Router } from 'express';
import { ok } from '../utils/envelope.js';

export const licensesRouter = Router();

/**
 * GET /licenses — prompt.md §5.8: every data source with its license and
 * link, plus the visible KanjiVG attribution notice.
 */
licensesRouter.get('/', (req, res) => {
  return ok(res, {
    notice:
      'Kanji stroke-order data is from KanjiVG, © Ulrich Apel and contributors, ' +
      'licensed under CC BY-SA 3.0.',
    sources: [
      {
        name: 'KANJIDIC2',
        description: 'Kanji meanings, readings, radicals, grades, and frequency.',
        license: 'CC BY-SA 3.0',
        url: 'https://www.edrdg.org/kanjidic/kanjidic2.html',
        attribution: 'EDRDG (Electronic Dictionary Research and Development Group)',
      },
      {
        name: 'KanjiVG',
        description: 'Kanji stroke-order SVG data.',
        license: 'CC BY-SA 3.0',
        url: 'https://github.com/KanjiVG/kanjivg',
        attribution: 'Ulrich Apel and contributors',
      },
      {
        name: 'JMdict',
        description: 'Example words and glosses (via jmdict-simplified).',
        license: 'CC BY-SA 3.0',
        url: 'https://www.edrdg.org/jmdict/j_jmdict.html',
        attribution: 'EDRDG',
      },
      {
        name: 'Tatoeba',
        description: 'Example sentences and translations.',
        license: 'CC BY 2.0 FR',
        url: 'https://tatoeba.org/',
        attribution: 'Tatoeba Project contributors',
      },
      {
        name: 'kanjiapi.dev',
        description: 'JLPT levels and official-list membership.',
        license: 'MIT',
        url: 'https://kanjiapi.dev/',
        attribution: 'onlyskin/kanjiapi.dev',
      },
    ],
  });
});
