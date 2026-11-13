/**
 * Store — prompt.md §6.11 / §7.10. All prices and effects are server-side;
 * the client only renders the catalogue and posts an item id.
 *
 * Purchases use conditional atomic updates (coin balance, freeze cap) so two
 * concurrent requests cannot overdraw or exceed the freeze cap. If a follow-up
 * write fails the deduction is compensated (no Mongo transactions because the
 * test database is standalone).
 */
import { STORE, storeItem, STORE_ITEM_TYPES } from '@kanjigarden/shared';
import { GamificationProfile, ensureGamificationProfile } from '../models/GamificationProfile.js';
import { UserInventory } from '../models/UserInventory.js';
import { ApiError } from '../middleware/errors.js';

const BOOST_MS = STORE.XP_BOOST.durationHours * 60 * 60 * 1000;

function itemState(item, profile, inventoryByItem, now) {
  const owned = inventoryByItem.get(item.id);
  const quantity = owned?.quantity ?? 0;
  const equipped =
    (item.type === STORE_ITEM_TYPES.TITLE && profile.equippedTitle === item.id) ||
    (item.type === STORE_ITEM_TYPES.FRAME && profile.equippedFrame === item.id);
  const active =
    item.type === STORE_ITEM_TYPES.BOOST
      ? !!profile.xpBoostExpiresAt && profile.xpBoostExpiresAt > now
      : false;
  const atMax = item.type === STORE_ITEM_TYPES.FREEZE && profile.streakFreezes >= item.maxActive;
  const remainingCoins = Math.max(0, item.price - profile.coins);
  let disabledReason = null;
  if (atMax) {
    disabledReason = 'MAX_FREEZES';
  } else if (
    (item.type === STORE_ITEM_TYPES.TITLE || item.type === STORE_ITEM_TYPES.FRAME) &&
    quantity > 0
  ) {
    disabledReason = 'ALREADY_OWNED';
  } else if (remainingCoins > 0) {
    disabledReason = 'INSUFFICIENT_COINS';
  }

  return {
    ...item,
    owned: quantity > 0,
    quantity,
    equipped,
    active,
    atMax,
    affordable: remainingCoins === 0,
    remainingCoins,
    disabledReason,
    canBuy: !disabledReason,
  };
}

export async function getStore(userId, now = new Date()) {
  const profile = await ensureGamificationProfile(userId);
  const inventory = await UserInventory.find({ userId }).lean();
  const byId = new Map(inventory.map((row) => [row.itemId, row]));
  return {
    items: STORE.ITEMS.map((item) => itemState(item, profile, byId, now)),
    coins: profile.coins,
    weeklyXP: profile.weeklyXP ?? 0,
    equippedTitle: profile.equippedTitle,
    equippedFrame: profile.equippedFrame,
    xpBoostExpiresAt: profile.xpBoostExpiresAt,
    streakFreezes: profile.streakFreezes,
  };
}

export async function getInventory(userId, now = new Date()) {
  const profile = await ensureGamificationProfile(userId);
  const inventory = await UserInventory.find({ userId }).sort({ firstPurchasedAt: 1 }).lean();
  const byId = new Map(inventory.map((row) => [row.itemId, row]));
  const owned = [];
  for (const row of inventory) {
    const item = storeItem(row.itemId);
    if (!item) continue; // catalogue item retired after purchase
    owned.push(itemState(item, profile, byId, now));
  }
  return { items: owned };
}

/** Consume N freeze items from inventory to mirror the profile counter. */
export async function consumeFreezeInventory(userId, count) {
  if (!count || count <= 0) return;
  await UserInventory.updateOne(
    { userId, itemId: 'streak-freeze', quantity: { $gte: count } },
    { $inc: { quantity: -count } }
  );
}

export async function purchaseItem(userId, itemId, now = new Date()) {
  const item = storeItem(itemId);
  if (!item) throw new ApiError(404, 'ITEM_NOT_FOUND', 'That store item does not exist.');
  const profile = await ensureGamificationProfile(userId);

  if (item.type === STORE_ITEM_TYPES.FREEZE && profile.streakFreezes >= item.maxActive) {
    throw new ApiError(
      409,
      'MAX_FREEZES',
      `You can hold at most ${item.maxActive} streak freezes.`
    );
  }
  if (item.type === STORE_ITEM_TYPES.TITLE || item.type === STORE_ITEM_TYPES.FRAME) {
    const owned = await UserInventory.exists({ userId, itemId });
    if (owned) throw new ApiError(409, 'ALREADY_OWNED', 'You already own that item.');
  }
  if (profile.coins < item.price) {
    throw new ApiError(
      400,
      'INSUFFICIENT_COINS',
      `You need ${item.price - profile.coins} more coins for that item.`
    );
  }

  // 1. Atomically deduct coins (and the freeze slot) with the balance in the
  //    filter, so a concurrent purchase cannot overdraw.
  const filter = { userId, coins: { $gte: item.price } };
  const increment = { coins: -item.price };
  if (item.type === STORE_ITEM_TYPES.FREEZE) {
    filter.streakFreezes = { $lt: item.maxActive };
    increment.streakFreezes = 1;
  }
  const updated = await GamificationProfile.findOneAndUpdate(
    filter,
    { $inc: increment },
    { new: true }
  );
  if (!updated) {
    throw new ApiError(400, 'INSUFFICIENT_COINS', 'Your coin balance changed. Try again.');
  }

  // 2. Record ownership. If this fails, refund the deduction.
  let inventory;
  try {
    inventory = await UserInventory.findOneAndUpdate(
      { userId, itemId },
      {
        $inc: { quantity: 1 },
        $set: { lastPurchasedAt: now },
        $setOnInsert: { type: item.type, firstPurchasedAt: now },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    await GamificationProfile.updateOne(
      { _id: updated._id },
      {
        $inc: {
          coins: item.price,
          ...(item.type === STORE_ITEM_TYPES.FREEZE ? { streakFreezes: -1 } : {}),
        },
      }
    );
    throw err;
  }

  // 3. Apply the effect. Boost purchases extend from the later of now and the
  //    current expiry (D17) so no paid time is lost.
  if (item.type === STORE_ITEM_TYPES.BOOST) {
    const base =
      updated.xpBoostExpiresAt && updated.xpBoostExpiresAt > now ? updated.xpBoostExpiresAt : now;
    updated.xpBoostExpiresAt = new Date(base.getTime() + BOOST_MS);
    try {
      await updated.save();
    } catch (err) {
      await UserInventory.updateOne({ userId, itemId }, { $inc: { quantity: -1 } });
      await GamificationProfile.updateOne({ _id: updated._id }, { $inc: { coins: item.price } });
      throw err;
    }
  }

  return {
    item: itemState(item, updated, new Map([[itemId, inventory]]), now),
    coins: updated.coins,
    streakFreezes: updated.streakFreezes,
    xpBoostExpiresAt: updated.xpBoostExpiresAt,
    inventory: {
      itemId: inventory.itemId,
      quantity: inventory.quantity,
      type: inventory.type,
    },
  };
}

export async function equipItem(userId, slot, itemId) {
  if (slot !== 'title' && slot !== 'frame') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Choose a title or frame slot.');
  }
  const profile = await ensureGamificationProfile(userId);

  if (itemId === null) {
    if (slot === 'title') profile.equippedTitle = null;
    else profile.equippedFrame = null;
    await profile.save();
    return { equippedTitle: profile.equippedTitle, equippedFrame: profile.equippedFrame };
  }

  const item = storeItem(itemId);
  if (!item) throw new ApiError(404, 'ITEM_NOT_FOUND', 'That store item does not exist.');
  const expectedType = slot === 'title' ? STORE_ITEM_TYPES.TITLE : STORE_ITEM_TYPES.FRAME;
  if (item.type !== expectedType) {
    throw new ApiError(400, 'WRONG_SLOT', `That item is not a ${slot}.`);
  }
  const owned = await UserInventory.exists({ userId, itemId, quantity: { $gt: 0 } });
  if (!owned) throw new ApiError(403, 'NOT_OWNED', 'Buy that item before equipping it.');

  if (slot === 'title') profile.equippedTitle = itemId;
  else profile.equippedFrame = itemId;
  await profile.save();
  return {
    equippedTitle: profile.equippedTitle,
    equippedFrame: profile.equippedFrame,
    titleName: profile.equippedTitle ? (storeItem(profile.equippedTitle)?.name ?? null) : null,
  };
}
