# Changelog

All notable versions of Kanji Garden. Detailed per-version notes live in [`version/`](version/).

Format loosely follows [Keep a Changelog](https://keepachangelog.com/); versions bump a minor per project phase.

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
