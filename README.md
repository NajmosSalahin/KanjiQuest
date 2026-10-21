# Kanji Garden

> Plant kanji. Watch them grow.

A gamified spaced-repetition kanji learning app covering all 13,108 KANJIDIC2 kanji. MERN stack, JavaScript only (ESM, `.jsx`), spec-driven — the full product specification lives in [`prompt.md`](./prompt.md), and the working blueprint with approved decisions lives in [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md).

## Status

Build phases (see `prompt.md` §17):

- [x] Phase 0 — Foundation (git flow, docs, scaffold, design tokens, `/kitchen-sink`)
- [ ] Phases 1–10 — Auth, kanji data, SRS, gamification, quests/stats, quizzes, store/leaderboard/profile, onboarding/polish, PWA/a11y/perf, deployment

## Requirements

- Node.js ≥ 20 LTS
- MongoDB — a connection string you provide (kickoff decision D1: **no Docker**)
- Internet on first `npm install` and first seed run

## Setup

```bash
npm install
cp .env.example .env      # then fill MONGODB_URI, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
```

Run the two workspaces in two terminals:

```bash
npm run dev -w server      # API on http://localhost:4000/api/v1/health
npm run dev -w client      # UI on http://localhost:5173 (proxies /api -> server)
```

## Tests & lint

```bash
npm test        # server: vitest + supertest (mongodb-memory-server for DB tests)
npm run lint    # eslint
npm run format  # prettier
```

Git hooks (husky): pre-commit runs lint-staged (ESLint + Prettier on staged files); pre-push runs `npm test`.

## Seed data

Phase 2 will add `server/scripts/download-data.js` + `seed-kanji.js`:

- Downloads KANJIDIC2, KanjiVG, jmdict-simplified, and Tatoeba exports into `.data/` (cached; reruns are idempotent)
- Full pipeline takes **5–15 minutes** on a normal connection
- Prints a coverage report (total kanji, with stroke SVGs, words, sentences, JLPT levels, Jōyō/Jinmeiyō)

## Data sources & licenses

KANJIDIC2 (CC BY-SA 4.0), KanjiVG (CC BY-SA 3.0), JMdict (CC BY-SA 4.0), Tatoeba (CC BY 2.0 FR). A full `/licenses` route ships in Phase 10 — attribution is required by these licenses.

## Project layout

```
client/   React 19 + Vite SPA (design tokens in src/styles/tokens.css)
server/   Express API (/api/v1), Mongoose models, seed scripts
shared/   constants + JSDoc typedefs used by both
.data/    seed downloads (gitignored)
```

## Docs

- `prompt.md` — fixed product spec (source of truth)
- `IMPLEMENTATION_PLAN.md` — plan, decisions D1–D5, phase acceptance criteria
- `DECISIONS.md` — architecture decision log
- `CONTRIBUTING.md` — branching, commits, phase protocol
