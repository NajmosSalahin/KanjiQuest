# Decisions

Architecture decision log. New entries require owner approval (`prompt.md` §3.8 / §0). Approved deviations from the spec are tracked as D-ids and mirrored in `IMPLEMENTATION_PLAN.md` §3.

## Kickoff decisions (Q&A, `prompt.md` §0.1)

| ID  | Decision                                                                                                                         | Rationale                                                                                                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | MongoDB via owner-provided `MONGODB_URI` in `.env`. **No Docker**, no MongoDB service in compose.                                | Owner decision. All DB tests use `mongodb-memory-server` instead of a shared instance.                                                                      |
| D2  | Google OAuth **removed entirely** (no button, no "Coming soon").                                                                 | Owner decision.                                                                                                                                             |
| D3  | Social achievements (`first-friend`, `sensei`) removed → **23 achievements**. Completionist threshold = 19 other achievements.   | Owner decision — defer social features.                                                                                                                     |
| D4  | Readings via Web Speech API (`ja-JP`), effects via Web Audio API. **`howler` not installed.**                                    | Owner decision — zero binary assets, zero licensing friction.                                                                                               |
| D5  | Stroke-order animation slowed: **1× = 600ms draw / 300ms stagger; 0.5× = 1200ms / 600ms; default = 0.5×** (spec: 400ms / 200ms). | Owner reviewed mockups: "the stroke order is fast," then asked to start at 0.5×. Easing, idle `--ink-muted`, vermillion current-stroke highlight unchanged. |

## CSRF approach (spec §14 requires documenting)

**Choice: `SameSite=Strict` cookies + custom-header requirement.** Access and refresh tokens live in `httpOnly; Secure; SameSite=Strict` cookies. All state-changing requests must send `X-Requested-With: XMLHttpRequest` (set automatically by the API client); browsers always include it on same-origin requests and never allow cross-origin sites to set custom headers without CORS approval. This blocks cross-site form/cookie replay without a second token to manage.

## Implementation notes (Phase 0)

### Server boots without a database (Phase 0 only)

`server.js` connects to MongoDB when `MONGODB_URI` is set, but logs a warning and continues if it's missing or unreachable. Phase 0 has no DB-backed routes; Phase 1 makes connect-or-fail mandatory (auth cannot work without a DB) and this escape hatch is removed.

**Phase 1: escape hatch removed.** `server.js` now exits(1) with a clear message when `MONGODB_URI` is unset or unreachable.

### Server secrets in development

`JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` may be empty outside production (dev/test fallbacks). Production requires both, ≥32 chars, plus `MONGODB_URI` — enforced by Zod in `config/env.js`. No `.env` is ever committed (pre-commit + `.gitignore`).

### ESLint scope

Phase 0 ships core ESLint (flat config) + `eslint-config-prettier` only — exactly what the spec's husky/lint-staged requirement needs. React-specific plugins (`eslint-plugin-react-hooks` etc.) are not in the approved library list; add them here (and ask the owner) before installing.

### Client DOM test environment

Not installed in Phase 0 (see "Open questions"). **Resolved in Phase 1** — see "Implementation notes (Phase 1 — Auth)".

### Mockup-only values (not product behavior)

- Quest/leaderboard figures shown in `mockups.html` are illustrative (within spec ranges).
- Milestone name mapping used in the mockup: **30 = "Sakura"** (label format from `prompt.md` §7.1: "10 days to Sakura."). Names for 14 / 60 / 100 are still unspecified — owner input needed in Phase 4.
- Sample radical mnemonics in the mockup stand in for `server/data/radical-mnemonics.json`.

## Implementation notes (Phase 1 — Auth)

### `jsdom` added for client DOM tests (owner-approved)

Asked explicitly at the Phase 0 review ("Client DOM test env — Testing Library needs jsdom (not on the approved list). Add it?"); the owner replied "go". `jsdom`, `@testing-library/react`, and `@testing-library/user-event` are test infrastructure only — never shipped in the client bundle. `@hookform/resolvers` was **not** added; a 20-line local `zodResolver` connects react-hook-form to our Zod schema instead.

### Register accepts an optional `timezone`

The §7.11 register screen specifies email/password/display name only, but the users model (§8) and streak logic (§6.8, Phase 4) need an IANA timezone. The client sends `Intl.DateTimeFormat().resolvedOptions().timeZone`; the server validates (≤64 chars) and defaults to `UTC`. Behavior latitude only — no screen copy changes.

### Refresh-token reuse detection (beyond spec minimum)

Rotating a refresh token revokes its `sessions` row (spec §14). If a **already-rotated** token is presented again, we treat it as theft and revoke **all** of that user's sessions (`REFRESH_REUSE_DETECTED`). Expired-but-unrevoked tokens only 401.

### Session rows are kept, not deleted

Rotation sets `revokedAt` (the §8 model has that field); rows are retained for forensics. No cleanup job exists — revisit in Phase 10 if the collection grows noisy.

### "Forgot password?" link has no flow (open question #4)

§7.11 mandates the link on `/login`, but §9 defines no password-reset endpoints and no reset screen exists. The link renders as specified and points to `/forgot-password` (no route yet). Owner decision needed on whether a reset flow is in scope.

### Nav targets for later phases are inert until built

Learn/Review/Quiz/Stats/Profile/Settings links exist in the chrome now (per §7); their screens arrive in Phases 2–8. Clicking them currently redirects to `/` via the catch-all.

## Implementation notes (Phase 2 — Kanji data & browse)

### System `tar` + `bzip2` for `.tar.bz2` (no new dependency)

The Tatoeba sentence files ship as `.tar.bz2`. Rather than adding a bz2 library (not on the approved list, §3.8), extraction uses the system toolchain. On macOS/Linux the system tar decompresses bzip2 in-process. **Windows is special:** its bsdtar ships _without_ a bzip2 filter and delegates to an external `bzip2` — and libarchive's external-program filter proved unreliable in practice (observed hang at spawn: 0 CPU, no output, depending on the parent process's stdio). The seed therefore owns the pipeline itself on win32: `bzip2 -dc <archive> | tar -xf - -C <dir>`, with `bzip2` located on PATH first and Git for Windows' bundled copy (`Program Files\Git\usr\bin\bzip2.exe`) as the standard fallback, and `tar` resolved to its absolute PATH location first (Git's `usr/bin` also ships a GNU tar that misparses `F:\…` paths as remote archives). No bz2/JS decompression dependency added; a missing bzip2 raises an instructive error.

### `sort` and `status` query params on `GET /kanji` (beyond §9's list)

§9 specifies `q, jlpt, strokeCount, radical, joyo, jinmeiyo, page, limit` only, but §7.3 requires a sort control (Frequency / Stroke count / JLPT) and a Status filter (All / Learning / Mastered) with no page reload. Both must be server-side filters on the same request contract, so `sort` and `status` were added. `status` is a no-op until Phase 3 joins user progress: `learning`/`mastered` return an empty page rather than fabricated data. Frequency/JLPT sorts order unknown values last (nulls-last sentinels) — nulls-first would surface rare kanji at the top of "Frequency".

### Furigana rendered server-side into structured tokens

Kuroshiro runs in the Node process (lazy singleton, kuromoji dictionary resolved via `createRequire`; sentence-token cache capped at 5,000). The API returns `exampleSentences[].tokens` as `[{ text, reading? }]` arrays — never HTML — so the client renders `<ruby>` via React elements with **no `dangerouslySetInnerHTML`** anywhere. Any kuroshiro failure degrades to a plain `[{ text }]` token; example sentences still render.

### Canonical Kangxi radicals derived at runtime

Radical numbers come from KANJIDIC2's classical numbering. Canonical characters are derived from Unicode's Kangxi block (U+2F00..U+2FD5, NFKC) instead of a hand-typed table, with a two-entry variant map (U+9751→青, U+79B8→禾) for decompositions that land on rare codepoints. `radical-mnemonics.json` covers all 214 (213 entries — 禾 serves two numbers).

### KanjiVG covers 6,417 of 13,108 kanji (real data property, not a bug)

The KanjiVG "all" zip contains 6,703 SVGs, all base-form JIS level 1–2 characters; ~6,417 of the 13,108 KANJIDIC2 kanji have stroke data. The rest seed with `hasStrokeOrder:false`, and §7.4's spec'd empty state ("Stroke-order data isn't available for this kanji.") covers them — the card keeps its header and controls, only the SVG is replaced. No fix needed.

### Word JLPT badges have no approved data source

JMdict-simplified carries no JLPT field for words. The `jlptLevel` field on example words stays `null` until an approved source exists; the badge renders conditionally and is simply absent today.

### `POST /progress/add` ships early (button lands Phase 3)

The §7.4 "Add to review" button is part of the Phase 2 detail screen and POSTs `/progress/add`, whose handler (and SRS engine) arrives in Phase 3. Until then the server answers 404/501-style errors honestly and the client surfaces the API message in a toast — no fake success state.

### `--text-kanji-xl` / `--text-kanji-2xl` added to tokens.css

Spec §3 defines `--text-kanji-xl: 6rem` and `--text-kanji-2xl: 10rem` (used by §7.4's detail kanji display); Phase 0's token file omitted them. Added verbatim from the spec — no values invented.

### List queries use `aggregate()`, not `Query.sort()`

Nulls-last frequency/JLPT ordering needs `$addFields` sentinel stages. Mongoose's `.sort()` rejects aggregation pipelines (it throws on array-of-stage objects), so the list and related-kanji queries run as pipelines with a `$project` that ships only the §7.3 list fields — `strokeOrderSvg` never leaves the server on list endpoints.

### Data files cached in `server/.data/` (gitignored)

Seeds are idempotent (§5.9) and re-runnable; downloads + kanjiapi responses (~2 GB total) must not enter git. `server/.data/` is ignored; `server/data/radical-mnemonics.json` (hand-authored content) is committed.

KANJIDIC2/KanjiVG/jmdict/Tatoeba downloads and kanjiapi.dev API responses cache under `server/.data/` so `npm run download-data` and the seed skip completed work on re-runs. The directory is gitignored — no large binaries in the repo. kanjiapi.dev is MIT-licensed (`onlyskin/kanjiapi.dev`).

### Test `launchTimeout` raised to 60s (local device)

A cold `mongod` on the owner's Windows device measures ~12s to reach "Waiting for connections" (FTDC init + AV overhead; verified: `_initAndListen total elapsed time: 12060 ms`), above mongodb-memory-server's 10s default — suites failed with "Instance failed to start within 10000ms" despite nothing being wrong. `tests/helpers/db.js` now passes `instance: { launchTimeout: 60000 }`. Test-infra only; production unaffected (cloud uses Atlas, no local mongod).

### Seed writes go through the native driver (mongoose `bulkWrite` silently no-ops)

Found during Atlas seeding (2026-10-22): mongoose `Model.bulkWrite()` returned `ok: 1, upserted: 0, modified: 0` for valid `replaceOne`-upsert batches — **silently dropping 525 of 13,108 kanji docs with no error and exit 0** (deterministic, reproducible; losses scattered across batches). The identical ops through the native driver (`Kanji.collection.bulkWrite`) wrote 100% (`upserted: 523` in one call, verified 13,108/13,108). `seed-kanji.js` and `seed-radicals.js` now use the native collection, and `seed-kanji` gained a verify/retry pass that reconciles the stored character set against KANJIDIC2 before printing the §5.7 coverage report — re-upserting anything missing and failing loudly if it can't reach a complete write, so the coverage numbers are verified facts, not assumptions.

**Root cause found (2026-10-27, caught by the live-site smoke test):** KANJIDIC2 repeats `<stroke_count>` when a kanji has variant stroke counts (逢 → `10, 9, 11`; 525 of 13,108 entries — exactly the 525 that mongoose dropped). The parser did `Number(misc.stroke_count)` on the resulting **array** → `Number("10,9,11")` → **NaN**. Mongoose evidently couldn't cast the poisoned replacement (the silent no-op); the native driver wrote those same docs but _as NaN_. Symptoms in production: `strokeCount` serialized to JSON as `null`, and `?sort=strokes` ascending surfaced all 525 first (MongoDB sorts NaN below every number) — the browse page's first "ascending stroke count" results were `㕝, 㕞, 㤚…` with null counts. Fixes: `parse-kanjidic.js` now takes the **first** repeated value via a `toNumber()` helper (first value = Jōyō standard: 違→13, 遺→15 — verified against real data), `seed-kanji.js` dropped the `?? 0` silent-zero and the verify pass now **asserts every stored `strokeCount` is a positive integer** (fails loudly on double/null/≤0 before printing coverage), a regression test covers the repeated-tag shape, and the 525 Atlas docs were repaired in place (525 matched → 525 modified → 0 mismatches, 0 doubles remaining). The `525` counts in this entry, the double-typed docs, and the array-valued entries all matched exactly.

## Implementation notes (Phase 3 — SRS review system)

### D8: `DELETE /progress/:character` + `myProgress` on kanji detail (owner-approved 2026-10-28)

§7.4 mandates a "Remove from review" button and an SRS state line ("Learning · next review tomorrow") on the detail page, but §9 defines no endpoint to read or remove a tracked card. Owner approved D8 in the Phase 3 plan review: `GET /kanji/:character` gains a `myProgress` field (full card projection, `null` when untracked or anonymous), and `DELETE /progress/:character` removes the pair — 204, or 404 `PROGRESS_NOT_FOUND` on repeat. Mirrored as D8 in `IMPLEMENTATION_PLAN.md` §3.

### History entries store a full previous-state snapshot + XP (superset of §6.5's four fields)

Undo must be a "compensating transaction" (§6.5) that restores the card's exact prior state. Each `/progress/review` history entry therefore stores the **entire previous card state** (state, easeFactor, interval, repetitions, lapses, dueDate, suspendedUntil, lastReviewedAt) plus `xpAwarded` — the snapshot is what makes exact restoration and exact XP refund possible. History is capped at the last 100 entries per card (older entries are dropped on write).

### Server undo window 10s; client enforces the spec'd 4s (§9's "(4s window)" is the UX)

§9 labels the undo endpoint "(4s window)". The **client** enforces the spec'd 4-second UX (the banner auto-dissolves after 4s; any other key discards it, and the client never sends an undo after that). The **server** allows `UNDO_WINDOW_MS` = 10s so a click at ~3.9s whose request arrives at ~4.5s over the Render proxy still succeeds (`UNDO_WINDOW_CLOSED` past that). The extra window is latency headroom only; past 10s the server rejects exactly as specified.

### Undo refunds XP exactly; streaks never revert

`xpAwarded` is refunded from the history snapshot (`refundReviewXP`): totalXP / level / dailyXP return to their pre-review values exactly. Streaks are **monotonic** — `currentStreak` and `longestStreak` are never decremented by undo (the day's activity happened; the review can be un-done, the day cannot).

### Thin gamification in Phase 3; `awardXP` formalized in Phase 4

Review awards: Again +2 / Hard +5 / Good +10 / Easy +15, first-review-of-the-day +20 (`lastReviewDate` marker on the profile), daily-goal crossing +30 once a day (the crossing rule enforces once/day by construction), store boost 1.5× applied at award time, streak bump. This lives in `server/src/services/xp.js` so the review loop is playable end-to-end now; Phase 4 replaces/extends it with the full `awardXP` + streak/milestone services per §11 without changing the response shapes introduced here. XP is always **server-authoritative** (client renders what the response says, never computes).

### §10 ease deltas are the per-state "modified" values

Both halves of §10 are implemented: the standard SM-2 paragraph provides the interval-growth formula, and the spec's per-rating deltas (Again −0.20, Hard −0.15, Good 0, Easy +0.15) are the **modified** EF, clamped to [1.3, 3.0] everywhere. Review success paths increment reps; learning/relearning graduation sets reps to 1. Interval units: **minutes** in learning/relearning, **days** in review (a review-lapse halves the interval in days before the Again re-learn).

### D6 `status` becomes real: `learning` = tracked-not-mastered, `mastered` = review + interval ≥ 180d

`learning` = any tracked pair that is **not** mastered — includes `new`, suspended, and lapsed cards. `mastered` = `state === 'review' && interval >= MASTERED_INTERVAL_DAYS (180)`. Anonymous callers always get an empty page for both filters (never fabricated data).

### `optionalAuth`: invalid tokens degrade to anonymous, not 500/401

`GET /kanji/:character` (now with `myProgress`) and `GET /kanji?status=…` serve signed-in and anonymous callers alike, so the auth middleware gained `optionalAuth`: a valid token enriches the response; a missing/**invalid/expired** token degrades to anonymous instead of failing (a browser holding a stale cookie still gets public data instead of an error page).

### `GET /progress/due` returns `nextDueAt` when the queue is empty

§7.2's empty state needs "Next review is scheduled for 14:30 today" — the earliest **unsuspended future** due date. `/due` adds `nextDueAt` (ISO, or `null` when nothing is tracked) whenever the queue comes back empty. Additive response field; §9 doesn't dictate response shapes.

### `/review` chrome: full-screen outside AppShell, mobile keeps only the bottom bar (§7.2 reading)

The route sits **outside** `AppShell` (own `RequireAuth` gate): a minimal fixed top bar — back arrow · card counter · `?` shortcuts — replaces the global header at every breakpoint, and per §7.2's "Nav hidden on mobile (only bottom bar)" the mobile bottom tab bar (extracted from AppShell as a shared `MobileTabBar`) stays visible; desktop shows no other chrome. Skip (`S`) and suspend (`X`) are keyboard-only because §7.2 specifies no touch controls for them — mobile gets reveal + the 2×2 rating grid. The undo banner is the page's own bottom-left element (the shared Toast component stays top-anchored, §7 chrome).

### Rating success paths + daily cap

`GET /progress/due` caps at `preferences.dailyReviewLimit` (default 20), sorted due-first; rating a card recomputes `dueDate` from the SRS state machine and awards XP in the same transaction as the state write (history + profile + XP all land or none do).

## Implementation notes (Phase 4 — Gamification core)

### D10: `POST /gamification/streak/repair` added (owner-approved 2026-10-28)

§11.4's repair banner needs an action, but §9's endpoint table defines no repair route. Owner approved D10 in the Phase 4 plan review: `POST /gamification/streak/repair` charges `STORE.STREAK_REPAIR_COST` (100 coins), is allowed only when **exactly the previous local calendar day** went unreviewed (the spec's "broken within the last 24h" — the "ended yesterday" banner case), and is capped at **once per calendar month** (`lastStreakRepairAt`, compared in the user's timezone). 409s otherwise: `STREAK_NOT_REPAIRABLE` / `INSUFFICIENT_COINS` / `REPAIR_ALREADY_USED`. The effect makes the missed day count as shown-up (`lastActivityDate = yesterday`), so the next review chains normally — 12 → 13 — instead of resetting. Mirrored as D10 in `IMPLEMENTATION_PLAN.md` §3.

### D11: 41 achievements, all Japanese-named, Completionist = 32 (owner-approved 2026-10-28)

Amends D3 (23 → 41). The owner confirmed the full roster: every achievement is named in **romaji + 漢字/かな** (e.g. `Jūren 十連`, `Kokoro 心`; spec-style `N5 Kansei N5・完成` kept), and **Zenshū 全集** (Completionist) unlocks at **32 of the other 40** — the original ~80% ratio D3's 19-of-23 expressed. The 18 defs beyond the spec's 23 (review-volume, perfect-run, time-of-day, level, goal-streak, and the dormant quiz/quest/freeze ones) have **no spec rewards** — their XP/coins are the ones approved in the Phase 4 conversation and are listed in `version/0.5.0.md`; spec'd rewards are untouched. The full 41-id list lives in `server/src/services/achievements.js` (`ACHIEVEMENT_DEFS`), seeded to the `achievements` collection (§8 structured criteria).

### Milestone names (open question #2 resolved, Phase 4)

The §7.1 bar's next-milestone labels are **Wakaba 14 · Sakura 30 · Hanami 60 · Momiji 100** ("10 days to Sakura" at streak 20). The 7/30/100 **celebration achievements** keep their own names — **Kokoro / Tsuki / Kaze** — so a streak of 30 reads "Sakura" on the bar and unlocks "Tsuki" at the milestone; they are different signs of the same progress, not renames.

### "Learn N kanji" counts first-reviewed kanji; unlocks are permanent

`LEARNED` criteria count pairs with `lastReviewedAt != null` — the first review of a card marks the kanji learned (so D8's "Remove from review" never regresses an unlocked achievement, and the count survives history eviction since `lastReviewedAt` is kept on undo). Achievement unlocks are **never re-locked** by anything — including undo (which restores XP/level/counters but not unlocks).

### Unlock feedback: celebration modal only for level-up + streak milestones

Per the owner's Phase 4 decisions: the **level-up modal** (§11.2) and **streak-milestone celebrations** at 7/30/100 (§11.4) are the only modals; every other unlock fires a **compact toast** with name (romaji + 漢字/かな) + rewards. The milestone modal _folds in_ its own achievement's toast (Kokoro/Tsuki/Kaze aren't double-announced). In `/review` the modal is deferred to the session-summary screen so the card rhythm (§7.2) is never interrupted mid-card; the dashboard fires toasts immediately after its repair action.

### `dailyGoalXP`: default 50 + option 20 added (§11.6 correction, not a deviation)

§11.6 fixes the daily goal's default at **50 XP** with options **20/50/100/200**. Phase 1 shipped `default: 100` and an enum `[50, 100, 200]` (20 missing) in `User.preferences` and `GamificationProfile`. No settings UI ever existed to customize the goal, so `scripts/migrate-050.js` flips every stored `100 → 50` blanket-safe (owner-confirmed), both schemas now derive from shared `DAILY_GOAL_OPTIONS` / `DEFAULT_DAILY_GOAL_XP`, and `PATCH /users/me/preferences` mirrors goal changes onto the profile (reviews read the mirror).

### Achievement XP counts toward the level — never toward the goal or the streak

Achievement rewards flow through the same **1.5× boost at award time** ("all XP", §11.1) and into `totalXP`, then the level is recomputed once — so an unlock can trigger the level-up modal. They deliberately **do not** feed `dailyXPProgress` (the goal is review XP per §11.1's award list) nor the streak (review-driven per §11.4). Coins land on the profile immediately.

### Gamification counters ride on the profile (additive §8 fields)

One review appends history; it also updates cheap profile counters that make most criteria O(1): `totalReviews`, `goalStreak` + `goalMetDate` (consecutive goal days), `currentPerfectRun`, `dailyReviewsCount` + `dailyAgainToday` + `dailyCountersDate` (reset per local day), `reviewsBefore8` / `reviewsAfter23` (local hour at award), `streakFreezes` (store grants these in Phase 7 — the consumption rule exists and is unit-tested now), `lastStreakRepairAt`, and `achievementUnlocks` (id → unlock Date for §6.10's profile tab; `unlockedAchievementIds` stays the §8-canonical list). The heavy signals (learned / mastered / per-JLPT mastery / 30-day accuracy) are computed by one `$facet` aggregation **only when a locked achievement actually needs them**.

### Undo restores the Phase 4 counters exactly (`gami` snapshot)

Following the Phase 3 full-state-snapshot pattern, each history entry now also stores `gami` (the counters listed above, taken before the award), so `refundReviewXP` restores totalReviews/perfect-run/goal-streak/time-of-day counters exactly alongside XP/level/dailyXP. Streaks still never revert; unlocks stay unlocked.

### Quiz/quest/freeze criteria ship dormant

The criteria vocabulary includes `QUIZ_ACCURACY`, `SPRINT`, `STROKE_PERFECT`, `DRAWING_SCORE`, `QUEST_SWEEP`, `QUIZ_MODES_ALL`, `FREEZE_USED` (Phases 5–7 producers). The evaluator skips them and the achievements endpoint returns `progress: null` for them (§6.10 "Locked" without a progress bar) — they unlock when their systems land, no data migration needed.

### Dashboard dot grid: Monday-anchored labels over the server's rolling 7 days

`GET /gamification/profile` returns the **rolling last 7 local days** (aggregated from `history[].reviewedAt` in the user's timezone — the same source the Phase 5 heatmap uses); the client lays the slots out **Monday → Sunday with M T W T F S S letters** (§7.1's fixed week order) by matching its own week keys against that map. The due card reuses `/progress/due` (`total` + `nextDueAt`, `limit=1`); the empty state deep-links to `/learn?jlpt=5`, which Learn now reads from the URL.

## Implementation notes (deployment — owner-directed early hosting)

### Live preview after every phase (2026-10-22, owner request)

The owner asked to host the site online from Phase 2 onward, watching it grow phase by phase, rather than waiting for Phase 10. This uses the **exact Phase 10 stack early** (Render free-tier API + Vercel free-tier client + Atlas), so Phase 10's `DEPLOY.md`/`ARCHITECTURE.md`/final-hardening obligations are unchanged — they document and finish what's already running. Zero cost.

**Architecture — why a Vercel rewrite proxy:** spec §14 mandates `SameSite=Strict` httpOnly cookies, which browsers never send across _different_ sites. A Vercel-hosted client calling a Render-hosted API directly would therefore be logged out on every request. Fix without touching the security model: Vercel rewrites `/api/*` (and `/health`) to the Render URL, so the browser only ever talks to one origin — cookies stay `SameSite=Strict`, the client's relative `/api/v1` base (`client/src/lib/api.js`) needs no changes, and CSRF double-submit logic is untouched. `deploy/vercel.json.tpl` holds the rewrite template (API URL injected at deploy time); `deploy/deploy-client.ps1` builds the client and deploys `client/dist` per phase.

**Vercel Git integration — disconnected; client deploys are CLI-only (2026-10-27):** connecting the repo during project setup armed Git auto-deploy, and a push to `main` produced a production build _without_ the generated `dist/vercel.json` (the rewrite proxy exists only in the built output, injected by `deploy-client.ps1`). That rewrite-less deployment took over `kanjiquest.vercel.app` and every proxied `/api/*` call 404'd while the Render API stayed healthy — caught by the post-push verification; the aliased deployment's creation time matched the push to the second (forensics: `git-main` alias, 4 s build). Fixed with `vercel git disconnect` + a CLI redeploy, verified by the full 17-check live smoke. The integration must stay off: the repo isn't structured for Vercel Git builds (`client/dist` is gitignored, `vercel.json` is generated per deploy). **Consequence for Phase 10: pushing to `main` deploys the Render API only — the client ships per phase via `deploy-client.ps1 -ApiUrl …`.**

**Render service:** declared via `render.yaml` blueprint (repo root): free web service, `npm install` at repo root (workspaces — `server` depends on `@kanjigarden/shared`), `npm run start -w server`, health check `/api/v1/health`, Node 22. Secrets (`MONGODB_URI`, JWT secrets, `CLIENT_ORIGIN`) are `sync: false` — set in the dashboard/via API, never committed.

**Known free-tier limits (acceptable for previews):** Render free services spin down after ~15 min idle (first request after idle takes ~30–50 s); the ephemeral disk wipes on redeploys (irrelevant until avatar uploads in a later phase); Atlas Network Access must allow Render egress (`0.0.0.0/0` — the owner was advised to rotate the Atlas password given the open allowlist).

## Open questions (ask before implementing)

1. ~~**`jsdom` / `happy-dom`**~~ — resolved Phase 1: `jsdom` added with owner approval.
2. ~~**Milestone names**~~ — resolved Phase 4: bar labels are **Wakaba 14 · Sakura 30 · Hanami 60 · Momiji 100**; the 7/30/100 achievements keep **Kokoro/Tsuki/Kaze**.
3. **Quest titles** — §6.7 lists 12 phrases (e.g. "Review 10 cards"); are they the titles themselves, or do you want separate title + description copy?
4. **Password reset** — §7.11 shows a "Forgot password?" link but §9 has no reset endpoints. In scope (Phase 8 polish?) or drop the link?
