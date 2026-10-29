# Kanji Garden — Implementation Plan

> Derived from `prompt.md` (the fixed product spec) and the confirmed decisions from the kickoff Q&A (§2 of this document). This document is the working blueprint for all 11 build phases (0–10). Where this plan and `prompt.md` conflict, **`prompt.md` wins** except where a deviation has been explicitly approved and is listed in §3.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Confirmed Decisions (Kickoff Q&A)](#2-confirmed-decisions-kickoff-qa)
3. [Approved Deviations from Spec](#3-approved-deviations-from-spec)
4. [Tech Stack & Approved Libraries](#4-tech-stack--approved-libraries)
5. [Repository Structure (Full File Tree)](#5-repository-structure-full-file-tree)
6. [Design System Quick Reference](#6-design-system-quick-reference)
7. [Data Model](#7-data-model)
8. [API Surface](#8-api-surface)
9. [SRS Algorithm (SM-2 Modified)](#9-srs-algorithm-sm-2-modified)
10. [Gamification Rules](#10-gamification-rules)
11. [Data Pipeline (Seed)](#11-data-pipeline-seed)
12. [Screen Inventory](#12-screen-inventory)
13. [Build Phases 0–10 — Detailed Tasks & Acceptance Criteria](#13-build-phases-010--detailed-tasks--acceptance-criteria)
14. [Testing Strategy](#14-testing-strategy)
15. [Security Checklist](#15-security-checklist)
16. [Performance Budgets](#16-performance-budgets)
17. [Accessibility Requirements](#17-accessibility-requirements)
18. [Version Control Workflow](#18-version-control-workflow)
19. [Phase-End Review Protocol](#19-phase-end-review-protocol)
20. [Risk Register & Mitigations](#20-risk-register--mitigations)
21. [Glossary](#21-glossary)

---

## 1. Project Overview

- **Name:** Kanji Garden
- **Tagline:** "Plant kanji. Watch them grow."
- **Positioning:** Anki-grade SRS without Anki-grade friction; Duolingo-grade motivation without Duolingo-grade filler.
- **Scope:** A comprehensive spaced-repetition kanji learning web app covering **all 13,108 KANJIDIC2 kanji** — not a curated JLPT course. JLPT levels are filters on top of the full dataset.
- **Stack:** MERN — MongoDB, Express, React 19, Node.js. **JavaScript only** (no TypeScript, no `.ts`/`.tsx`, no `tsconfig.json`). ESM `"type": "module"` everywhere. React components in `.jsx`.
- **Hard constraints:** Zero creative latitude on design, copy, UX, and visual identity (§6 below and `prompt.md` §2–§4). Anti-slop rules are hard constraints, not suggestions.

### Non-negotiable anti-slop rules (from `prompt.md` §2)

1. No purple/pink/violet gradients.
2. No glassmorphism.
3. No emoji in UI — SVG icons only (Lucide or custom). Emoji allowed only inside user-generated content.
4. No stock/AI illustrations — inline minimal-line SVGs, max 2 colors, 1.5px stroke.
5. No shadows with opacity > 0.12, no glow.
6. Radii: buttons/inputs 6px, cards 8px, modals 12px; pills (9999px) only for tags/avatars.
7. No centered hero text in app screens (except celebration screens).
8. No generic copy — every string is specified (banned: "Welcome back!", "Great job!", "Oops!", "Loading...", etc.).
9. Every empty state: specific SVG + headline naming the missing thing + one-line explanation + specific CTA.
10. No `alert()`, `confirm()`, `prompt()` — toasts and modals only.
11. No `lorem ipsum` or placeholder content.
12. No `Loading...` text — skeletons/progress indicators only.
13. Top of every screen is a functional header, never a rounded-rectangle hero banner.
14. No shadcn default look; Radix primitives allowed but styled per spec.
15. Mobile is single-column stacked; no two-column dashboards on mobile.
16. No custom scrollbars, scroll-hijacking, or parallax.
17. No animated backgrounds or particle effects (except the §7.2 celebration).
18. No bouncy overshoot easing — use `cubic-bezier(0.22, 1, 0.36, 1)` (enter) / `cubic-bezier(0.4, 0, 1, 1)` (exit).
19. Streak indicator is a custom tiered SVG leaf, never a fire emoji.
20. No "experimental" toggles — everything ships fully.

---

## 2. Confirmed Decisions (Kickoff Q&A)

Answers given by the project owner to the five mandatory questions in `prompt.md` §0.1:

| #   | Question         | Decision                                                       | Consequences                                                                                                                                                                                                                                                                                                                                                          |
| --- | ---------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | MongoDB          | **Owner provides a connection string via `.env`. No Docker.**  | `MONGODB_URI` is required in `.env`. No local Docker MongoDB. Phase 10 `docker-compose.yml` ships **without** a MongoDB service (app container only), or is dropped in favor of plain `Dockerfile` + `DEPLOY.md` instructions. `.env.example` contains an empty `MONGODB_URI=` slot. No `.env` is ever committed.                                                     |
| 2   | Avatar storage   | **Local disk (`server/uploads/`) + storage adapter interface** | A `storage.js` service exposes `put(key, buffer, mime)`, `delete(key)`, `getUrl(key)`. Local implementation writes to `server/uploads/` and serves under `/uploads` via Express static. R2/S3 implementations can be added later without touching routes. `uploads/` is gitignored. Upload size cap (2 MB), image-type validation via magic bytes, filename = nanoid. |
| 3   | Google OAuth     | **Removed entirely**                                           | No Google button on `/login` or `/register`. No divider "or" section, no Google SVG icon, no disabled "Coming soon" tooltip. Auth screens contain only email/password forms plus the specified footer links.                                                                                                                                                          |
| 4   | Friends / social | **Deferred. Social achievements removed from the seed.**       | 23 achievements seeded (25 minus **First Friend** and **Sensei**). No friends UI, no referral flows. Achievement IDs `first-friend` and `sensei` do not exist; the **Completionist** achievement threshold adjusts from "unlock 20 other achievements" to "unlock 19 other achievements" (23 − 1 self = 22 max, so 19 is achievable). Documented in `DECISIONS.md`.   |
| 5   | Audio            | **Web APIs — zero binary assets**                              | Readings use the browser **Web Speech API** with `speechSynthesis` and `lang: 'ja-JP'`. Sound effects (button taps, correct/incorrect, level-up) are synthesized at runtime via the **Web Audio API** (small oscillator envelopes). No `howler`, no MP3s, no CDN audio. `howler` remains in the approved list but is unused.                                          |

---

## 3. Approved Deviations from Spec

Recorded here so `DECISIONS.md` and the phase reviews stay honest. Every entry is owner-approved.

| ID  | Spec reference    | Deviation                                                                                                                                                                                                                                                                                                                                                                      | Rationale                                                                                                                                                                                                |
| --- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | §0.1 Q1, Phase 10 | No Docker MongoDB; owner-supplied `MONGODB_URI`. Compose file (if shipped) has no `mongo` service.                                                                                                                                                                                                                                                                             | Owner decision — no Docker on dev machine.                                                                                                                                                               |
| D2  | §0.1 Q3, §7.11    | Google OAuth removed completely, not scaffolded disabled.                                                                                                                                                                                                                                                                                                                      | Owner decision.                                                                                                                                                                                          |
| D3  | §0.1 Q4, §11.3    | 23 achievements instead of 25; Completionist threshold 19.                                                                                                                                                                                                                                                                                                                     | Owner decision — defer social.                                                                                                                                                                           |
| D4  | §3.8              | `howler` unused (Web Audio API instead).                                                                                                                                                                                                                                                                                                                                       | Owner decision — zero binary assets.                                                                                                                                                                     |
| D5  | §7.4              | Stroke-order animation timings slowed: **1× = 600ms draw / 300ms stagger** (spec: 400ms / 200ms), **0.5× = 1200ms / 600ms** (spec implied 800ms / 400ms). Toggle **defaults to 0.5×**. Easing, idle `--ink-muted`, and vermillion current-stroke highlight unchanged.                                                                                                          | Owner reviewed the mockups and found the spec timings too fast ("the stroke order is fast"), then asked for 0.5× as the starting speed.                                                                  |
| D6  | §7.3 / §9         | `GET /kanji` accepts two params beyond §9's list: `sort` (`frequency`\|`strokes`\|`jlpt`, default frequency) and `status` (`all`\|`learning`\|`mastered`, default all). `status` returns an empty page until Phase 3 joins user progress.                                                                                                                                      | The mockup-approved §7.3 controls require server-side sort/status on the same request contract; §9 didn't name the params. **Flagged for approval at the Phase 2 review.**                               |
| D8  | §7.4 / §9         | Two progress surfaces beyond §9's endpoint list: `myProgress` field on `GET /kanji/:character` (full card projection, `null` when untracked/anonymous) and `DELETE /progress/:character` (204; 404 `PROGRESS_NOT_FOUND` on repeat) — the "Remove from review" action.                                                                                                          | §7.4 mandates a Remove button + SRS state line but §9 defines no read/remove endpoint. **Owner approved in the Phase 3 plan review (2026-10-28).**                                                       |
| D9  | §6.5 / §9         | Undo window: the **client** enforces the spec'd 4s UX (banner expires at 4s, client never sends later); the **server** accepts up to `UNDO_WINDOW_MS` = 10s (`UNDO_WINDOW_CLOSED` after) as latency headroom for a 3.9s click crossing the Render proxy.                                                                                                                       | A strict server-side 4s would reject undo clicks that originate in-spec but arrive ~0.5–1s late. The 4s behavior the user sees is unchanged. **Owner approved in the Phase 3 plan review (2026-10-28).** |
| D10 | §9 / §11.4        | Add `POST /gamification/streak/repair` — §11.4's repair banner ("Your 12-day streak ended yesterday. Repair for 100 coins?") has no endpoint in §9's table. Price `STORE.STREAK_REPAIR_COST` (100), allowed only when exactly one previous local day went unreviewed, **once per calendar month**; 409 `STREAK_NOT_REPAIRABLE` / `INSUFFICIENT_COINS` / `REPAIR_ALREADY_USED`. | Owner approved in the Phase 4 plan review (2026-10-28); §11.4 mandates the banner action but §9 defines no repair route.                                                                                 |
| D11 | §11.3 / D3        | Achievements amended from 23 (D3) to **41**, **all named in romaji + 漢字/かな** (spec's JLPT "Kansei" style kept); Completionist → **Zenshū 全集 unlocks at 32 of the other 40** (the original ~80% ratio); 18 defs beyond the spec's 23 have no spec rewards — rewards set in the approved conversation and recorded in DECISIONS.md.                                        | Owner approved in the Phase 4 plan review (2026-10-28) after the full 41-def list was confirmed. Amends D3.                                                                                              |

No other deviations are authorized. Any new deviation requires owner approval before implementation and must be appended to this table and `DECISIONS.md`.

---

## 4. Tech Stack & Approved Libraries

Adding any dependency outside this list requires updating `DECISIONS.md` and asking the owner first (`prompt.md` §3.8).

### Frontend (client/)

| Library                                 | Version/target | Purpose                                                                            |
| --------------------------------------- | -------------- | ---------------------------------------------------------------------------------- |
| React                                   | 19             | UI framework                                                                       |
| React Router                            | v7             | Routing; code-split every route via `React.lazy`                                   |
| TanStack Query                          | v5             | Server state, caching, optimistic updates for reviews                              |
| Zustand                                 | 4/5            | Client state (auth session, UI state, active review session)                       |
| react-hook-form + Zod                   | latest         | Forms (login, register, settings, profile) with Zod resolvers                      |
| Tailwind CSS                            | 3/4            | Styling, themed via `tailwind.config.js` mapping to design tokens                  |
| lucide-react                            | latest         | All UI icons, stroke width 1.75, sizes 16/20/24px                                  |
| Radix UI primitives                     | headless only  | Dialog (focus trap), Tabs, Dropdown, Tooltip — styled per spec, never default look |
| framer-motion                           | latest         | **Celebration + sheet transitions only** — nothing else                            |
| @tanstack/react-virtual                 | latest         | Kanji grid virtualization past 200 loaded items                                    |
| @tanstack/react-table                   | latest         | Statistics tables (best/worst days)                                                |
| recharts                                | latest         | Stats charts — palette forced to §6 tokens, never default colors                   |
| kuroshiro + kuroshiro-analyzer-kuromoji | latest         | Render-time furigana generation for example sentences                              |
| vite-plugin-pwa                         | latest         | Service worker + manifest (Phase 9)                                                |

### Backend (server/)

| Library                     | Purpose                                  |
| --------------------------- | ---------------------------------------- |
| express                     | HTTP server                              |
| mongoose                    | ODM                                      |
| zod                         | Validation of every body and query param |
| jsonwebtoken                | Access (15 min) + refresh (7 day) JWTs   |
| bcrypt                      | Password hashing, cost 12                |
| cookie-parser, cors, helmet | Middleware                               |
| express-rate-limit          | 100 req/min general, 10 req/min auth     |
| date-fns, date-fns-tz       | Timezone-correct streak/day boundaries   |
| dotenv                      | Config                                   |
| pino                        | Structured logging                       |
| nanoid                      | IDs (session, upload keys, etc.)         |
| fast-xml-parser             | Seed-only KANJIDIC2 parsing              |
| adm-zip (or unzipper)       | Seed-only KanjiVG zip extraction         |

### Testing

vitest, @testing-library/react, @testing-library/user-event, supertest, mongodb-memory-server, Playwright (optional E2E).

### Runtime

- Node.js ≥ 20 LTS (ESM, `fetch`, `node:crypto`).
- MongoDB ≥ 6 (owner-provided URI; Atlas or local mongod — no Docker).

---

## 5. Repository Structure (Full File Tree)

Three levels deep at the top; key files enumerated below. Layout follows the approved kickoff plan.

```
KanjiQuest/
├── prompt.md                          # Fixed product spec (source of truth)
├── IMPLEMENTATION_PLAN.md             # This document
├── README.md                          # Setup, seed expectations, coverage report
├── DECISIONS.md                       # ADR log — deviations, algorithm choices, CSRF choice
├── CONTRIBUTING.md
├── A11Y.md                            # Phase 9 audit results
├── ARCHITECTURE.md                    # Diagram + data flow (Phase 10)
├── DEPLOY.md                          # Render/Railway + Vercel (Phase 10)
├── mockups.html                       # Dev-only mockups (dashboard, review revealed, kanji detail)
├── .gitignore
├── .env.example                       # MONGODB_URI=, JWT secrets, PORT, CLIENT_ORIGIN
├── .husky/                            # pre-commit: lint-staged; pre-push: npm test
│
├── client/
│   ├── index.html                     # Google Fonts <link>: Fraunces, Instrument Sans,
│   │                                  #   Geist Mono, Noto Sans JP, Noto Serif JP (display=swap)
│   ├── vite.config.js                 # React + PWA plugins, /api + /uploads proxy → server
│   ├── tailwind.config.js             # Colors, fonts, radii, shadows, durations from §6
│   ├── postcss.config.js
│   ├── public/
│   │   ├── icons/                     # pwa-192.png, pwa-512.png, maskable-512.png
│   │   └── favicon.svg
│   └── src/
│       ├── main.jsx                   # ReactDOM root, theme bootstrap, QueryClientProvider
│       ├── App.jsx                    # Router + lazy routes + global overlays (toasts, shortcuts)
│       ├── routes.jsx                 # Route table with Suspense skeletons
│       ├── styles/
│       │   ├── tokens.css             # :root light tokens + [data-theme="dark"] (§6.1–3.6)
│       │   └── global.css             # Base, focus ring, reduced-motion, skip link
│       ├── lib/
│       │   ├── api.js                 # fetch wrapper, envelope unwrap, 401 → refresh
│       │   ├── audio.js               # Web Audio SFX (correct, wrong, tap, level-up)
│       │   ├── speech.js              # Web Speech API ja-JP speak(text)
│       │   ├── furigana.js            # kuroshiro singleton + withFurigana(japanese)
│       │   ├── keyboard.js            # Global shortcut manager (chords: g d, g l, …)
│       │   ├── hotkeys-review.js      # 1/2/3/4, Space, U, S, X
│       │   ├── dates.js               # Local-midnight helpers, "Resets in 6h 42m" formatter
│       │   └── cn.js                  # class merge helper
│       ├── components/
│       │   ├── ui/                    # Button, IconButton, Input, Select, Toggle, Modal (Radix),
│       │   │                          # Toast, Badge, Tag, Card, Skeleton, EmptyState, Avatar,
│       │   │                          # Tabs, Tooltip, ProgressRing, ProgressBar, SegmentedTabs
│       │   ├── layout/                # TopNav, BottomTabBar, PageContainer, ShortcutsOverlay,
│       │   │                          # OfflineBanner, AppShell (auth-gated)
│       │   └── domain/                # StreakLeaf (5 tiers), QuestCard, MiniLeaderboard,
│       │                              # KanjiCell, RatingButton, StrokeOrderSVG, RubyText,
│       │                              # AchievementCard, LevelBadge, CoinIcon, XPBar,
│       │                              # HeatmapCalendar, LevelUpModal, SessionSummary,
│       │                              # EmptyGardenSVG, OnboardingModal
│       ├── pages/                     # Dashboard, Review, Learn, KanjiDetail, Quiz, QuizSession,
│       │                              # Stats, Profile, Store, Leaderboard, Login, Register,
│       │                              # Licenses, KitchenSink (dev-only)
│       └── stores/                    # authStore.js, uiStore.js (theme/toasts), reviewStore.js
│
├── server/
│   ├── package.json                   # "type": "module"
│   ├── src/
│   │   ├── server.js                  # listen, graceful shutdown
│   │   ├── app.js                     # express: helmet, cors, cookies, rate-limit, routes, errors
│   │   ├── config/
│   │   │   ├── env.js                 # Zod-validated process.env (fails fast)
│   │   │   └── db.js                  # mongoose connect + indexes
│   │   ├── models/                    # User.js, Session.js, Kanji.js, Radical.js,
│   │   │                              # UserProgress.js, GamificationProfile.js,
│   │   │                              # Achievement.js, QuizSession.js, Quest.js,
│   │   │                              # UserQuest.js, UserInventory.js, Leaderboard.js
│   │   ├── middleware/
│   │   │   ├── auth.js                # requireAuth (access JWT), optionalAuth
│   │   │   ├── validate.js            # Zod body/query validator → 422 envelope
│   │   │   ├── rateLimit.js           # general + auth limiters
│   │   │   └── errors.js              # ApiError, envelope error handler, 500 catcher
│   │   ├── routes/                    # auth.routes.js, users.routes.js, kanji.routes.js,
│   │   │                              # progress.routes.js, review.routes.js,
│   │   │                              # gamification.routes.js, store.routes.js,
│   │   │                              # leaderboard.routes.js, quiz.routes.js,
│   │   │                              # quests.routes.js, stats.routes.js, index.js
│   │   ├── services/
│   │   │   ├── srs.js                 # Pure SM-2 modified function (§9) — heavily unit-tested
│   │   │   ├── xp.js                  # awardXP(), level calc, boost multiplier
│   │   │   ├── streak.js              # increment/reset/freeze/repair, milestone checks
│   │   │   ├── achievements.js        # 23 seeded defs + evaluator (criteria → unlock)
│   │   │   ├── quests.js              # daily selection (3 of 12), progress, daily sweep
│   │   │   ├── leaderboard.js         # weekly (Mon 00:00 UTC) + allTime, top 100, ties
│   │   │   ├── quiz.js                # session lifecycle, scoring, sprint timing
│   │   │   ├── kanjiEnrichment.js     # (seed-time) merge helpers
│   │   │   ├── storage.js             # adapter interface + LocalDiskStorage
│   │   │   ├── review.js              # due query, submit transaction, undo, suspend
│   │   │   └── furigana.js            # server-side kuroshiro for sentence ruby (optional cache)
│   │   └── utils/                     # envelope.js ({success,data,error}), dates.js, logger.js (pino)
│   ├── scripts/
│   │   ├── download-data.js           # KANJIDIC2.gz, KanjiVG zip, jmdict-simplified JSON,
│   │   │                              # Tatoeba sentences+links (.tar.bz2) → .data/ (skip if exists)
│   │   ├── seed-kanji.js              # parse → merge → enrich → bulkWrite(500) → coverage report
│   │   ├── seed-radicals.js           # + data/radical-mnemonics.json (214 entries, owner copy)
│   │   ├── seed-achievements.js       # 23 definitions (§10.4)
│   │   ├── seed-quests.js             # 12 quest definitions
│   │   └── seed-all.js                # runs everything in order
│   ├── data/
│   │   └── radical-mnemonics.json     # { character, meaning, mnemonic, strokeCount, variants[] }
│   ├── tests/
│   │   ├── srs.test.js                # 20+ cases (§9, §14)
│   │   ├── auth.test.js
│   │   ├── review.test.js
│   │   ├── streak.test.js
│   │   ├── store.test.js
│   │   ├── leaderboard.test.js
│   │   └── helpers/                   # test app factory, mongodb-memory-server boot
│   └── uploads/                       # gitignored — avatars via LocalDiskStorage
│
├── shared/
│   ├── constants.js                   # XP values, level titles, rating enums, quest types
│   └── typedefs.js                    # JSDoc typedefs shared by client/server
│
└── .data/                             # gitignored — downloads + kanjiapi cache
    ├── kanjidic2.xml.gz
    ├── kanjivg.zip / kanjivg/
    ├── jmdict-eng.json
    ├── sentences.tar.bz2 / extracted
    └── kanjiapi/                      # one file per kanji + list caches (idempotent reruns)
```

---

## 6. Design System Quick Reference

Full tables in `prompt.md` §3. Summary for implementation:

**Colors (light → dark):** `--bg-canvas` #FAF7F2→#15130F · `--bg-surface` #FFFFFF→#1F1C17 · `--bg-subtle` #F2EDE4→#2A2620 · `--ink-primary` #1A1713→#F5F0E6 · `--ink-secondary` #4A4438→#C9C2B2 · `--ink-muted` #8A8578 (same) · `--border-subtle` #E5DFD3→#2E2A23 · `--border-strong` #C9C2B2→#4A4438 · `--accent-vermillion` #C1432E→#E05A3F · `--accent-indigo` #2E4374→#6B8EC4 · `--success-matcha` #6B8E4E→#8FBF70 · `--warning-persimmon` #D9772E→#E8944A · `--danger-crimson` #B33A3A→#D95A5A · `--focus-ring` = vermillion. Rating colors: Again=crimson, Hard=persimmon, Good=matcha, Easy=indigo.

**Fonts (Google Fonts `<link>`, `display=swap`):** Fraunces (display/headings, 400–700, opsz 9–144), Instrument Sans (body/UI, 400–600), Geist Mono (numbers, 400–500), Noto Sans JP (Japanese UI, 400–500), Noto Serif JP (kanji display, 400–500).

**Type scale:** xs .75/1 · sm .875/1.25 · base 1/1.5 · lg 1.125/1.75 · xl 1.375/1.875 · 2xl 1.75/2.125 · 3xl 2.25/2.5 · 4xl 3/3.25 · kanji-xl 6rem/1 · kanji-2xl 10rem/1. Weights: 400 body, 500 UI labels/buttons, 600 headings, 700 display numbers only.

**Spacing:** 4px base; Tailwind scale 0–24. Screen padding px-4/6/8. Content max-width 1200px centered.

**Radii:** buttons/inputs 6px · cards 8px · modals 12px · tags/avatars 9999px.

**Shadows (only these three):** `--shadow-sm: 0 1px 2px rgba(26,23,19,.04)` · `--shadow-md: 0 2px 6px rgba(26,23,19,.06)` · `--shadow-lg: 0 4px 12px rgba(26,23,19,.08)`.

**Motion:** `--ease-out: cubic-bezier(.22,1,.36,1)` · `--ease-in: cubic-bezier(.4,0,1,1)` · fast 120ms · normal 220ms · slow 380ms · celebration 800ms (max). `prefers-reduced-motion: reduce` → all durations 0.01ms.

**Icons:** lucide-react, stroke 1.75, 16 inline / 20 button / 24 nav. Custom 2-color 1.5px line SVGs for empty states, achievements, streak leaf, quiz icons.

---

## 7. Data Model

Mongoose models (`prompt.md` §8), all with ESM schema registration.

| Collection            | Key fields                                                                                                                                                                                                                                                                                                                                                                                   | Indexes                                                                                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`               | email (unique), passwordHash, displayName, avatarUrl, nativeLanguage, jlptLevel, timezone, preferences{dailyGoalXP, dailyReviewLimit, theme, furigana, soundEnabled, hapticsEnabled, reminderTime, reminderEnabled}, createdAt, lastActiveAt                                                                                                                                                 | email unique                                                                                                                                            |
| `sessions`            | userId, refreshTokenHash, userAgent, ip, createdAt, expiresAt, revokedAt                                                                                                                                                                                                                                                                                                                     | userId, expiresAt                                                                                                                                       |
| `kanji`               | character, unicode, meanings[], readingsOn[], readingsKun[], nameReadings[], jlptLevel(5–1\|null), grade(1–8\|null), strokeCount, radical, radicals[], components[], strokeOrderSvg(string\|null), hasStrokeOrder, frequencyRank(null\|int), isJoyo, isJinmeiyo, isKyouiku, exampleWords[{word,reading,meaning,jlptLevel?,common}], exampleSentences[{japanese,english,audioUrl?}], mnemonic | character ✓ · unicode ✓ · jlptLevel sparse · strokeCount · isJoyo · isJinmeiyo · text index on meanings (english) · compound {jlptLevel, frequencyRank} |
| `radicals`            | character, meaning, mnemonic, strokeCount, variants[]                                                                                                                                                                                                                                                                                                                                        | character unique                                                                                                                                        |
| `userProgress`        | userId, kanjiId, state(new\|learning\|review\|relearning), dueDate, interval, easeFactor, repetitions, lapses, lastReviewedAt, history[{reviewedAt,rating,previousInterval,newInterval}], suspendedUntil                                                                                                                                                                                     | compound {userId, dueDate} · unique {userId, kanjiId}                                                                                                   |
| `gamificationProfile` | userId (unique), totalXP, currentLevel, xpToNextLevel, currentStreak, longestStreak, lastActivityDate, coins, dailyGoalXP, dailyXPProgress, unlockedAchievementIds[], equippedTitle, xpBoostExpiresAt, streakFreezes, goalStreakDays, lastRepairAt                                                                                                                                           | userId unique                                                                                                                                           |
| `achievements`        | id(slug), name, description, icon, category, criteria{type,threshold,…}, rewardXP, rewardCoins                                                                                                                                                                                                                                                                                               | id unique                                                                                                                                               |
| `quizSessions`        | userId, sessionType, startedAt, completedAt, results[{kanjiId,correct,rating,responseTimeMs}], xpEarned, accuracy                                                                                                                                                                                                                                                                            | userId, startedAt                                                                                                                                       |
| `leaderboard`         | period(weekly\|allTime), entries[{userId,displayName,avatarUrl,title,xp,rank}]                                                                                                                                                                                                                                                                                                               | period unique                                                                                                                                           |
| `quests`              | id, title, description, type, target, xpReward, coinReward                                                                                                                                                                                                                                                                                                                                   | id unique                                                                                                                                               |
| `userQuests`          | userId, date(YYYY-MM-DD), questId, progress, completed                                                                                                                                                                                                                                                                                                                                       | compound {userId, date}                                                                                                                                 |
| `userInventory`       | userId, itemId, purchasedAt, consumedAt, active                                                                                                                                                                                                                                                                                                                                              | userId, itemId                                                                                                                                          |

Furigana is **never stored** per sentence — generated at render time with kuroshiro (`prompt.md` §5.4).

---

## 8. API Surface

REST under `/api/v1`. Envelope: success → `{ success: true, data }`; error → `{ success: false, error: { code, message, fields? } }`. Status codes: 200/201/204/400/401/403/404/409/422/429/500. Zod validation on every body and query.

| Method | Endpoint                              | Purpose                                                                                  | Auth           |
| ------ | ------------------------------------- | ---------------------------------------------------------------------------------------- | -------------- |
| POST   | `/auth/register`                      | Create account (+ gamification profile)                                                  | —              |
| POST   | `/auth/login`                         | Access (15m) + refresh (7d) cookies                                                      | —              |
| POST   | `/auth/refresh`                       | Rotate refresh token                                                                     | refresh cookie |
| POST   | `/auth/logout`                        | Revoke refresh token                                                                     | access         |
| GET    | `/users/me`                           | Profile + gamification summary                                                           | access         |
| PATCH  | `/users/me/preferences`               | Update settings (auto-save)                                                              | access         |
| POST   | `/users/me/avatar`                    | Upload avatar (storage adapter)                                                          | access         |
| GET    | `/kanji`                              | Paginated: jlpt, strokeCount, radical, joyo, jinmeiyo, q, sort, status, page, limit(≤50) | access         |
| GET    | `/kanji/:character`                   | Detail + stroke SVG                                                                      | access         |
| POST   | `/progress/add`                       | Add kanji to SRS queue                                                                   | access         |
| GET    | `/progress/due`                       | Due cards (dueDate ≤ now, not suspended)                                                 | access         |
| POST   | `/progress/review`                    | Submit rating → SRS + XP + streak + quests + achievements                                | access         |
| POST   | `/review/:cardId/undo`                | Compensating reversal, 4s window                                                         | access         |
| POST   | `/review/:cardId/suspend`             | Bury 7 days                                                                              | access         |
| GET    | `/progress/stats`                     | Mastery counts per JLPT                                                                  | access         |
| GET    | `/gamification/profile`               | XP, level, streak, coins                                                                 | access         |
| GET    | `/gamification/achievements`          | All + unlock status                                                                      | access         |
| POST   | `/gamification/store/purchase`        | Buy item (server-authoritative)                                                          | access         |
| GET    | `/store/items`                        | Catalog                                                                                  | access         |
| GET    | `/store/inventory`                    | User purchases                                                                           | access         |
| GET    | `/leaderboard?period=weekly\|allTime` | Top 100 + current user                                                                   | access         |
| POST   | `/quiz/start`                         | Create session                                                                           | access         |
| POST   | `/quiz/:sessionId/answer`             | One answer                                                                               | access         |
| POST   | `/quiz/:sessionId/submit`             | Finalize, validate, award XP                                                             | access         |
| GET    | `/quests/today`                       | Today's 3 quests + progress                                                              | access         |
| GET    | `/stats/heatmap?range=365`            | Reviews per day                                                                          | access         |
| GET    | `/stats/forecast?days=30`             | Upcoming due counts                                                                      | access         |
| GET    | `/stats/accuracy?days=30`             | Daily accuracy                                                                           | access         |
| GET    | `/licenses` (page)                    | Attribution listing                                                                      | —              |

**CSRF approach** (documented in `DECISIONS.md`): `SameSite=Strict` refresh cookie + custom header requirement (`X-Requested-With`) on all state-changing requests; access token also in httpOnly cookie. No token in JS-readable storage.

---

## 9. SRS Algorithm (SM-2 Modified)

Pure function in `server/src/services/srs.js`:

```
in:  { state, interval, easeFactor, repetitions, lapses, lastReviewedAt }
     rating ∈ {0=Again, 1=Hard, 2=Good, 3=Easy}
out: { state, interval, easeFactor, repetitions, lapses, dueDate }
```

- **New** (EF starts 2.5): Again→learning 1m · Hard→learning 6m · Good→review 1d · Easy→review 4d (reps=1).
- **Learning:** Again→1m (state/reps unchanged) · Hard→10m · Good→1d review · Easy→4d review.
- **Review:** Again→relearning, reps 0, lapses+1, interval = max(1, interval×0.5) days, EF −0.20 (floor 1.30) · Hard→interval×1.2, EF −0.15 · Good→interval×EF · Easy→interval×EF×1.3, EF +0.15 (ceiling 3.00).
- **Relearning:** like learning, interval floor 10m; exits to `review` on Good/Easy.
- EF update (rating→q mapping: 0→0, 1→3, 2→4, 3→5): `EF' = EF + (0.1 − (5−q)(0.08 + (5−q)×0.02))`, clamped [1.3, 3.0].
- `dueDate = lastReviewedAt + interval` (ms); same-day intervals round to nearest minute.
- **Mastered** = `state === 'review' && interval >= 180 days`.

**Undo** (4s window): server stores the pre-review snapshot; undo endpoint restores it atomically and reverses any XP awarded in that review (compensating transaction), re-evaluating dependent counters.

**Test requirement:** 20+ unit tests — every rating path per state, EF floor/ceiling, relearning exit, minute rounding, DST-boundary date math.

---

## 10. Gamification Rules

### XP (server-authoritative; client never sends XP/coins/streak/level as truth)

- Review: Again +2 · Hard +5 · Good +10 · Easy +15.
- Quiz correct +5; session complete (≥10 answers) +20; sprint complete +30 + (10 × correct).
- Daily goal met +30 (1×/day) · first review of day +20 (1×/day).
- Quests 20–50 XP each · daily sweep (all 3) +30.
- Store XP boost: 1.5× applied at award time, server-side, for 24h.

### Levels

20 levels. `xpToNextLevel(N) = floor(100 × N^1.5)`. (L1 0 · L2 282 · L5 1,118 · L10 3,162 · L20 8,944.)

Titles: Seedling, Sprout, Leaf, Sapling, Young Tree, Bough, Branch, Canopy, Grove, Thicket, Copse, Wood, Stand, Forest, Deep Forest, Ancient Woods, Old Growth, Wilder, Mountain, Evergreen.

Level-up modal: garden-grows SVG, level number Fraunces 700 text-6xl, title below, "New title unlocked" when applicable. Exactly one exclamation mark allowed app-wide — in this modal ("Ganbatte!" allowed here only).

### Achievements — 23 seeded (D3)

Learning: Hajimemashite (はじめまして, first review, +20 XP) · Perfect Ten (+50) · Flawless (+150) · Mizu no Nagare (水の流れ, +300) · Stroke Master (+250) · Kaite Miro (書いてみろ, +250) · Morning Person (+50) · Night Owl (+50).
Collection: First Sprout (+50) · Hundred (+200) · Two Fifty (+400) · The Grove (+800 XP, 100 coins).
Streak: Kokoro (心, +100/20c) · Tsuki (月, +250/50c) · Kaze (風, +1000/200c) · No Missed Days (+200/30c).
Mastery: N5 Complete (+500/50c) · N4 Complete (+1000/100c) · Level 10 (+500/100c) · Level 20 (+2000/500c) · Completionist (19 others, +1000/200c).
Special: Garden Restored (+10).

Each with a custom 24×24 SVG icon, max 2 colors (vermillion+ink or matcha+ink).

### Streak

Increment on first review of any calendar day in user's **timezone** (date-fns-tz). Reset on a missed day unless a streak freeze is active (consumed automatically). Milestones 7/30/100 → achievements + celebration modal. Repair: broken within 24h → dashboard banner "Your 12-day streak ended yesterday. Repair for 100 coins?" — one repair per calendar month.

### Quests

12 definitions; 3 selected per user per day (deterministic by hashing user + date so reruns are stable). Progress persists across the day; resets at local midnight; "Resets in 6h 42m" countdown on dashboard. All 3 complete → "Daily sweep" +30 XP.

### Store catalog

Streak freeze 50 coins (max 2 active) · XP boost 100 coins (1.5× 24h) · Titles 25–75 ("The Diligent", "Kokoro no Tsuchi", "Yama no Ue") · Avatar frames 100 coins (3 custom SVGs). No loot boxes, no real money, no monetization.

---

## 11. Data Pipeline (Seed)

Runs at seed time only — never at runtime. All downloads cached in `.data/` (gitignored); existing files are skipped so reruns are fast and idempotent.

### Sources

| Source            | URL                                                                                                           | Provides                                                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| KANJIDIC2         | `https://www.edrdg.org/kanjidic/kanjidic2.xml.gz`                                                             | 13,108 entries: meanings, on/kun/name readings, strokes, grade, frequency, radical, codepoint                                                                      |
| KanjiVG           | GitHub releases latest (`kanjivg-YYYYMMDD-all.zip`)                                                           | Stroke-order SVGs; filename = lowercase hex codepoint (e.g. `065e5.svg` for 日). ~2,000 KANJIDIC2 chars lack SVG → `strokeOrderSvg: null`, `hasStrokeOrder: false` |
| jmdict-simplified | GitHub releases latest (`jmdict-eng-*.json`)                                                                  | Example words                                                                                                                                                      |
| Tatoeba           | `downloads.tatoeba.org/exports/sentences.tar.bz2` + `links.tar.bz2` (prefer `per_language/jpn/` if available) | Example sentences + English translations                                                                                                                           |
| kanjiapi.dev      | `/v1/kanji/all`, `/joyo`, `/jinmeiyo`, `/kanji/{char}`                                                        | JLPT levels, official-list membership. 10 req/s limit; cache every response in `.data/kanjiapi/`                                                                   |

### Merge strategy (server/scripts/seed-kanji.js)

1. Parse KANJIDIC2 → map keyed by UCS codepoint.
2. Attach KanjiVG SVG by computed filename; missing → null/false.
3. Enrich `jlptLevel` from kanjiapi (null stays null — UI must handle; these kanji appear only under "All").
4. Tag `isJoyo`, `isJinmeiyo`, `isKyouiku` (grade 1–6).
5. Attach 2–4 example words per kanji (prefer ≤2-char words and `common: true`); empty array when none.
6. Attach ≤1 example sentence (≤20 Japanese chars containing the kanji, with English); empty array when none.
7. Attach radical mnemonic from `server/data/radical-mnemonics.json` (214 traditional radicals, variants like 亻 for 人).

### Execution characteristics

- `bulkWrite` in batches of 500; progress logged every 1,000 documents.
- Expected wall time 5–15 minutes (documented in `README.md`).
- Final **coverage report** printed: total kanji · with SVG · with example words · with example sentences · with JLPT · Jōyō count · Jinmeiyō count. Partial coverage is not failure — "comprehensive" includes the gaps.
- Radicals, achievements (23), and quests (12) seeded by their own scripts.

### Licensing (required — §5.8)

`/licenses` route + footer link "Data sources and licenses." KANJIDIC2 CC BY-SA 4.0 (EDRDG) · KanjiVG CC BY-SA 3.0 (include copyright notice in footer and /licenses) · JMdict/jmdict-simplified CC BY-SA 4.0 (EDRDG) · Tatoeba CC BY 2.0 FR. Shipping without attribution violates these licenses — non-optional.

---

## 12. Screen Inventory

All layouts specified in `prompt.md` §7; the mockups cover the three most design-critical screens.

| Route                 | Screen                  | Key elements                                                                                                                                                                                                                                                                                                                 |
| --------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/login`, `/register` | Auth (§7.11)            | Split layout desktop (form max 400px + decorative panel); Google removed entirely (D2); password strength indicator on register; crimson borders + alert-circle messages                                                                                                                                                     |
| —                     | Onboarding modal (§6.1) | 3 steps: level (N5/N4/N3/Not sure) → pace (10/20/40) → reminders (9am/8pm/Not now); "Skip for now — use defaults"; progress dots                                                                                                                                                                                             |
| `/`                   | Dashboard (§7.1)        | "Today" header; streak card (tiered leaf SVG, 7-day dot grid, milestone bar "10 days to Sakura"); daily goal ring; due reviews card ("Start review" / "All caught up — next review at 14:30"); 3 quest cards; mini leaderboard "This week"; empty state "Your garden is empty"                                               |
| `/review`             | Review session (§7.2)   | Distraction-free; progress bar; card front kanji 6rem; card back with meanings · On/Kun ruby + speakers + example word + "Remember:" mnemonic; 4 rating buttons with 1–4 shortcuts and 220ms fill animation; undo 4s toast; session summary; empty "Nothing due"                                                             |
| `/learn`              | Kanji browser (§7.3)    | Search (250ms debounce, server-side); N5/N4/N3/All tabs; radical pills; sort/status filters; 6/4/3-column grid; 50/page "Load more" + virtualize >200; progress dots; "No kanji match those filters" empty state                                                                                                             |
| `/kanji/:character`   | Detail (§7.4)           | 10rem kanji; stroke count · radical; stroke-order animation card (play/pause, 1×/0.5×, reset; dasharray 400ms stagger 200ms; missing-data message); On/Kun ruby chips; Words (2–4 cards); In context (kuroshiro ruby); "Remember it" mnemonic; sticky sidebar: Add/Remove from review, radicals, components, 6 related kanji |
| `/quiz`               | Quiz hub (§7.5)         | 5 mode cards with 96px custom SVGs + queue count; sprint full-width                                                                                                                                                                                                                                                          |
| `/quiz/:mode`         | Quiz session (§7.6)     | MCQ (800ms reveal pause); reading match (ruby options); stroke-order tap (correct fills vermillion, wrong shakes ±4px 200ms); drawing canvas 300×300 with stroke-overlap scoring (≥85 Correct / 60–84 Close / <60 Not quite + template overlay 30%); sprint (+3s/−5s, summary)                                               |
| `/stats`              | Statistics (§7.7)       | 365-day heatmap (12px cells, 5 matcha tiers); 30-day accuracy line; 30-day forecast bars (indigo); JLPT stacked bars (new/learning/review/mastered); best/worst 5 days (≥10 reviews)                                                                                                                                         |
| `/profile`            | Profile (§7.8)          | Tabs Profile/Achievements/Settings; avatar 128px + upload; inline name edit; title picker; SVG shield level badge; 3 stat cards; 23 achievement cards (locked 40% opacity grayscale); settings sections with auto-save "Saved" toast                                                                                         |
| `/leaderboard`        | Leaderboard (§7.9)      | Weekly/All-time tabs; Rank/Player/Title/XP; top 3 vermillion left border; sticky current-user row                                                                                                                                                                                                                            |
| `/store`              | Store (§7.10)           | Coin balance; 3/1-column grid; Buy outline→filled; insufficient funds disabled + "Need 30 more coins." tooltip; confirm modal                                                                                                                                                                                                |
| `/licenses`           | Licenses                | Every source, license, link + KanjiVG notice                                                                                                                                                                                                                                                                                 |
| dev-only              | `/kitchen-sink`         | Every component light+dark side-by-side (Phase 0)                                                                                                                                                                                                                                                                            |

**Global chrome:** desktop top nav (wordmark + 植物, center links with 2px vermillion underline, streak pill + XP + avatar); mobile wordmark + hamburger + fixed bottom tab bar (Home/Learn/Review/Stats/Profile, safe-area padding). Toasts top-right/top-center, max 360px, 4s auto-dismiss. Global shortcuts: `?` overlay · `/` search · `g d/l/r/s/p` · review `1-4`, `Space`, `u`, `s`, `x` · `Esc` closes modals.

---

## 13. Build Phases 0–10 — Detailed Tasks & Acceptance Criteria

Each phase ends with: working code, all tests green, clean `git status`, a `phase-N-complete` tag, a summary (a–f per §19), and owner go-ahead before the next phase.

### Phase 0 — Foundation

**Tasks:** `git init` first, before any file · `.gitignore` (node_modules, dist, build, .env/.env.* except .env.example, *.log, coverage, .vite, .DS_Store, .vscode, .idea, uploads, .data) · husky + lint-staged (ESLint+Prettier pre-commit <5s; `npm test` pre-push) · README.md · .env.example (MONGODB_URI=, JWT_ACCESS_SECRET=, JWT_REFRESH_SECRET=, PORT=, CLIENT_ORIGIN=) · DECISIONS.md (seeded with D1–D4 + CSRF choice) · CONTRIBUTING.md · monorepo scaffold client/server/shared (JSDoc typedefs) · tokens.css + Tailwind theme · install approved libs · `/kitchen-sink` with every component in light+dark · mockups.html presented and approved **before** app code.
**Acceptance:** app boots (`vite dev` + `node server`) with proxy; kitchen-sink renders all components both themes; tokens match §6 exactly; git clean + tagged.

### Phase 1 — Auth

**Tasks:** User + Session models · register/login/refresh/logout with Zod + bcrypt(12) · JWT middleware (15m access, 7d rotated hashed refresh, httpOnly Secure SameSite=Strict) · rate limiters (100/10) · login/register screens per §7.11 (**no Google**, D2) · auth-gated AppShell with top/bottom nav · gamification profile created at register.
**Acceptance:** register → login → refresh rotation → logout flow works; revoked token rejected; screens match §7.11 including validation styling; tests for register/login/refresh/revoked.

### Phase 2 — Comprehensive kanji data + browser + detail

**Tasks:** download-data.js (4 sources → .data/, skip-existing) · seed-kanji.js (parse/merge/enrich/bulkWrite 500/coverage report, 5–15 min) · seed-radicals.js + radical-mnemonics.json (214) · kanjiapi cache with 10 rps limiter · GET /kanji (filters, sort, pagination ≤50) · GET /kanji/:character · /learn screen (debounced server search, tabs, radical pills, virtualization >200, empty state) · /kanji detail (stroke animation, all missing-data empty states, kuroshiro sentence ruby, sticky sidebar, related kanji).
**Acceptance:** full seed completes with printed coverage report; browser never fetches more than 50/page; 13,108 rows not rendered (virtualized); detail handles `hasStrokeOrder:false`, empty words, empty sentences with exact copy; indexes created incl. text index on meanings.

### Phase 3 — SRS + review session

**Tasks:** srs.js pure function · 20+ unit tests (all rating paths, EF clamps, relearning exit, DST) · UserProgress model + indexes · due/submit/undo/suspend endpoints (server-authoritative XP) · /review screen (front/back, ruby, speakers, rating buttons + animation, undo 4s, skip, suspend, keyboard footer, session summary, empty state).
**Acceptance:** full review loop works end-to-end; undo within 4s reverts SRS state + XP; undo after 4s rejected; suspend buries 7 days; all SRS tests green.

### Phase 4 — Gamification core

**Tasks:** xp.js (awardXP, boost multiplier, level calc) · streak.js (timezone-correct increment/reset/freeze, milestones) · achievements.js evaluator for **41 defs (D11, amending D3's 23)** · seed-achievements.js · gamification endpoints (profile, achievements, **D10** `streak/repair`) · dashboard **except quests and mini-leaderboard** · level-up + streak-milestone celebration modals.
**Acceptance:** dashboard shows streak card (tiered leaf), goal ring, due card; XP/level/streak correct after reviews; achievements unlock with rewards; level-up modal triggers at thresholds.

### Phase 5 — Daily quests + statistics

**Tasks:** 12 quest defs + seed · UserQuests model · deterministic daily 3-selection · progress tracking on review/quiz events · daily sweep +30 · quests section on dashboard (countdown, completed states) · stats endpoints (heatmap/forecast/accuracy) · /stats screen (5 charts, exact palette).
**Acceptance:** quests persist across the day, reset at local midnight, sweep fires; heatmap 365d / accuracy 30d / forecast 30d / JLPT stacked bars / best-worst lists render with spec colors only.

### Phase 6 — Quiz modes

**Tasks:** QuizSession model · start/answer/submit endpoints (server validates answers, awards XP) · /quiz hub (5 cards, custom SVGs) · MCQ meaning · reading match · stroke-order tap (KanjiVG paths) · drawing canvas (stroke-overlap algorithm, documented in DECISIONS.md) · 60s sprint (+3/−5, summary) · navigation-away confirmation modal.
**Acceptance:** all 5 modes playable with keyboard shortcuts; scoring thresholds per §7.6; sprint timing correct; XP awards server-side.

### Phase 7 — Store + leaderboard + profile

**Tasks:** store items/inventory endpoints, purchase validation (insufficient funds 402-style 400 error, effect application) · /store screen · leaderboard service (weekly Mon 00:00 UTC + allTime, top 100, sticky user row) · /leaderboard · /profile with 3 tabs, avatar upload via storage adapter, title picker, achievements grid, settings (auto-save).
**Note:** no social features (D3).
**Acceptance:** purchases deduct coins, apply effects (freeze/boost/title/frame), reject insufficient funds; leaderboard ordering + ties tested; profile avatar uploads to `server/uploads/`; settings persist.

### Phase 8 — Onboarding + settings + polish

**Tasks:** 3-step onboarding modal · full settings screen (§6.13 sections) · global keyboard shortcuts + `?` overlay · toasts/skeletons/empty states audit on every screen · Web Audio sound effects + speech ja-JP readings (D4) · reminder time fields stored.
**Acceptance:** new users see onboarding; every async state has a skeleton (no "Loading..."); every empty state has SVG+headline+explanation+CTA; shortcuts work everywhere; `Esc` closes modals.

### Phase 9 — PWA + accessibility + performance

**Tasks:** manifest (192/512/maskable, vermillion theme, canvas bg, standalone) · vite-plugin-pwa shell caching · IndexedDB offline review queue + sync-on-reconnect · "Offline — reviews will sync when you reconnect" banner · WCAG audit vs §12 (focus rings, labels, live regions, contrast both themes) · Lighthouse vs budgets · A11Y.md results.
**Acceptance:** installable PWA; offline review queues and syncs; Lighthouse mobile ≥90/95/95/90; main chunk <200KB gzipped; screen-reader pass documented.

### Phase 10 — Deployment + docs

**Tasks:** Dockerfile (+ compose without MongoDB service per D1, or plain deploy instructions) · DEPLOY.md (Render/Railway backend + Vercel frontend) · ARCHITECTURE.md (diagram + data flow) · final README.md (seed 5–15 min, coverage report explanation) · /licenses route + footer link · final tags.
**Acceptance:** fresh clone → `.env` → install → seed → run documented and verified; all licenses attributed; all 11 tags exist.

---

## 14. Testing Strategy

**Backend (vitest + supertest + mongodb-memory-server):**

- `srs.test.js` — 20+ cases: every rating × state path, EF floor 1.30 / ceiling 3.00, relearning exit, interval minute-rounding, DST-boundary date math.
- `auth.test.js` — register, login, refresh rotation (old token invalid after use), revoked-session rejection, bcrypt cost, rate limiting.
- `review.test.js` — submit → progress update → XP award → achievement check chain; undo within window; undo rejected after 4s; suspend.
- `streak.test.js` — increment once/day, reset on missed day, freeze consumption, timezone boundaries.
- `store.test.js` — insufficient funds rejected, inventory updated, effects applied (boost multiplier, freeze count).
- `leaderboard.test.js` — ordering, tie-breaking, weekly reset boundary.

**Frontend (vitest + React Testing Library):**

- Dashboard renders streak/XP/due from mocked API.
- Review: reveal → rate → undo within 4s → undo rejected after 4s.
- Kanji detail renders SVG; handles `hasStrokeOrder:false`.
- Settings theme toggle persists (localStorage + data-theme).
- Empty states render correct copy and CTA (dashboard, review, learn).

**E2E (Playwright, optional for MVP):** signup → onboarding → dashboard → review → summary.

---

## 15. Security Checklist

- [ ] bcrypt cost 12.
- [ ] Access JWT 15 min, httpOnly + Secure + SameSite=Strict cookie.
- [ ] Refresh JWT 7 day, rotated on use, **hashed** in `sessions`, revoked on logout.
- [ ] Rate limiting: 100 req/min general, 10 req/min auth.
- [ ] Helmet default CSP adjusted for Google Fonts + asset hosts.
- [ ] Zod validation on every body/query; Mongoose validation as second line.
- [ ] No `.env` committed; pre-commit hook rejects `.env`, `*.pem`, `*.key`, `*secret*`.
- [ ] All mutations server-authoritative — client never sends xpAmount/coinsEarned/streak/level as truth.
- [ ] CSRF: SameSite=Strict cookies + `X-Requested-With` header requirement on mutations; choice documented in DECISIONS.md.
- [ ] Avatar upload: magic-byte image validation, 2 MB cap, nanoid filenames, no path traversal.
- [ ] `strokeOrderSvg` rendered via sanitized SVG (allowlist of elements/attributes) to avoid XSS from stored SVG.

---

## 16. Performance Budgets

- Lighthouse mobile: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90.
- FCP < 1.8s on 4G.
- Main JS chunk < 200 KB gzipped; code-split every route (`React.lazy` + Suspense skeleton).
- Fonts subset, `font-display: swap`.
- Kanji browser: never ship 13,108 records — 50/page, 250ms search debounce, server-side filtering, virtualization past 200 items.
- `/kanji/:character` fetches only that document.
- Text index on `meanings` must exist before considered deployable.
- KanjiVG SVGs served per-character; stroke animation must not block interaction (transform/opacity only where possible).

---

## 17. Accessibility Requirements

WCAG 2.1 AA minimum.

- Contrast ≥ 4.5:1 body, ≥ 3:1 large — verified in **both** themes.
- Focus ring: `outline: 2px solid var(--focus-ring); outline-offset: 2px` on all interactive elements.
- `<button>`/`<a>` only — never `<div onClick>`.
- `<label htmlFor>` on every input.
- Toasts: `role="status"`, `aria-live="polite"`.
- Modals: Radix Dialog (focus trap + Escape).
- Skip link at top of every page.
- SVGs: `aria-label` or `aria-hidden="true"` when decorative.
- Color never the only signal (rating buttons include text + shortcut digits).
- `prefers-reduced-motion` respected globally.
- Screen-reader pass on dashboard, review session, kanji detail — results documented in `A11Y.md` (Phase 9).

---

## 18. Version Control Workflow

- `git init` is the first action, before any file (Phase 0).
- Branches: `main` (deployable) ← `dev` (integration) ← `feat/phase-N-slug`.
- Conventional Commits: `feat(auth): add refresh token rotation`. One logical change per commit.
- Tags: `phase-0-complete` … `phase-10-complete`.
- husky + lint-staged: pre-commit ESLint + Prettier on staged files (<5s); pre-push `npm test`.
- Never `git push`, `git reset --hard`, `git rebase` on shared branches, or `git push --force` without explicit confirmation.
- Show `git log --oneline --graph -15` in every phase summary.
- A phase is not complete if `git status` is dirty.

---

## 19. Phase-End Review Protocol

After each phase, present to the owner:

**(a)** what was built · **(b)** file tree of new/modified files · **(c)** `git log --oneline --graph -15` + `git diff --stat` since the last tag · **(d)** deviations from spec (none without approval; append to §3 + DECISIONS.md if any) · **(e)** acceptance criteria for the phase and confirmation each is met · **(f)** wait for explicit go-ahead before starting the next phase.

If tempted to deviate from the anti-slop rules or design system for a "better" result — **stop and ask first**. Never silently improve.

---

## 20. Risk Register & Mitigations

| Risk                                                            | Impact              | Mitigation                                                                                                                                                                 |
| --------------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| KANJIDIC2 / KanjiVG / Tatoeba download failures or format drift | Seed blocked        | Files cached in `.data/`; scripts idempotent and re-runnable; parsers tolerant; pin expected counts (13,108) and warn loudly on mismatch                                   |
| Tatoeba tar.bz2 extraction on Windows                           | Seed errors         | Use pure-JS bz2 decompressor or document `tar` availability; test extraction in Phase 2 early                                                                              |
| kanjiapi.dev rate limits / downtime                             | Missing JLPT levels | 10 rps limiter + full response cache in `.data/kanjiapi/`; null JLPT handled everywhere in UI                                                                              |
| Mongo text index build time on 13k docs with SVG strings        | Slow first boot     | Indexes built by `seed-kanji.js` at seed time, not app boot; consider storing SVG in GridFS or separate field if doc size is problematic — flag in DECISIONS.md if changed |
| Web Speech API voices missing ja-JP on some devices             | No reading audio    | Feature-detect; hide speaker icons when no ja voice; never block UI                                                                                                        |
| Drawing-canvas scoring quality                                  | Poor UX             | Stroke-overlap algorithm documented in DECISIONS.md; thresholds spec-fixed (85/60); template overlay fallback at <60                                                       |
| Streak/timezone bugs (DST)                                      | Wrong resets        | date-fns-tz throughout; dedicated DST tests in streak + srs suites                                                                                                         |
| Bundle size > 200KB gz                                          | Budget miss         | Route-level lazy loading, kuroshiro lazy-init, recharts isolated to /stats chunk, bundle audit in Phase 9                                                                  |
| Owner-supplied Mongo URI unavailable mid-build                  | Tests blocked       | All backend tests use mongodb-memory-server — never the real DB                                                                                                            |

---

## 21. Glossary

| Term                           | Meaning                                                                    |
| ------------------------------ | -------------------------------------------------------------------------- |
| **KANJIDIC2**                  | EDRDG's XML dictionary of 13,108 kanji — primary seed source               |
| **KanjiVG**                    | CC-licensed SVG stroke-order data, filename = hex codepoint                |
| **JMdict / jmdict-simplified** | EDRDG English word dictionary; scriptin's JSON form used for example words |
| **Tatoeba**                    | Sentence collection with translations (CC BY 2.0 FR)                       |
| **Jōyō / Jinmeiyō / Kyouiku**  | Daily-use / name-use / education (grade 1–6) kanji lists                   |
| **JLPT N5–N1**                 | Proficiency test levels; N5 easiest. Stored 5–1 or null                    |
| **On-yomi / Kun-yomi**         | Chinese-derived / native Japanese readings                                 |
| **SM-2**                       | SuperMemo-2 spaced repetition algorithm; modified per §9                   |
| **SRS**                        | Spaced repetition system                                                   |
| **Furigana**                   | Small kana above kanji giving the reading, via `<ruby>`                    |
| **Hanko**                      | Name seal — source of the vermillion accent color                          |
| **Daily sweep**                | Bonus for completing all 3 daily quests (+30 XP)                           |

---

_Document version: 1.0 — created from kickoff Q&A. Update §2/§3 only with owner-approved decisions; update phase checklists as phases complete (mark `[x]` + tag name)._
