import { Schema, model } from 'mongoose';

/** radicals — prompt.md §5.6: { character, meaning, mnemonic, strokeCount, variants[] } */
const radicalSchema = new Schema({
  character: { type: String, required: true, unique: true },
  meaning: { type: String, required: true },
  mnemonic: { type: String, required: true },
  strokeCount: { type: Number, required: true },
  variants: { type: [String], default: [] },
});

export const Radical = model('Radical', radicalSchema);
