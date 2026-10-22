import { Schema, model } from 'mongoose';

/** kanji — prompt.md §5.4 (fields) + §5.5 (indexes). 13,108 documents. */
const kanjiSchema = new Schema({
  character: { type: String, required: true, unique: true },
  unicode: { type: String, required: true, unique: true },
  meanings: { type: [String], default: [] },
  readingsOn: { type: [String], default: [] },
  readingsKun: { type: [String], default: [] },
  nameReadings: { type: [String], default: [] },
  jlptLevel: { type: Number, default: null },
  grade: { type: Number, default: null },
  strokeCount: { type: Number, required: true },
  radical: { type: String, default: null },
  radicals: { type: [String], default: [] },
  components: { type: [String], default: [] },
  strokeOrderSvg: { type: String, default: null },
  hasStrokeOrder: { type: Boolean, default: false },
  frequencyRank: { type: Number, default: null },
  isJoyo: { type: Boolean, default: false },
  isJinmeiyo: { type: Boolean, default: false },
  isKyouiku: { type: Boolean, default: false },
  exampleWords: {
    type: [
      {
        _id: false,
        word: String,
        reading: String,
        meaning: String,
        jlptLevel: { type: Number, default: null },
        common: { type: Boolean, default: false },
      },
    ],
    default: [],
  },
  exampleSentences: {
    type: [
      {
        _id: false,
        japanese: String,
        english: String,
        audioUrl: { type: String, default: null },
      },
    ],
    default: [],
  },
  mnemonic: { type: String, default: null },
});

// §5.5 indexes — character + unicode unique (schema), the rest:
kanjiSchema.index({ jlptLevel: 1 }, { sparse: true });
kanjiSchema.index({ strokeCount: 1 });
kanjiSchema.index({ isJoyo: 1 });
kanjiSchema.index({ isJinmeiyo: 1 });
kanjiSchema.index({ frequencyRank: 1 });
kanjiSchema.index({ meanings: 'text' }, { name: 'meanings_text', default_language: 'english' });
kanjiSchema.index({ jlptLevel: 1, frequencyRank: 1 });

export const Kanji = model('Kanji', kanjiSchema);
