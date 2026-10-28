# Changelog

All notable versions of Kanji Garden. Detailed per-version notes live in [`version/`](version/).

Format loosely follows [Keep a Changelog](https://keepachangelog.com/); versions bump a minor per project phase.

## [Unreleased]

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
