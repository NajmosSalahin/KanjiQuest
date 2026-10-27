# Changelog

All notable versions of Kanji Garden. Detailed per-version notes live in [`version/`](version/).

Format loosely follows [Keep a Changelog](https://keepachangelog.com/); versions bump a minor per project phase.

## [Unreleased]

- **Live hosting (owner-directed early delivery):** Render free-tier API (`kanjiquest-api.onrender.com`) + Vercel client (`kanjiquest.vercel.app`) on the Phase 10 stack — `render.yaml` blueprint, `deploy/deploy-client.ps1` per-phase flow, and a Vercel `/api/*` rewrite proxy so §14 `SameSite=Strict` cookies stay same-origin (zero client/server code changes).
- Deploy hardening: root `prepare` tolerates missing husky when Render builds with `NODE_ENV=production`; security headers (nosniff, frame-deny, strict referrer) on Vercel static responses — full CSP remains Phase 10 work.
- **Bug #3 root cause closed:** KANJIDIC2 repeats `<stroke_count>` for 525 kanji, and `Number(["10","9"])` was NaN — the cause of both the silent mongoose `bulkWrite` drop _and_ poisoned prod data (`strokeCount` serialized as JSON `null`, sorted first under `?sort=strokes`). Parser takes the first repeated value, the seed verify pass now asserts positive-integer stroke counts, and the 525 Atlas docs were repaired in place. Caught by the live-site smoke test; details in [DECISIONS.md](DECISIONS.md).

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
