# Kanji Garden

> Plant kanji. Watch them grow.

A gamified spaced-repetition kanji learning app covering all 13,108 KANJIDIC2 kanji. MERN stack, JavaScript only (ESM, `.jsx`), spec-driven — the full product specification lives in [`prompt.md`](./prompt.md), and the working blueprint with approved decisions lives in [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md).

**Live:** client <https://kanjiquest.vercel.app> · API <https://kanjiquest-api.onrender.com>

## Status

Build phases (see `prompt.md` §17). Every phase has a `version/X.Y.Z.md` note; `v0.1.0`–`v0.11.0` cover Phases 0–10.

- [x] Phase 0 — Foundation (git flow, docs, scaffold, design tokens, `/kitchen-sink`)
- [x] Phase 1 — Auth + shell
- [x] Phase 2 — Kanji data + seeded Atlas catalogue
- [x] Phase 3 — SRS review system
- [x] Phase 4 — Gamification core
- [x] Phase 5 — Daily quests + statistics
- [x] Phase 6 — Quiz modes
- [x] Phase 7 — Store, leaderboard, profile
- [x] Phase 8 — Onboarding, settings, polish
- [x] Phase 9 — PWA, accessibility, performance
- [x] Phase 10 — Deployment + release polish

Phase 9's manual NVDA/Narrator sign-off in [`A11Y.md`](./A11Y.md) is still
pending, so the `phase-9-complete` / `v0.10.0` tags are intentionally deferred.
See the deployment notes for the rest.

## Requirements

- Node.js ≥ 22 (Render pins `22.11.0`; development runs on 22 LTS)
- MongoDB — a connection string you provide (kickoff decision D1: **no Docker MongoDB**). Atlas works; so does a local `mongod`, or the no-Docker helper below.
- Internet on first `npm install` and first seed run

## Setup

```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env
# fill MONGODB_URI, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
```

No local MongoDB? Start the helper (uses `mongodb-memory-server` with an
on-disk data directory and prints a `MONGODB_URI`):

```bash
node server/src/scripts/local-mongod.js
```

Run the two workspaces in two terminals:

```bash
npm run dev -w server      # API on http://localhost:4000/api/v1/health
npm run dev -w client      # UI on http://localhost:5173 (proxies /api -> server)
```

## Seed data

The seed pipeline is a one-time (or idempotent re-run) step against your
database. Downloads are cached in `server/.data/` (gitignored), so reruns skip
already-downloaded files.

```bash
npm run download-data -w server      # KANJIDIC2, KanjiVG, jmdict-simplified, Tatoeba
npm run seed-radicals -w server      # 214 radicals + committed mnemonics
npm run seed-kanji -w server         # all 13,108 kanji (use --max-old-space-size if needed)
npm run seed-achievements -w server
npm run seed-quests -w server
```

The full pipeline takes **5–15 minutes** on a normal connection; the kanji
upsert dominates. `seed-kanji` prints a coverage report at the end:

```
coverage report (§5.7):
  total kanji:              …
  with stroke-order SVG:    …
  without SVG:              …
  with example words:       …
  with example sentences:   …
  with JLPT level:          …
  tagged Jōyō:              …
  tagged Jinmeiyō:          …
  done in … min
```

Partial coverage is expected, not a failure. The report is descriptive: the
upstream sources simply do not cover every character (KanjiVG has no SVG for
every one of the 13,108, and Tatoeba/JMdict have no example for rare kanji).
Phase 2's reference run produced **13,108 total / 6,417 SVG / 5,031 words /
2,910 sentences / 2,211 JLPT / 2,140 Jōyō / 863 Jinmeiyō / 214 radicals**.
Comprehensive means all 13,108 characters, gaps included.

Existing databases upgrading across a release may need one-off migrations:

```bash
npm run migrate-100 -w server   # latest; 050–100 exist for older snapshots
```

## Tests & quality

```bash
npm test        # server: vitest + supertest (mongodb-memory-server) then client: vitest + RTL
npm run lint    # ESLint (core rules)
npm run format  # Prettier
```

Pre-commit runs lint-staged (ESLint + Prettier); pre-push runs `npm test`.
Live smoke:

```bash
node deploy\smoke.mjs    # 84 checks against https://kanjiquest.vercel.app
```

`deploy/smoke.mjs` creates a throwaway account, exercises the API through the
Vercel proxy, checks cookies/headers/PWA assets/SPA fallbacks/licenses, then
deletes the user when it has local database access.

## Docker (optional local stack)

Docker is **not required** and is not part of the live deployment. The repo
ships a multi-stage `Dockerfile` (`api` and `client` targets) plus
`docker-compose.yml` for a local API + nginx client on <http://localhost:8080>.
There is deliberately **no MongoDB service** (D1) — compose reads
`MONGODB_URI` from `.env` (Atlas works; a host `mongod` needs
`host.docker.internal`). Compose runs the API with `NODE_ENV=development` so
plain-HTTP cookies are not `Secure`. Per D27 these files were statically
reviewed but could not be run-tested on the build machine.

```bash
copy .env.example .env   # fill MONGODB_URI + JWT secrets
docker compose up --build
```

## Deployment

- [`DEPLOY.md`](./DEPLOY.md) — Render (API) + Vercel (client) runbook, env vars, seeding, smoke.
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — topology, data flow, API surface, SRS/gamification, offline queue.

## Data sources & licenses

Attribution is required by all upstream licenses and shown in the app footer
and on the authenticated `/licenses` route:

| Source       | Used for                                              | License      |
| ------------ | ----------------------------------------------------- | ------------ |
| KANJIDIC2    | Kanji meanings, readings, radicals, grades, frequency | CC BY-SA 4.0 |
| KanjiVG      | Stroke-order SVG data                                 | CC BY-SA 3.0 |
| JMdict       | Example words and glosses (via jmdict-simplified)     | CC BY-SA 4.0 |
| Tatoeba      | Example sentences and translations                    | CC BY 2.0 FR |
| kanjiapi.dev | JLPT levels and official-list membership              | MIT          |

KanjiVG © Ulrich Apel and contributors, CC BY-SA 3.0. See `/licenses` in the
app for links to each project.

## Project layout

```
client/   React 19 + Vite SPA (design tokens in src/styles/tokens.css)
server/   Express API (/api/v1), Mongoose models, seed/migration scripts
shared/   constants + JSDoc typedefs used by both
deploy/   smoke test, Vercel client deploy script, nginx config
version/  per-release notes (0.1.0 … 0.11.0)
```

## Docs

- `prompt.md` — fixed product spec (source of truth)
- `IMPLEMENTATION_PLAN.md` — plan, approved decisions, phase acceptance criteria
- `DECISIONS.md` — architecture decision log
- `A11Y.md` — contrast audit, structural checks, owner screen-reader checklist
- `CONTRIBUTING.md` — branching, commits, phase protocol
- `CHANGELOG.md` — release history
