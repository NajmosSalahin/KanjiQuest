import { Schema, model } from 'mongoose';

/** achievements — prompt.md §8: "Seeded definitions with structured criteria
 *  (e.g. {type:'XP_TOTAL', threshold:1000}), icon, category, rewardXP,
 *  rewardCoins". D11 amends the count to 41, all Japanese-named. */
const achievementSchema = new Schema(
  {
    id: { type: String, required: true, unique: true }, // stable key, e.g. 'kokoro'
    name: { type: String, required: true }, // romaji, e.g. 'Kokoro'
    nameJa: { type: String, required: true }, // 心
    description: { type: String, required: true },
    icon: { type: String, required: true }, // client icon-registry key (= id)
    category: {
      type: String,
      enum: ['learning', 'streak', 'collection', 'mastery', 'special'],
      required: true,
    },
    criteria: { type: Schema.Types.Mixed, required: true }, // structured, see services/achievements.js
    rewardXP: { type: Number, default: 0 },
    rewardCoins: { type: Number, default: 0 },
    order: { type: Number, required: true },
  },
  { timestamps: true }
);

export const Achievement = model('Achievement', achievementSchema);

/** Public projection for API responses. */
export function publicAchievement(def) {
  return {
    id: def.id,
    name: def.name,
    nameJa: def.nameJa,
    description: def.description,
    icon: def.icon,
    category: def.category,
    rewardXP: def.rewardXP,
    rewardCoins: def.rewardCoins,
  };
}
