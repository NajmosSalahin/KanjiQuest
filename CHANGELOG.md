# Changelog

All notable versions of Kanji Garden. Detailed per-version notes live in [`version/`](version/).

Format loosely follows [Keep a Changelog](https://keepachangelog.com/); versions bump a minor per project phase.

## [Unreleased]

## [0.6.0] — 2026-10-31 — Daily quests + statistics (Phase 5) · tag `phase-5-complete`

- **Daily quests (§6.7 / D12):** all 12 defs seeded, three deterministic per user + local day, persisted across the day and reset at local midnight. Phase 5 selects the 8 review-completable defs; the 4 quiz defs ship `phase: 6`. Progress tracks review counts, 5-in-a-row, first-learns, daily XP, due-clear, and before-10am/after-8pm; per-quest rewards (20–50 XP + 5–15 coins) and the **+30 daily sweep** claim exactly once. Quest/sweep XP counts toward `totalXP`/level but not the daily goal or streak.
- **Undo (§6.5):** review history stores a `questUndo` snapshot; undo restores quest progress/completion/reward-claim/sweep and refunds direct quest/sweep XP + coins. Achievement unlocks stay permanent.
- **Statistics (§7.7 / §9):** local-day **365-day heatmap**, **next-30-day forecast** (overdue folded into today), **30-day accuracy**, **N5–N3 stacked JLPT statuses** (untracked = new), and **365-day best/worst with ≥10 reviews**; `/stats` aggregate plus validated `/heatmap`, `/forecast`, `/accuracy`, `/jlpt`, `/best-worst` endpoints.
- **Dashboard (§7.1):** the Daily quests section — countdown, custom icons, progress bars, rewards, completed/sweep states, skeletons, error/retry — replaces the placeholder duplicate.
- **`/stats` screen:** all five spec sections inside the app shell, with token-only colors, 30-day accuracy average, skeletons, and error state.
- **Feedback & data:** `/review` quest-completion and sweep toasts + query invalidation; `QuestDef`/`UserQuest` collections with indexes, `seed-quests` and `migrate-060` scripts.
- **Tests:** server **156** (+9 — new quests ×6 + stats ×3), client **56** (+6 — Stats ×4 + Dashboard quests ×2), live smoke **43 checks** (+6). Details: [version/0.6.0.md](version/0.6.0.md)

## [0.5.0] — 2026-10-28 — Gamification core (Phase 4) · tag `phase-4-complete`

- **`awardXP` formalized (§11.1):** `server/src/services/xp.js` becomes the single XP event router — review XP with the 1.5× boost applied to **all** XP, level recompute (`computeLevel`), achievement evaluation in the same pass, and a returned snapshot (`newlyUnlocked`, `streakMilestone`, `leveledUp`, prior level/title, profile counters) that `refundReviewXP` restores exactly on undo (unlocks themselves are permanent).
- **Streak engine (§11.4):** `services/streak.js` + `services/time.js` — timezone-correct increment/reset, break-corrected display streak, milestone crossing (7/30/100), freeze consumption rule (one freeze per missed day, only consumed when `streakFreezes >= missedDays`; store grants arrive Phase 7), and the approved **D10** `POST /gamification/streak/repair` (100 coins, previous-local-day breaks only, once per calendar month).
- **Achievements (§6.6 / §11.3):** the approved **D11 roster of 41** — the spec's 23 (social pair removed per Q4/D3) with Japanese names + **18 owner-approved additions**, all romaji + 漢字/かな — in `services/achievements.js` with `seed-achievements.js`; cheap criteria read profile counters, heavy signals (learned/mastered/JLPT/30-day accuracy) come from one `$facet` aggregate run only when a locked def needs them; quiz/quest/freeze criteria ship dormant (`progress: null`); Zenshū unlocks in the same pass at 32 of the other 40.
- **Gamification endpoints (§9):** `GET /gamification/profile` (break-corrected streak, rolling 7-day grid in the user's timezone, next milestone, repair state, level/title/coins/achievements totals), `GET /gamification/achievements` (self-seeding, per-item `unlocked`/`unlockedAt`/`progress`), `POST /gamification/streak/repair`.
- **Dashboard (§7.1 minus quests + mini-leaderboard):** header with level/XP/streak, exact-copy repair banner (dismissable), streak card (5-tier `StreakLeaf`, Monday-anchored `M T W T F S S` dot grid over the server's rolling 7 days, milestone bar **Wakaba 14 · Sakura 30 · Hanami 60 · Momiji 100**), daily-goal `GoalRing` + "Goal met" state, due card ("Start review" / "All caught up — next review at HH:MM"), empty state deep-linking to `/learn?jlpt=5` (Learn now honors `?jlpt=`).
- **Celebrations (§11.2 / §11.4):** `CelebrationModal` (Radix + framer-motion, approved §3.8, custom garden-stage SVG) for level-ups and streak milestones 7/30/100 — **deferred to the review summary screen** so the card rhythm is never interrupted; every other unlock fires a compact toast with name + rewards (41 hand-drawn two-color `AchievementIcon`s; milestone toasts fold into the modal).
- **§11.6 correction (not a deviation):** `dailyGoalXP` default **50** with options **20/50/100/200** (Phase 1 had shipped default 100 / enum `[50,100,200]`); both schemas now derive from shared `DAILY_GOAL_OPTIONS`, `scripts/migrate-050.js` flips stored 100→50, and `PATCH /users/me/preferences` mirrors goal changes onto the profile.
- **Data model:** new `Achievement` collection (§8 structured criteria); `GamificationProfile` gains `streakFreezes`, `goalStreak`/`goalMetDate`, `currentPerfectRun`, `dailyReviewsCount`/`dailyAgainToday`, `reviewsBefore8`/`reviewsAfter23`, `lastStreakRepairAt`, `dailyCountersDate`, `achievementUnlocks` (id → date); `UserProgress.history[]` stores a `gami` snapshot so undo restores counters exactly.
- **Tests:** server **147** (+43 — new `streak`, `achievements`, `gamification` suites; XP/undo assertions updated for achievement XP), client **50** (+15 — Dashboard ×8, CelebrationModal ×4, AchievementIcon ×2, Learn `?jlpt` deep-link ×1), live smoke **37 checks** (+6 — goal-default-50, profile grid, achievements list + first-review unlock, D10 negative path, anonymous guard; undo/re-review totals now account for persisted achievement XP).

## [0.4.0] — 2026-10-28 — SRS review system (Phase 3) · tag `phase-3-complete`

- **SRS engine (§10):** pure `server/src/services/srs.js` — SM-2 with the spec's per-state ease deltas (Again −0.20 / Hard −0.15 / Good 0 / Easy +0.15 as the modified EF), EF clamp [1.3, 3.0], minute intervals in learning/relearning, day intervals in review, lapse halving, graduation → `review`, mastery at interval ≥ 180d. **32 unit tests.**
- **Review API (§9 + approved D8/D9):** `POST /progress/add`, `GET /progress/due` (daily-review cap, `nextDueAt` for the empty state), `POST /progress/review` (server-authoritative XP + full-state snapshot history, capped 100/card), `POST /review/:cardId/undo` (client enforces the spec'd 4s UX, server 10s latency backstop — exact XP refund, streaks never revert), `POST /review/:cardId/suspend` (7 days), `GET /progress/stats`, `DELETE /progress/:character` (**D8** "Remove from review"). Kanji detail gains `myProgress`; D6 `status=learning|mastered` is now real (180d threshold); `optionalAuth` enriches public endpoints without failing on stale tokens.
- **Thin gamification (§11 subset, formalized in Phase 4):** review XP +2/+5/+10/+15, first-review-of-day +20, daily-goal crossing +30, 1.5× store boost applied at award, streak bump — all server-side.
- **`/review` screen (§7.2):** full-screen session outside the AppShell (minimal top bar: back · card counter · `?` shortcuts; mobile keeps only the bottom tab bar) — 4px progress bar, card front (6rem kanji + furigana ruby, Show answer), card back (4rem kanji, meanings · joined, On/Kun ruby with speech, example word, mnemonic), 2×2/row rating buttons with 1–4 shortcuts and 220ms fill, keyboard Space/1–4/U/S/X, 4-second bottom-left undo banner, suspend, session summary (garden SVG, accuracy / +XP / streak, "Daily goal met", Continue + Review again), and the "Nothing due" empty state with the scheduled next-review time. Detail page: Add to review → SRS state line + Remove (D8).
- **Tests & quality:** **104 server + 35 client = 139 green**, lint 0; live smoke extended to **31 checks** covering the full review flow (add → due → review+XP → undo → re-review → suspend → stats → D6 → D8 → anonymous invariants) against production.
- **Carried from Unreleased:** live hosting on the Phase 10 stack (Render API + Vercel client + Atlas, `/api/*` rewrite keeps §14 `SameSite=Strict` cookies same-origin), deploy hardening (husky-tolerant prepare, Vercel security headers), and the **bug #3 root cause closure** (KANJIDIC2 repeated `<stroke_count>` → NaN; parser + seed verify fixed, 525 Atlas docs repaired — caught by the live smoke).
- Details: [version/0.4.0.md](version/0.4.0.md)

## [0.3.0] — 2026-10-22 — Kanji data & browse (Phase 2) · tag `phase-2-complete`

- Five-source seed pipeline: 13,108 kanji, 214 radicals, 6,417 stroke-order SVGs, 5,031 words, 2,910 sentences, 2,211 JLPT (§5.7 coverage report).
- `GET /kanji` (§9 filters + approved D6 `sort`/`status`), `GET /kanji/:character` detail, `/learn` browse (virtualized grid, radical/JLPT/stroke filters, debounced search), kanji detail with stroke-order player (0.5× default), speech readings, `/licenses`.
- 75 tests green (51 server + 24 client), lint 0, E2E 15/15 with zero console errors.
- Details: [version/0.3.0.md](version/0.3.0.md)

## [0.2.0] — 2026-10-21 — Auth (Phase 1) · tag `phase-1-complete`

- Full auth per spec §14: bcrypt 12, 15-min access JWT (httpOnly/Secure/SameSite=Strict), 7-day rotated hashed refresh tokens with reuse detection, CSRF, rate limits, Zod validation everywhere.
- Client: silent single-flight token refresh, auth store, app shell, route guards, Login/Register screens (no Google per D2); jsdom client tests; pre-commit secret rejection.
- 30 tests green, lint 0.
- Details: [version/0.2.0.md](version/0.2.0.md)

## [0.1.0] — 2026-10-21 — Foundation (Phase 0) · tag `phase-0-complete`

- Monorepo (npm workspaces, ESLint/Prettier/Husky), shared constants + typedefs, Express ESM server with health route and error envelope, Vite React client with design tokens and UI primitives, base docs (README, CONTRIBUTING, DECISIONS D1–D5).
- Details: [version/0.1.0.md](version/0.1.0.md)
