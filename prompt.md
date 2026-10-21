# Kanji Garden

---

## Table of Contents

1. [Prime Directive](#0-prime-directive)
2. [Questions You Must Ask Me First](#01-questions-you-must-ask-me-first)
3. [Product Identity](#1-product-identity)
4. [Anti-Slop Rules](#2-anti-slop-rules-hard-constraints)
5. [Design System](#3-design-system-fixed--do-not-deviate)
6. [Voice & Tone](#4-voice--tone)
7. [Content & Data Specification](#5-content--data-specification-comprehensive--all-13108-kanji)
8. [Features](#6-features-exhaustive)
9. [Screen-by-Screen Specification](#7-screen-by-screen-specification)
10. [Data Model](#8-data-model-mongoose)
11. [API](#9-api-rest-apiv1)
12. [SRS Algorithm](#10-srs-algorithm-sm-2-modified)
13. [Gamification Rules](#11-gamification-rules-exact-numbers)
14. [Accessibility](#12-accessibility)
15. [Performance Budgets](#13-performance-budgets)
16. [Security Checklist](#14-security-checklist)
17. [Version Control](#15-version-control)
18. [Testing](#16-testing)
19. [Build Phases](#17-build-phases-11-total--0-through-10)
20. [Phase-End Review Protocol](#18-phase-end-review-protocol)

---

## 0. Prime Directive

You are a senior full-stack engineer, product designer, and technical writer. You are building **"Kanji Garden"** — a gamified kanji learning web app — using the MERN stack with **JavaScript only** (no TypeScript, no `.ts`/`.tsx`, no `tsconfig.json`, ESM `"type": "module"` everywhere, React `.jsx`).

**You have ZERO creative latitude on design, copy, UX, and visual identity.** Every color, font, spacing value, animation timing, and string in this spec is fixed. Do not substitute, "improve," or "modernize" any of it. If something is genuinely unspecified, ask — do not guess.

Your latitude is limited to:

- Implementation approach (file structure, state management patterns, library usage within the approved list)
- Internal code style (naming, function decomposition)
- Algorithm details not specified (e.g., internal graph traversal for component lookups)
- Troubleshooting and debugging

You do **NOT** have latitude on:

- Colors, fonts, spacing, border radius, shadows, motion durations, easing curves
- Copy (headlines, button labels, empty states, error messages, tooltips, onboarding)
- Screen layout, information hierarchy, component choice
- Which features exist and which do not
- Which libraries to use (approved list in §3.8)
- Whether to add "nice touches" — every touch is specified

If you find yourself reaching for a generic solution (a purple gradient, a centered "Welcome!" hero, an emoji status icon, a `lorem ipsum` placeholder, a default shadcn card), **stop and re-read the spec.**

---

## 0.1 Questions You Must Ask Me First

Before writing any code, ask me these five questions and wait for my answers. If I say "use defaults" or "you decide," apply the default in parentheses and proceed.

1. **MongoDB:** Do you have a MongoDB connection string, or should I use a local Docker MongoDB at `mongodb://localhost:27017/kanjigarden`? *(Default: local Docker.)*
2. **Avatar storage:** Local disk (`server/uploads/`), Cloudflare R2, or AWS S3? *(Default: local disk for development, with an adapter interface so R2/S3 can be swapped later.)*
3. **Google OAuth:** Do you have real Google OAuth credentials, should I scaffold the button but leave it disabled with a "Coming soon" tooltip, or should I remove it entirely? *(Default: scaffold disabled.)*
4. **Friends / social:** The spec includes two social achievements but no friends UI. Do you want a minimal friends feature (add by email, see each other's weekly XP) in Phase 7, or should social achievements be deferred and removed from the seed? *(Default: defer and remove social achievements from the seed.)*
5. **Audio:** Do you want bundled MP3 sound effects and CDN-hosted reading audio, or should I use the browser's Web Speech API (`ja-JP`) for readings and generate sound effects via Web Audio API at runtime? *(Default: Web Speech API for readings, Web Audio API for effects — zero binary assets, zero licensing friction.)*

After I answer, show me the planned file tree (3 levels deep) and a single `mockups.html` file rendering the dashboard, review session (revealed state), and kanji detail screens using the exact design system in §3. **Do not write application code until I approve the mockups.** Once approved, proceed to Phase 0.

---

## 1. Product Identity

- **Name:** Kanji Garden
- **Tagline:** "Plant kanji. Watch them grow."
- **Elevator pitch:** A spaced-repetition kanji app that treats your kanji knowledge like a garden — seeds you plant, sprout into reviews, and grow into a forest as your streak and mastery compound.
- **Positioning:** For serious learners who want Anki-grade SRS without Anki-grade friction, and Duolingo-grade motivation without Duolingo-grade filler.
- **Anti-positioning:** Not a mascot app, not casual-habit gamification, not a dictionary, not a social network, not anime-themed, not aesthetic-over-substance.

**Visual references:** Anki desktop review screen (focus, keyboard-first), Linear.app dashboard (density, hierarchy), Things 3 (microcopy tone), Jisho.org kanji detail (stroke-order clarity), NHK Easy News (Japanese typography), Stripe dashboard (skeletons, empty states).

---

## 2. Anti-Slop Rules (Hard Constraints)

1. No purple, pink, or violet gradients anywhere.
2. No glassmorphism (backdrop-blur cards over blurred backgrounds).
3. No emoji in UI. Use SVG (Lucide or custom) for every icon. Emoji allowed only inside user-generated content.
4. No stock or AI-generated illustrations. Illustrations are inline minimal-line SVGs (max 2 colors, 1.5px stroke).
5. No drop shadows with opacity > 0.12. No glow effects. Shadows are structural only.
6. No border radius above 16px for cards/buttons/inputs. Pills (9999px) only for tags and avatars. No pill-shaped buttons.
7. No centered hero text in app screens. Left-aligned, top-aligned except dedicated celebration screens.
8. No generic copy. "Welcome back!", "Let's get started!", "Great job!", "You're on a roll!", "Oops!" are banned. Every string is specified in §7.
9. No generic empty states. Every empty state has a specific SVG, a headline naming the missing thing, a one-line explanation, and a specific CTA.
10. No `alert()`, `confirm()`, or `prompt()`. Use toasts and modals.
11. No `lorem ipsum`, no placeholder content.
12. No `Loading...` text. Every async state has a skeleton or progress indicator.
13. No rounded-rectangle "hero" banners at the top of app screens. The top of every screen is a functional header.
14. No shadcn/ui default look. If using Radix primitives (allowed), style every component per this spec.
15. No two-column dashboards on mobile. Mobile is single-column stacked.
16. No custom scrollbars, scroll-hijacking, or parallax.
17. No animated backgrounds or particle effects (except the specified celebration in §7).
18. No bouncy `cubic-bezier` with overshoot. Use the easing in §3.6.
19. No generic fire/streak emoji. The streak indicator is a custom SVG leaf that grows with streak tier.
20. No "experimental" settings toggles. Everything ships fully.

---

## 3. Design System (Fixed — Do Not Deviate)

### 3.1 Color Palette

Define in `client/src/styles/tokens.css`. Dark mode via `[data-theme="dark"]`.

**Light mode:**

| Token | Value | Use |
|---|---|---|
| `--bg-canvas` | `#FAF7F2` | warm rice paper |
| `--bg-surface` | `#FFFFFF` | cards |
| `--bg-subtle` | `#F2EDE4` | section backgrounds |
| `--ink-primary` | `#1A1713` | sumi ink |
| `--ink-secondary` | `#4A4438` | body text |
| `--ink-muted` | `#8A8578` | labels |
| `--border-subtle` | `#E5DFD3` | default borders |
| `--border-strong` | `#C9C2B2` | emphasis borders |
| `--accent-vermillion` | `#C1432E` | primary action, hanko seal red |
| `--accent-vermillion-hover` | `#A83726` | |
| `--accent-indigo` | `#2E4374` | informational |
| `--accent-indigo-hover` | `#24365C` | |
| `--success-matcha` | `#6B8E4E` | success |
| `--warning-persimmon` | `#D9772E` | warning |
| `--danger-crimson` | `#B33A3A` | error |
| `--focus-ring` | `#C1432E` | focus |

**Dark mode:**

| Token | Value |
|---|---|
| `--bg-canvas` | `#15130F` |
| `--bg-surface` | `#1F1C17` |
| `--bg-subtle` | `#2A2620` |
| `--ink-primary` | `#F5F0E6` |
| `--ink-secondary` | `#C9C2B2` |
| `--ink-muted` | `#8A8578` |
| `--border-subtle` | `#2E2A23` |
| `--border-strong` | `#4A4438` |
| `--accent-vermillion` | `#E05A3F` |
| `--accent-vermillion-hover` | `#F06B50` |
| `--accent-indigo` | `#6B8EC4` |
| `--accent-indigo-hover` | `#8AABDB` |
| `--success-matcha` | `#8FBF70` |
| `--warning-persimmon` | `#E8944A` |
| `--danger-crimson` | `#D95A5A` |
| `--focus-ring` | `#E05A3F` |

**SRS rating colors (review buttons only):** Again = `--danger-crimson`, Hard = `--warning-persimmon`, Good = `--success-matcha`, Easy = `--accent-indigo`.

### 3.2 Typography

Load via Google Fonts `<link>` in `index.html`.

- Display / headings: `Fraunces` (variable, opsz 9–144, weight 400–700)
- Body / UI: `Instrument Sans` (400–600)
- Monospace / numbers: `Geist Mono` (400–500)
- Japanese UI labels: `Noto Sans JP` (400–500)
- Kanji display: `Noto Serif JP` (400–500)

Scale (rem = 16px):

| Token | Font size / line height |
|---|---|
| `--text-xs` | 0.75rem / 1rem |
| `--text-sm` | 0.875rem / 1.25rem |
| `--text-base` | 1rem / 1.5rem |
| `--text-lg` | 1.125rem / 1.75rem |
| `--text-xl` | 1.375rem / 1.875rem |
| `--text-2xl` | 1.75rem / 2.125rem |
| `--text-3xl` | 2.25rem / 2.5rem |
| `--text-4xl` | 3rem / 3.25rem |
| `--text-kanji-xl` | 6rem / 1 |
| `--text-kanji-2xl` | 10rem / 1 |

Weights: 400 body, 500 UI labels/buttons, 600 headings, 700 display numbers only.

### 3.3 Spacing Scale

4px base unit. Tailwind scale: `0, 1 (4), 2 (8), 3 (12), 4 (16), 5 (20), 6 (24), 8 (32), 10 (40), 12 (48), 16 (64), 20 (80), 24 (96)`. Screen padding: `px-4` mobile, `px-6` tablet, `px-8` desktop. Content max-width 1200px, centered.

### 3.4 Radii

Buttons and inputs: `6px`. Cards: `8px`. Modals: `12px`. Tags/avatars: `9999px`.

### 3.5 Borders & Shadows

- Borders: `1px solid var(--border-subtle)`; `var(--border-strong)` for emphasis.
- Shadows: `--shadow-sm: 0 1px 2px rgba(26,23,19,0.04)` (cards); `--shadow-md: 0 2px 6px rgba(26,23,19,0.06)` (modals); `--shadow-lg: 0 4px 12px rgba(26,23,19,0.08)` (dropdowns). No others.

### 3.6 Motion

- `--ease-out: cubic-bezier(0.22, 1, 0.36, 1)` for enters.
- `--ease-in: cubic-bezier(0.4, 0, 1, 1)` for exits.
- Durations: `--duration-fast: 120ms`, `--duration-normal: 220ms`, `--duration-slow: 380ms`, `--duration-celebration: 800ms`.
- No animation over 800ms except the level-up celebration.
- Respect `prefers-reduced-motion: reduce` — set all transition durations to `0.01ms`.

### 3.7 Iconography

- Lucide React for UI icons. Stroke width 1.75. Sizes: 16px inline, 20px button, 24px nav.
- Custom SVG illustrations only for empty states and celebrations: minimal line art, 2 colors max (vermillion + ink), 1.5px stroke.
- No emoji, no icon fonts, no React Icons, no Heroicons.

### 3.8 Approved Libraries

**Frontend:** React 19, React Router v7, TanStack Query v5, Zustand, react-hook-form, Zod, Tailwind CSS, lucide-react, Radix UI primitives (headless only, style yourself), framer-motion (celebration + sheet transitions only), howler (audio, if bundling), `@tanstack/react-virtual` (kanji grid), `@tanstack/react-table` (statistics), recharts (statistics charts), kuroshiro + kuroshiro-analyzer-kuromoji (furigana at render time).

**Backend:** express, mongoose, zod, jsonwebtoken, bcrypt, cookie-parser, cors, helmet, express-rate-limit, date-fns, date-fns-tz, dotenv, pino, nanoid, fast-xml-parser (seed only), adm-zip or unzipper (seed only).

**Testing:** vitest, @testing-library/react, @testing-library/user-event, supertest, mongodb-memory-server.

Do not add any other dependency without updating `DECISIONS.md` and asking me first.

---

## 4. Voice & Tone

**Voice:** Warm, considered, a little wry. Treats the reader as a serious adult learner. Never chirpy, never patronizing, never anime-cosplay.

**Do:** Address the user as "you." Use concrete numbers and specific nouns ("3 reviews due"). Use sentence case for headings and buttons ("Start review"). Keep copy short.

**Don't:** Use exclamation marks except in the level-up modal (max one). Use "we" for the product. Use "let's." Use "oops," "uh oh," "whoops." Use "awesome," "amazing," "great," "nice," "cool." Use "gamified," "AI-powered," "personalized" in UI.

**Japanese usage:** Kanji always in `Noto Serif JP`. Furigana in `<ruby>` when teaching readings — small, muted, above kanji. Romaji only as a pronunciation hint on first encounter, never as the primary reading. Japanese words in English copy are italicized (`<em>`). No gratuitous Japanese ("Ganbatte!" is banned unless in the celebration modal). Achievement names may include Japanese where specified in §11.3.

**Banned → approved:**

| Banned | Approved |
|---|---|
| "Welcome back, Yuki!" | "17 due" |
| "You're on a 5-day streak! Keep it up!" | "5-day streak" |
| "Start your daily lesson" | "Start review" |
| "Oops! That's not right." | "Not quite — it's 火 (hi)." |
| "Loading..." | skeleton |
| "No achievements yet" | "Nothing unlocked. Your first review unlocks Hajimemashite." |
| "Great job! You earned 50 XP!" | "50 XP" (toast, with XP bar filling) |
| "Let's get started!" | "Three questions, then you're in." |
| "Your progress" | "This week" |
| "Select a JLPT level" | "Which level are you studying for?" |

---

## 5. Content & Data Specification (Comprehensive — All 13,108 Kanji)

### 5.1 Scope

Seed **all 13,108 kanji in KANJIDIC2**. Do not limit to JLPT levels, Jōyō, or Jinmeiyō. The app is a comprehensive kanji learning system, not a curated course. JLPT levels are a filter on top of the full dataset, not the boundary of it. "All kanji" means the KANJIDIC2 set: 6,355 from JIS X 0208, 5,801 from JIS X 0212, and 952 additional from JIS X 0213 (with 2,743 overlapping between X 0212 and X 0213).

### 5.2 Download sources (seed time only — never runtime)

**KANJIDIC2:**
`https://www.edrdg.org/kanjidic/kanjidic2.xml.gz` — gzipped XML, UTF-8, 13,108 entries. Authoritative for meanings, on/kun readings, name readings, stroke count, grade, frequency, radical, and Unicode codepoint.

**KanjiVG:**
`https://github.com/KanjiVG/kanjivg/releases/latest` — download the `kanjivg-YYYYMMDD-all.zip` asset, which contains all SVG files including variant forms. Each SVG filename is the lowercase hexadecimal Unicode codepoint of the kanji (e.g., `065e5.svg` for 日).

**jmdict-simplified:**
`https://github.com/scriptin/jmdict-simplified/releases/latest` — download the `jmdict-eng-*.json` file (English JMdict as structured JSON). This is the easiest-to-parse form of JMdict.

**Tatoeba:**
`https://downloads.tatoeba.org/exports/sentences.tar.bz2` and `https://downloads.tatoeba.org/exports/links.tar.bz2` — the official exports directory. If per-language exports are available under `per_language/jpn/`, prefer those to reduce download size; otherwise filter the global sentences file to `jpn` and `eng` rows after extraction.

**kanjiapi.dev:**
`https://kanjiapi.dev/v1/kanji/all`, `https://kanjiapi.dev/v1/kanji/joyo`, `https://kanjiapi.dev/v1/kanji/jinmeiyo`, and `https://kanjiapi.dev/v1/kanji/{character}` for enrichment (JLPT levels, official-list membership). Rate-limit to 10 requests/second and cache every response in `.data/kanjiapi/` so reruns are instant.

### 5.3 Merge strategy

1. Parse KANJIDIC2 first into a map keyed by Unicode codepoint (from `<codepoint><cp_value cp_type="ucs">`).
2. Attach the KanjiVG SVG by computing the filename from the codepoint. If missing, set `strokeOrderSvg: null` and `hasStrokeOrder: false`. KanjiVG does not cover every KANJIDIC2 character — expect roughly 2,000 without SVGs.
3. Enrich with kanjiapi.dev `jlpt` field. If null, store `jlptLevel: null`. The UI must handle nulls — these kanji appear only under "All," not under any JLPT tab.
4. Tag official-list membership: `isJoyo`, `isJinmeiyo`, `isKyouiku` (grade 1–6).
5. Attach example words from jmdict-simplified. For each kanji, find 2–4 words containing it, preferring words where the kanji is one of ≤2 characters and words marked `common: true`. Store an empty array when no matches exist.
6. Attach one example sentence from Tatoeba (Japanese with English translation). Prefer sentences of ≤20 Japanese characters that contain the target kanji. Store an empty array when no match exists.
7. Attach radical mnemonic by looking up the kanji's radical in `server/data/radical-mnemonics.json`.

### 5.4 Fields per kanji document

`character`, `unicode` (hex string), `meanings[]`, `readingsOn[]`, `readingsKun[]`, `nameReadings[]`, `jlptLevel` (5–1 or null), `grade` (1–8 or null; 8 = Jinmeiyō), `strokeCount`, `radical` (traditional radical character), `radicals[]`, `components[]`, `strokeOrderSvg` (raw SVG string or null), `hasStrokeOrder` (boolean), `frequencyRank` (null if absent), `isJoyo`, `isJinmeiyo`, `isKyouiku`, `exampleWords[]`, `exampleSentences[]`, `mnemonic`.

`exampleWords[]`: `{ word, reading, meaning, jlptLevel?, common }`.
`exampleSentences[]`: `{ japanese, english, audioUrl? }`.

Do not store furigana markup per sentence. Generate furigana at render time with kuroshiro — storing markup for 13,000 sentences is wasteful.

### 5.5 Indexes (critical at 13,108 documents)

- `character` — unique
- `unicode` — unique
- `jlptLevel` — sparse
- `strokeCount`
- `isJoyo`, `isJinmeiyo`
- Text index on `meanings` with language `"english"`
- Compound index `{ jlptLevel: 1, frequencyRank: 1 }` for the default learn ordering

### 5.6 Radicals collection

Build from KANJIDIC2's `<radical>` elements and KanjiVG radical metadata. There are ~214 traditional radicals. Write `server/data/radical-mnemonics.json` with one mnemonic per radical. Style: "The water radical — three droplets splashing." Store `{ character, meaning, mnemonic, strokeCount, variants[] }` (variants handle forms like 亻 for 人). Kanji documents reference their radical by character; the detail page joins to this collection.

### 5.7 Seed counts and coverage report

- 13,108 kanji
- ~214 radicals
- 25 achievements (§11.3) — or 23 if social achievements are deferred per §0.1 Q4
- ~12 quests (§6.7)
- Example words: present where JMdict has matches (expect ~10,000+ kanji with at least one)
- Example sentences: present where Tatoeba has matches (expect ~8,000+)
- The seed script must print a coverage report at the end: total kanji, kanji with SVG, kanji with example words, kanji with example sentences, kanji with JLPT level, kanji tagged Jōyō / Jinmeiyō. Do not treat partial coverage as a failure — comprehensive means comprehensive, including the gaps.

### 5.8 Licensing and attribution (required)

Create a `/licenses` route listing every source, its license, and a link to the original project. Add a footer link: "Data sources and licenses."

- KANJIDIC2 — Creative Commons Attribution-ShareAlike 4.0 (EDRDG). Attribution required.
- KanjiVG — Creative Commons Attribution-ShareAlike 3.0. Include the KanjiVG copyright notice in the footer and on `/licenses`.
- JMdict / jmdict-simplified — Creative Commons Attribution-ShareAlike 4.0 (EDRDG).
- Tatoeba — CC BY 2.0 FR. Attribution required.

Shipping a comprehensive kanji app without attribution violates these licenses. This is not optional.

### 5.9 Seed idempotency and caching

Cache every download in `.data/` (gitignored). If a file already exists, skip the download — reruns must be fast and idempotent. Use `bulkWrite` in batches of 500 and log progress every 1,000 documents. The full pipeline (download + parse + upsert) should take 5–15 minutes on a normal connection. Document this in `README.md`.

---

## 6. Features (Exhaustive)

Every feature below ships. If a feature is listed, it must be in the app.

### 6.1 Onboarding (new users only)

Three-step modal after registration:

1. **Level:** "Which level are you studying for?" — N5, N4, N3, "Not sure yet." Selecting a level pre-loads that JLPT's kanji into the SRS queue (all N5 kanji if "Not sure"). The comprehensive dataset is still fully browsable regardless of this choice.
2. **Pace:** "How many reviews per day?" — 10 (relaxed), 20 (steady), 40 (intense). Sets `dailyReviewLimit`.
3. **Reminders:** "When should I remind you?" — 9am, 8pm (local time), or "Not now." Stores `reminderTime` and `reminderEnabled`.

Skip button bottom-right ("Skip for now — use defaults"). Progress dots (1/3, 2/3, 3/3).

### 6.2 Dashboard (`/`)

Exact layout in §7.1.

### 6.3 Kanji browser (`/learn`)

Exact layout in §7.3. Must use server-side pagination and virtualization — never render 13,108 DOM nodes.

### 6.4 Kanji detail (`/kanji/:character`)

Exact layout in §7.4. Handles `hasStrokeOrder: false`, empty example words, and empty example sentences with specific copy.

### 6.5 SRS review session (`/review`)

Exact layout in §7.2. Includes undo (4-second window), skip, suspend ("bury for 7 days"), and keyboard shortcuts.

### 6.6 Quiz modes (`/quiz`)

- Multiple choice (meaning)
- Reading match (on-yomi or kun-yomi)
- Stroke-order tap
- Drawing canvas (stroke-overlap scoring, not ML — document the algorithm in `DECISIONS.md`)
- 60-second sprint (mixed modes; correct +3s, wrong −5s)

### 6.7 Daily quests

3 quests per user per day, rotating from 12 definitions:

1. Review 10 cards
2. Review 20 cards
3. Get 5 answers correct in a row
4. Complete 1 quiz session
5. Get a 100% accuracy quiz session
6. Earn 100 XP
7. Learn 3 new kanji
8. Clear all due reviews
9. Complete a drawing-canvas quiz
10. Complete a stroke-order quiz
11. Review before 10am
12. Review after 8pm

Each quest: title, description, target, progress, XP reward (20–50), coin reward (5–15). Progress persists across the day and resets at local midnight. Completing all 3 grants a "Daily sweep" bonus of +30 XP.

### 6.8 Streaks

Per §11.4. Includes streak repair: if a streak breaks, offer repair for 100 coins (once per calendar month).

### 6.9 Statistics (`/stats`)

- Heatmap calendar (last 365 days, GitHub-style) showing reviews per day
- Accuracy line chart (last 30 days)
- Forecast bar chart (upcoming 30 days of due reviews)
- JLPT progress (stacked bars: new / learning / review / mastered)
- Best/worst days (top 5 and bottom 5 by accuracy, minimum 10 reviews)

Use recharts with the palette from §3.1 — never default recharts colors.

### 6.10 Achievements (`/profile` → Achievements tab)

25 achievements per §11.3. Each shows icon, name (with Japanese where specified), description, unlock date (or "Locked" + progress).

### 6.11 Store (`/store`)

- Streak freeze (50 coins, max 2 active)
- XP boost (100 coins, 1.5× XP for 24h)
- Title cosmetics (25–75 coins): "The Diligent", "Kokoro no Tsuchi", "Yama no Ue"
- Avatar frames (100 coins): 3 custom SVG frames

No loot boxes, no gambling mechanics, no real money. Coins are earned only through play.

### 6.12 Leaderboards (`/leaderboard`)

Weekly (resets Monday 00:00 UTC) and all-time. Top 100 + sticky current-user row. Shows rank, avatar, display name, equipped title, XP.

### 6.13 Profile & settings

Avatar, display name, Japanese level, timezone, theme (auto/light/dark), daily review limit, daily goal XP, sound effects on/off, haptics on/off, furigana (always/on hover/never), reminder time, logout, delete account (type name to confirm).

### 6.14 PWA

`manifest.json` with app name, icons (192, 512, maskable), theme color `--accent-vermillion`, background `--bg-canvas`, `display: standalone`. Service worker via `vite-plugin-pwa` caching the app shell, kanji data, and review queue. Offline review: queue submissions in IndexedDB when offline, sync on reconnect. Show a subtle "Offline — reviews will sync when you reconnect" banner.

### 6.15 Accessibility

WCAG 2.1 AA minimum. All interactive elements keyboard-focusable with a visible focus ring (`outline: 2px solid var(--focus-ring); outline-offset: 2px`). All images/SVGs have `aria-label` or are `aria-hidden="true"` if decorative. Form inputs always have `<label>`. Color is never the only signal. Screen-reader tested on dashboard, review session, and kanji detail. `prefers-reduced-motion` respected throughout. Contrast ≥ 4.5:1 for body text, ≥ 3:1 for large text.

### 6.16 Global keyboard shortcuts

- `?` — shortcuts overlay
- `/` — focus search
- `g d` — dashboard, `g l` — learn, `g r` — review, `g s` — stats, `g p` — profile
- In review: `1/2/3/4` — Again/Hard/Good/Easy, `Space` — reveal, `u` — undo, `s` — skip, `x` — suspend
- `Esc` — close any modal

---

## 7. Screen-by-Screen Specification

### Global chrome

**Top nav (desktop, ≥ 768px):** Left = wordmark "Kanji Garden" in Fraunces 600, 20px, ink-primary, with small tagline "植物" (Noto Serif JP) in ink-muted, 12px. Center = Dashboard, Learn, Review, Quiz, Stats. Active link has a 2px vermillion underline with 8px offset. Inactive = ink-secondary. Right = streak pill (leaf icon + count), XP amount (Geist Mono 14px), avatar (32px circle, 1px border).

**Top nav (mobile, < 768px):** Left = wordmark only. Right = avatar (28px) + hamburger. Bottom tab bar fixed: Home, Learn, Review, Stats, Profile. Icons 24px, labels 10px. Active = vermillion. `border-top: 1px solid var(--border-subtle)`, safe-area-inset-bottom padding.

**Page container:** max-width 1200px, centered, `px-4` mobile / `px-6` tablet / `px-8` desktop. `pt-6 pb-24` mobile (bottom bar space), `py-8` desktop.

**Toasts:** top-right desktop, top-center mobile. Max width 360px, 8px radius, `--bg-surface`, `--border-subtle`, shadow-md. Auto-dismiss 4s. Icon + message + optional action. Never modal, never blocking.

### 7.1 Dashboard (`/`)

Vertical stack, max-width 720px on desktop.

**Header row:** `h1` "Today" (Fraunces 600, text-3xl). Right = date "Wednesday, March 12" (ink-muted, text-sm).

**Streak card** (`--bg-surface`, 8px radius, 1px border, 24px padding):

- Left = custom SVG leaf, 32px. Filled `--success-matcha` if streak > 0, outlined `--ink-muted` if 0. Tiered growth: 1–6 = single leaf; 7–13 = leaf pair; 14–29 = small branch; 30+ = branch with blossom; 100+ = branch with blossoms + petals.
- Middle = streak count (Geist Mono 28px) + "day streak" (ink-muted, text-sm). If 0: "Start a streak today" (ink-secondary).
- Right = 7-day dot grid: 7 circles (8px), filled matcha if reviewed that day, outlined otherwise. Day labels below (M T W T F S S).
- If streak ≥ 7: 1px progress bar at the bottom showing progress to the next milestone (14, 30, 60, 100) with label "10 days to Sakura."

**Daily goal card** (`--bg-surface`, 8px radius, 1px border, 24px padding):

- Left = circular progress ring, 64px diameter, 5px stroke, background `--border-subtle`, fill `--accent-vermillion`. Center: XP number (Geist Mono 20px) + "XP" (ink-muted, text-xs).
- Right = "Daily goal" (ink-muted, text-xs, uppercase, letter-spacing 0.05em), `50 / 100 XP` below. If goal met: matcha checkmark + "Goal met" in matcha; the whole card border turns matcha.

**Due reviews card** (only if > 0 due):

- `--bg-surface`, 8px radius, 1px border, 24px padding.
- Left = due count in Fraunces 700, text-4xl, "due now" below (ink-secondary, text-sm).
- Right = primary button "Start review" (vermillion bg, white text, 8px/16px padding, 6px radius, weight 500) with arrow-right icon 16px.
- If 0 due: card becomes `--bg-subtle`, no border, single line: "All caught up — next review at 14:30" (ink-secondary) with clock icon.

**Daily quests section** (32px below due card):

- `h2` "Daily quests" (Fraunces 500, text-lg) + right "Resets in 6h 42m" (Geist Mono, ink-muted, text-xs).
- 3 stacked quest cards, 12px padding, `--bg-surface`, 8px radius, 1px border.
- Each: left 20px custom SVG icon; middle title (ink-primary, text-sm, weight 500) + 4px progress bar (`--border-subtle` bg, `--accent-indigo` fill); right `+30 XP` (Geist Mono, text-xs, ink-muted) + coin icon + count.
- Completed: `--bg-subtle` bg, checkmark replaces progress bar, title strikethrough in ink-muted, `✓ 30 XP` in matcha.

**Mini leaderboard** (32px below quests):

- `h2` "This week" (Fraunces 500) + right link "Full leaderboard →" (vermillion, text-sm).
- Top 5 rows: rank (Geist Mono, ink-muted, 24px width), avatar (28px), name + equipped title (title ink-muted, text-xs), XP right-aligned (Geist Mono). Current user's row has `--bg-subtle` bg and a "you" indicator.

**Empty state** (brand-new user, no reviews ever):

- Single centered card: custom SVG (seed sprouting, minimal line, 200px), headline "Your garden is empty" (Fraunces 500, text-2xl), subtitle "Start by adding kanji to your review queue. N5 takes about 3 weeks at 20 reviews per day." (ink-secondary, max-width 400px), primary button "Browse N5 kanji" → `/learn?jlpt=5`.

### 7.2 Review session (`/review`)

Full-screen, distraction-free. Nav hidden on mobile (only bottom bar); top nav hidden on desktop except a subtle back arrow left, card counter center, "?" shortcuts right.

**Container:** max-width 640px, centered, `pt-24` desktop / `pt-16` mobile.

**Progress bar:** full width, 4px height, `--border-subtle` bg, `--accent-vermillion` fill.

**Card front:** kanji at `--text-kanji-xl` (6rem), Noto Serif JP 400, centered, `min-height: 8rem` to prevent layout shift. If furigana is on, `<ruby>` above the kanji. "Show answer" button below (20px gap): vermillion, full-width mobile, 320px centered desktop, 12px padding.

**Card back:** kanji smaller (4rem). Below (16px gap), a card (`--bg-surface`, border, 8px radius, 20px padding):

- Meaning(s): ink-primary, text-lg, weight 500, joined with " · ".
- Readings: `<ruby>` blocks. On-yomi label "On" (uppercase, ink-muted, text-xs, letter-spacing), readings in Noto Sans JP. Kun-yomi below with "Kun". Each reading has a volume-2 icon (14px, ink-muted) that plays audio.
- Example word: 20px gap, border-top `--border-subtle`, 16px padding. Word (Noto Serif JP, text-xl), reading (ink-muted, text-sm), meaning (ink-secondary, text-sm).
- Mnemonic (if exists): "Remember:" in vermillion small caps + mnemonic in ink-secondary italic.

**Rating buttons** (20px below card, flex row, 8px gap desktop; 2×2 mobile):

- Again (crimson border + text, white bg), Hard (persimmon), Good (matcha), Easy (indigo).
- 12px vertical padding, 6px radius, text-sm weight 500, with `1`/`2`/`3`/`4` shortcut in ink-muted below the label.
- On click: 220ms fill animation in the rating color, text becomes white, then card transitions out.

**Keyboard footer (desktop only):** "Space to reveal · 1–4 to rate · U to undo · S to skip · X to suspend" (Geist Mono, ink-muted, text-xs, centered, 24px top margin).

**Undo:** After rating, a 4-second "Undo" toast bottom-left with the previous rating. Clicking or `U` reverts via a compensating server transaction. After 4s or any other key, undo is discarded.

**Session summary:** centered card, max-width 480px. Custom SVG (garden grows one stage, 180px), headline "17 reviews" (Fraunces, text-4xl) + "completed" (ink-muted, text-sm). Stats row: "Accuracy 88% | +210 XP | Streak 12 days" — Geist Mono numbers, ink-muted labels. If goal met: matcha banner "Daily goal met" + checkmark. Primary "Continue" → dashboard. Secondary "Review again" (outline) → refresh due list; disabled with "All caught up" if none.

**Empty state (no due cards):** centered card, muted leaf SVG, headline "Nothing due" (Fraunces 500, text-2xl), subtitle "Next review is scheduled for 14:30 today" (ink-secondary), secondary "Browse kanji" → `/learn`.

### 7.3 Kanji browser (`/learn`)

**Header:** `h1` "Learn" (Fraunces 600, text-3xl). Right = search input (280px, `--bg-surface`, border, 6px radius, search icon inside left, placeholder "Search kanji, meaning, or reading").

**Filters:** Segmented tabs N5 | N4 | N3 | All. Active = vermillion underline, ink-primary. Below (16px gap), horizontal scrollable radical pills: radical character + count. Active pill = `--bg-subtle`, border-strong. Secondary filters row: "Sort by" (Frequency, Stroke count, JLPT), "Status" (All / Learning / Mastered).

**Grid:** desktop 6 columns, tablet 4, mobile 3, gap 16px. Each cell: card with kanji (Noto Serif JP, 3rem), meanings truncated to one line (ink-secondary, text-xs, ellipsis), and a 6px progress dot — matcha filled if mastered, half-filled indigo if learning, outlined if new. Hover: border-strong + shadow-sm, 120ms. Click → `/kanji/:character`.

**Pagination:** Server-side pagination, 50 per page with a "Load more" button, and virtualization via `@tanstack/react-virtual` once the loaded list exceeds 200 items. Do not fetch all 13,108 at once. Debounce search at 250ms and query the server, not a client-side array.

**Empty state (no results):** custom SVG (empty garden bed), headline "No kanji match those filters" (Fraunces 500), body "Try removing a filter or searching for a meaning." (ink-secondary), button "Clear filters."

### 7.4 Kanji detail (`/kanji/:character`)

Two columns desktop (60/40), stacked mobile.

**Left column:**

- Back link "← Back to Learn" (ink-muted, text-sm).
- Kanji at `--text-kanji-2xl` (10rem), Noto Serif JP 400, centered, `py-12`.
- Inline row: stroke count ("8 strokes") + radical ("Radical: 日") in ink-muted text-sm, dot separator.
- **Stroke order card:** `--bg-surface`, border, 8px radius, 20px padding. Above SVG: "Stroke order" (Fraunces 500, text-lg) + right-aligned play/pause (16px), speed toggle "1× / 0.5×", reset. SVG viewBox 109×109, paths `stroke: var(--ink-primary); stroke-width: 3; fill: none;`. Initially strokes `--ink-muted`; on play, each stroke draws via `stroke-dasharray` over 400ms, staggered 200ms. Current stroke highlighted vermillion. Stroke numbers as SVG `<text>` in Geist Mono 8px, ink-muted. If `hasStrokeOrder: false`, replace the SVG with: "Stroke-order data isn't available for this kanji." (ink-secondary, text-sm, 80px padding, centered).
- **Readings:** two-column grid (stacked mobile). Left card "On-yomi" (uppercase, ink-muted, text-xs) + readings as `<ruby>` chips (Noto Sans JP, text-xl, ink-primary, 8px gap). Each chip has a speaker icon on hover/tap. Right card "Kun-yomi" — same layout.
- **Example words:** `h2` "Words" (Fraunces 500, text-lg). 2–4 cards: word (Noto Serif JP, text-2xl), reading (ink-muted, text-sm), meaning (ink-secondary, text-sm), JLPT badge (small pill, `--bg-subtle`, text-xs). If empty: "No example words for this kanji." (ink-secondary, text-sm).
- **Example sentence:** `h2` "In context". Card with Japanese sentence (Noto Serif JP, text-lg, with `<ruby>` furigana generated by kuroshiro), English translation below (ink-secondary, text-sm), speaker icon top-right. If empty: "No example sentence available." (ink-secondary, text-sm).
- **Mnemonic:** `h2` "Remember it". Vermillion left border 2px, `--bg-subtle` bg, 16px padding, text in ink-secondary italic.

**Right column (sticky):**

- **Add to review** primary button (vermillion, full width). If already added: current SRS state ("Learning · next review tomorrow") + secondary "Remove from review" (outline).
- **Radicals** card: for each radical, character (Noto Serif JP, text-3xl), meaning, mnemonic (ink-secondary, text-sm). Border-top between items.
- **Components** card: same layout, if different from radicals.
- **Related kanji:** 6 sharing a radical or component, 3×2 grid, clickable.

### 7.5 Quiz hub (`/quiz`)

`h1` "Quiz" (Fraunces 600, text-3xl), subtitle "Practice without the pressure of scheduling." (ink-secondary, text-sm, 8px gap).

2×2 grid desktop, stacked mobile. Each mode card: 96px custom SVG icon (minimal line, vermillion + ink), title (Fraunces 500, text-lg), description (ink-secondary, text-sm), count ("From your review queue: 42 kanji"), "Start" button (outline; hover filled vermillion).

Modes:

1. **Meaning quiz** — "Pick the correct meaning for a kanji."
2. **Reading match** — "Pick the correct on-yomi or kun-yomi."
3. **Stroke order** — "Tap the strokes in the correct order."
4. **Drawing canvas** — "Draw the kanji from memory."
5. **60-second sprint** — "Mixed modes, each correct answer adds 3 seconds." (full-width card)

### 7.6 Quiz sessions

Max-width 640px, full-screen.

- **Multiple choice:** kanji at 6rem, question "What does this mean?" (ink-secondary, text-sm, uppercase, letter-spacing). 4 full-width option buttons (`--bg-surface`, border, 6px radius, 12px padding, hover border-strong). Correct: matcha 20% opacity + matcha border + checkmark. Incorrect: crimson 20% + crimson border + x icon, and the correct option gets an arrow pointer. 800ms pause, then next.
- **Reading match:** same, options rendered as `<ruby>`.
- **Stroke order:** kanji with individually tappable KanjiVG paths. Numbers 1–N below in a grid; tap in order. Correct tap: stroke fills vermillion (400ms). Wrong tap: shake (±4px, 200ms) + crimson border flash.
- **Drawing canvas:** 300×300 canvas, faint grid (`--border-subtle` 20%). Prompt above: meaning + readings. Buttons: "Check drawing" (vermillion) + "Clear" (outline). Check runs stroke-overlap against the KanjiVG template. Score 0–100. 85+ = "Correct" (matcha), 60–84 = "Close — try again" (indigo), <60 = "Not quite — see the strokes" (crimson, with template overlay at 30% opacity).
- **Sprint:** timer top-right (Geist Mono, text-2xl). Bar below. Correct +3s (green flash), wrong −5s (red flash). Modes cycle randomly. Ends at 0s. Summary: "You got 14 correct in 60 seconds", XP, best streak.

All modes: keyboard shortcuts (1–4 for MCQ, `Space` to continue). No navigation away during an active session unless confirmed via modal.

### 7.7 Statistics (`/stats`)

- **Heatmap:** full width, 365 days in weekly columns. 12px cell + 2px gap, 6px radius. Empty `--bg-subtle`; 1–5 reviews 20% matcha; 6–15 40%; 16–30 60%; 31–60 80%; 60+ 100%. Month labels above, weekday labels left. Hover tooltip: "March 12 · 23 reviews."
- **Accuracy chart:** line chart, last 30 days, matcha line, dots, `--bg-surface` bg, `--border-subtle` grid. Y 0–100%, X dates.
- **Forecast chart:** bar chart, next 30 days of due counts, indigo bars.
- **JLPT progress:** three rows (N5, N4, N3), stacked bars: new (subtle) + learning (indigo) + review (persimmon) + mastered (matcha). Percentages right.
- **Best/worst days:** two-column card lists. Best = top 5 accuracy. Worst = bottom 5 accuracy, only days with ≥10 reviews.

### 7.8 Profile (`/profile`)

Tabs: Profile | Achievements | Settings.

**Profile:** avatar (128px circle, upload button overlaid bottom-right — vermillion circle 32px with pencil icon), display name (Fraunces 500, text-2xl, inline edit), equipped title (ink-muted, text-sm, click opens picker), level badge (custom SVG shield, vermillion border, level number in Geist Mono), joined date. Below: 3 stat cards — Total XP, Longest streak, Kanji mastered.

**Achievements:** grid of 25 cards, 4-column desktop, 2-column mobile. Locked: 40% opacity, grayscale icon. Unlocked: full color, unlock date. Click → modal with full description and progress bar.

**Settings:** sections — Account, Learning, Appearance, Audio & Haptics, Data. Labels above controls (or right-aligned for toggles). Auto-save with a subtle "Saved" toast.

### 7.9 Leaderboard (`/leaderboard`)

Tabs: Weekly | All-time. Table: Rank | Player | Title | XP. Top 3 rows have a vermillion left border. Current user's row sticky at bottom, `--bg-subtle`, with rank visible. Column headers uppercase, ink-muted, text-xs, letter-spacing 0.05em.

### 7.10 Store (`/store`)

`h1` "Store" + coin balance top-right (coin icon + Geist Mono number). Grid 3 columns desktop, 1 mobile. Each item: 64px custom SVG icon, name, description, price (coin icon + number), "Buy" (vermillion outline; filled on hover). Insufficient funds: disabled button + tooltip "Need 30 more coins." Purchase: modal with item preview + "Confirm purchase" (vermillion) + "Cancel" (ghost).

### 7.11 Auth screens (`/login`, `/register`)

Split layout desktop: left = form (max 400px, vertically centered), right = decorative panel (soft bg, large line-art kanji illustration, tagline). Mobile: form only.

**Login:** wordmark top, `h1` "Sign in" (Fraunces 500, text-3xl), subtitle "Continue your garden." (ink-secondary, text-sm), email input, password input, "Forgot password?" link (vermillion, right-aligned above password), "Sign in" (vermillion, full width), divider "or", "Continue with Google" (outline, inline SVG Google icon, never the emoji), footer "New here? Create an account."

**Register:** same layout. Fields: email, password (min 8 chars, one number, inline strength indicator), display name. `h1` "Create an account", subtitle "Start your garden.", submit "Create account", footer "Already have an account? Sign in."

Validation errors: input border crimson, message below in crimson text-xs with alert-circle icon (14px).

---

## 8. Data Model (Mongoose)

### `users`
`email`, `passwordHash`, `displayName`, `avatarUrl`, `nativeLanguage`, `jlptLevel`, `timezone`, `preferences` (`dailyGoalXP`, `dailyReviewLimit`, `theme`, `furigana`, `soundEnabled`, `hapticsEnabled`, `reminderTime`, `reminderEnabled`), `createdAt`, `lastActiveAt`.

### `kanji`
Fields per §5.4. Indexes per §5.5.

### `radicals`
`character`, `meaning`, `mnemonic`, `strokeCount`, `variants[]`. Index `character` unique.

### `userProgress` (one per user–kanji pair)
`userId`, `kanjiId`, `state` (`new` | `learning` | `review` | `relearning`), `dueDate` (indexed), `interval`, `easeFactor`, `repetitions`, `lapses`, `lastReviewedAt`, `history[]` (`reviewedAt`, `rating`, `previousInterval`, `newInterval`), `suspendedUntil`. Compound index `{ userId, dueDate }`; unique compound `{ userId, kanjiId }`.

### `gamificationProfile`
`userId` (unique), `totalXP`, `currentLevel`, `xpToNextLevel`, `currentStreak`, `longestStreak`, `lastActivityDate`, `coins`, `dailyGoalXP`, `dailyXPProgress`, `unlockedAchievementIds[]`, `equippedTitle`, `xpBoostExpiresAt`.

### `achievements`
`id` (slug), `name`, `description`, `icon`, `category`, `criteria` (structured object, e.g. `{ type: "XP_TOTAL", threshold: 1000 }`), `rewardXP`, `rewardCoins`.

### `quizSessions`
`userId`, `sessionType`, `startedAt`, `completedAt`, `results[]` (`kanjiId`, `correct`, `rating`, `responseTimeMs`), `xpEarned`, `accuracy`.

### `leaderboard`
`period` (`weekly` | `allTime`), `entries[]` (`userId`, `displayName`, `avatarUrl`, `xp`, `rank`). Top 100 per period.

### `quests` (definitions, seeded)
`id`, `title`, `description`, `type`, `target`, `xpReward`, `coinReward`. 12 definitions.

### `userQuests`
`userId`, `date` (YYYY-MM-DD), `questId`, `progress`, `completed`. Compound index `{ userId, date }`.

### `userInventory`
`userId`, `itemId`, `purchasedAt`, `consumedAt`, `active`.

### `sessions`
`userId`, `refreshTokenHash`, `userAgent`, `ip`, `createdAt`, `expiresAt`, `revokedAt`.

---

## 9. API (REST, `/api/v1`)

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Login (access + refresh tokens) |
| POST | `/auth/refresh` | Rotate refresh token |
| POST | `/auth/logout` | Invalidate refresh token |
| GET | `/users/me` | Profile + gamification summary |
| PATCH | `/users/me/preferences` | Update settings |
| GET | `/kanji` | Paginated list with filters (`jlpt`, `strokeCount`, `radical`, `joyo`, `jinmeiyo`, `q`, `page`, `limit`) |
| GET | `/kanji/:character` | Kanji detail + stroke SVG |
| POST | `/progress/add` | Add kanji to SRS queue |
| GET | `/progress/due` | Fetch due review cards |
| POST | `/progress/review` | Submit rating → update SRS + award XP |
| POST | `/review/:cardId/undo` | Reverse last review (4s window) |
| POST | `/review/:cardId/suspend` | Bury card for 7 days |
| GET | `/progress/stats` | Aggregate stats |
| GET | `/gamification/profile` | XP, level, streak, coins, achievements |
| GET | `/gamification/achievements` | All achievements + unlock status |
| POST | `/gamification/store/purchase` | Buy item |
| GET | `/store/items` | List items |
| GET | `/store/inventory` | User purchases |
| GET | `/leaderboard?period=weekly` | Leaderboard |
| POST | `/quiz/start` | Create quiz session |
| POST | `/quiz/:sessionId/answer` | Submit one answer |
| POST | `/quiz/:sessionId/submit` | Finalize → validate + award XP |
| GET | `/quests/today` | Today's 3 quests + progress |
| GET | `/stats/heatmap?range=365` | Heatmap |
| GET | `/stats/forecast?days=30` | Forecast |
| GET | `/stats/accuracy?days=30` | Accuracy |

All endpoints use Zod validation on bodies and query params. Response envelope `{ success, data?, error? }`. Errors: `{ success: false, error: { code, message, fields? } }`. Status codes: 200/201/204/400/401/403/404/409/422/429/500.

---

## 10. SRS Algorithm (SM-2, Modified)

Implement in `server/src/services/srs.js` as a pure function.

```
Input: { state, interval, easeFactor, repetitions, lapses, lastReviewedAt }
Input: rating (0=Again, 1=Hard, 2=Good, 3=Easy)
Output: { state, interval, easeFactor, repetitions, lapses, dueDate }
```

Rules:

- **New:** Again → `learning`, 1m, reps 1. Hard → `learning`, 6m, reps 1. Good → `review`, 1d, reps 1. Easy → `review`, 4d, reps 1.
- **Learning:** Again → 1m, reps stay, state stays `learning`. Hard → 10m. Good → 1d, `review`. Easy → 4d, `review`.
- **Review:** Again → `relearning`, reps 0, lapses +1, interval = `max(1, interval * 0.5)` days, ease −0.20 (floor 1.30). Hard → interval × 1.2, ease −0.15. Good → interval × easeFactor, ease unchanged. Easy → interval × easeFactor × 1.3, ease +0.15 (ceiling 3.00).
- **Relearning:** same as learning but interval floor 10m; exits to `review` on Good/Easy.

Ease factor starts at 2.5 for new cards. Never above 3.0 or below 1.3. The standard SM-2 update is `EF' = EF + (0.1 − (5 − q) × (0.08 + (5 − q) × 0.02))`, clamped to [1.3, 3.0]. Use the rating-to-quality mapping: Again = 0, Hard = 3, Good = 4, Easy = 5.

`dueDate` = `lastReviewedAt + interval` (ms). Same-day intervals round to the nearest minute.

**Mastered** = `state === 'review' && interval >= 180 days`.

Write 20+ unit tests covering every rating path, ease floors/ceilings, relearning exit, and date math across DST boundaries.

---

## 11. Gamification Rules (Exact Numbers)

### 11.1 XP
- Review: Again +2, Hard +5, Good +10, Easy +15.
- Quiz correct: +5. Quiz session complete (≥10 answers): +20. Sprint complete: +30 + (10 × correct).
- Daily goal met: +30 (once/day). First review of the day: +20 (once/day).
- Quest complete: 20–50 XP each. Daily sweep (all 3): +30.
- Achievement unlock: per §11.3.

XP Boost (store): 1.5× all XP for 24h, applied at award time server-side.

### 11.2 Levels
20 levels. XP threshold for level N = `Math.floor(100 * N^1.5)`.
- Level 1: 0. Level 2: 282. Level 5: 1,118. Level 10: 3,162. Level 20: 8,944.

Titles: 1 Seedling · 2 Sprout · 3 Leaf · 4 Sapling · 5 Young Tree · 6 Bough · 7 Branch · 8 Canopy · 9 Grove · 10 Thicket · 11 Copse · 12 Wood · 13 Stand · 14 Forest · 15 Deep Forest · 16 Ancient Woods · 17 Old Growth · 18 Wilder · 19 Mountain · 20 Evergreen.

Level-up modal: custom SVG (garden grows one stage), level number in Fraunces 700 text-6xl, title below, "New title unlocked" if applicable.

### 11.3 Achievements (25)

1. **Hajimemashite** (はじめまして) — First review. +20 XP. Learning.
2. **First Sprout** — Learn 10 new kanji. +50 XP. Collection.
3. **Kokoro** (心) — 7-day streak. +100 XP, 20 coins. Streak.
4. **Tsuki** (月) — 30-day streak. +250 XP, 50 coins. Streak.
5. **Kaze** (風) — 100-day streak. +1000 XP, 200 coins. Streak.
6. **Hundred** — Learn 100 kanji. +200 XP. Collection.
7. **Two Fifty** — Learn 250 kanji. +400 XP. Collection.
8. **The Grove** — Learn 500 kanji. +800 XP, 100 coins. Collection.
9. **N5 Complete** — Master all N5 kanji. +500 XP, 50 coins. Mastery.
10. **N4 Complete** — Master all N4 kanji. +1000 XP, 100 coins. Mastery.
11. **Perfect Ten** — 10 reviews in a row without Again. +50 XP. Learning.
12. **Flawless** — Quiz with 100% accuracy (≥10 questions). +150 XP. Learning.
13. **Speedrun** — 60s sprint with 20+ correct. +100 XP. Learning.
14. **Mizu no Nagare** (水の流れ) — 30-day accuracy ≥ 90%. +300 XP. Learning.
15. **Stroke Master** — 50 stroke-order quizzes at perfect. +250 XP. Learning.
16. **Kaite Miro** (書いてみろ) — 25 drawing quizzes at 85+. +250 XP. Learning.
17. **Morning Person** — 10 reviews before 8am local. +50 XP. Special.
18. **Night Owl** — 10 reviews after 11pm local. +50 XP. Special.
19. **No Missed Days** — Meet daily goal 14 days in a row. +200 XP, 30 coins. Streak.
20. **Level 10** — Reach level 10. +500 XP, 100 coins. Mastery.
21. **Level 20** — Reach level 20. +2000 XP, 500 coins. Mastery.
22. **First Friend** — Add first friend. +50 XP. Social. *(Remove if Q4 says defer.)*
23. **Sensei** — Refer 3 friends who each complete 10 reviews. +200 XP. Social. *(Remove if Q4 says defer.)*
24. **Garden Restored** — Repair a broken streak with coins. +10 XP. Special.
25. **Completionist** — Unlock 20 other achievements. +1000 XP, 200 coins. Mastery.

Each has a custom 24×24 SVG icon, 2 colors max (vermillion + ink, or matcha + ink).

### 11.4 Streak
Increment on the first review of any calendar day in the user's timezone. Reset to 0 if a calendar day passes with no review, unless a streak freeze is active (consume one). Milestones (7, 30, 100) trigger achievements + celebration modal. Repair: if broken within the last 24h, show a dashboard banner: "Your 12-day streak ended yesterday. Repair for 100 coins?" — button + dismiss. One repair per calendar month.

### 11.5 Coins
Earned via achievements, quests, and daily sweep. Spent on store items. Never purchasable with real money. No monetization.

### 11.6 Daily goal
Default 50 XP. Configurable in settings (20 / 50 / 100 / 200). Resets at local midnight. Progress shown on the dashboard ring.

---

## 12. Accessibility

WCAG 2.1 AA. All colors meet 4.5:1 (body) / 3:1 (large) in both themes. Focus ring visible on all interactive elements. Use `<button>` and `<a>`, never `<div onClick>`. Form labels always associated via `<label htmlFor>`. Live regions for toasts (`role="status"`, `aria-live="polite"`). Modals use Radix Dialog (correct focus trap and Escape). Skip link at the top of every page. Screen-reader tested on dashboard, review session, and kanji detail; document results in `A11Y.md`.

---

## 13. Performance Budgets

Lighthouse mobile: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90. FCP < 1.8s on 4G. Main JS chunk < 200KB gzipped; code-split every route. Fonts subset with `font-display: swap`. The kanji browser must never ship the full 13,108-character dataset to the client — fetch 50 per page and debounce search at 250ms. The `/kanji/:character` route loads only that character's document. The text index on `meanings` must exist before the app is considered deployable.

---

## 14. Security Checklist

- bcrypt cost 12.
- JWT access tokens: 15-minute expiry, `httpOnly`, `Secure`, `SameSite=Strict` cookie. Refresh tokens: 7-day expiry, rotated on use, hashed in `sessions`.
- Rate limiting: 100 req/min general, 10 req/min auth.
- Helmet with default CSP (adjusted for Google Fonts and asset hosts).
- Zod validation on every request body and query param; Mongoose schema validation as a second line.
- No `.env` committed. Pre-commit hook rejects `.env`, `*.pem`, `*.key`, `*secret*`.
- All mutations server-authoritative — the client never sends `xpAmount`, `coinsEarned`, `streak`, or `level` as authoritative values.
- CSRF protection on state-changing endpoints (double-submit cookie or `SameSite=Strict`; document the choice in `DECISIONS.md`).

---

## 15. Version Control

- `git init` as the first action, before any file.
- Root `.gitignore`: `node_modules/`, `dist/`, `build/`, `.env`, `.env.*` (except `.env.example`), `*.log`, `coverage/`, `.vite/`, `.DS_Store`, `.vscode/`, `.idea/`, `uploads/`, `.data/`.
- Branching: `main` (deployable) ← `dev` (integration) ← `feat/phase-N-slug`.
- Conventional Commits: `feat(auth): add refresh token rotation`.
- One logical change per commit.
- Tags: `phase-0-complete` through `phase-10-complete`.
- husky + lint-staged: pre-commit runs ESLint + Prettier on staged files (<5s); pre-push runs `npm test`.
- Never `git push`, `git reset --hard`, `git rebase` on shared branches, or `git push --force` without explicit confirmation.
- Show `git log --oneline --graph -15` in every phase summary.
- A phase is not complete if `git status` is dirty.

---

## 16. Testing

**Backend (Vitest + Supertest + mongodb-memory-server):** `srs.js` (20+ cases: all rating paths, all states, ease floors/ceilings, DST), auth (register, login, refresh rotation, revoked token rejection), review flow (submit → progress → XP → achievement check), streak (increment, reset, freeze consumption), purchase (insufficient funds, inventory update, effect applied), leaderboard ordering and tie-breaking.

**Frontend (Vitest + React Testing Library):** dashboard renders streak/XP/due from mocked API; review reveal → rate → undo within 4s → undo rejected after; kanji detail renders SVG and handles `hasStrokeOrder: false`; settings theme toggle persists; empty states render correct copy and CTA.

**E2E (Playwright, optional for MVP):** signup → onboarding → dashboard → review → summary.

---

## 17. Build Phases (11 total — 0 through 10)

Each phase ends with working code, all tests passing, a clean git tree, a tagged commit, and a summary including `git log --oneline --graph -15`.

**Phase 0 — Foundation**
Init git, `.gitignore`, husky + lint-staged, root `README.md`, `.env.example`, `DECISIONS.md`, `CONTRIBUTING.md`. Monorepo scaffold `client/`, `server/`, `shared/` (JSDoc typedefs). Design tokens (`tokens.css`), Tailwind config with custom theme. Install approved libraries. Build `/kitchen-sink` (dev-only) demonstrating every component in light and dark mode side-by-side: buttons (all variants), inputs, selects, toggles, modals, toasts, badges, cards, skeletons, empty states, avatars, tabs. Tag `phase-0-complete`.

**Phase 1 — Auth**
User model, session model, register/login/refresh/logout, JWT middleware, login and register screens (§7.11), auth-protected layout with top nav. Tag `phase-1-complete`.

**Phase 2 — Comprehensive kanji data + browser + detail**
Write `server/scripts/download-data.js`: download KANJIDIC2, KanjiVG release zip, jmdict-simplified JSON, and Tatoeba exports into `.data/`; skip existing files; decompress and extract. Write `server/scripts/seed-kanji.js`: parse KANJIDIC2 into 13,108 records, attach SVG by codepoint, enrich with kanjiapi.dev JLPT levels and official-list tags, attach example words and sentences, upsert in batches of 500, print the coverage report from §5.7. Build the paginated kanji list endpoint, detail endpoint, browser screen (§7.3) with virtualization, and detail screen (§7.4) with stroke animation and all missing-data empty states. Tag `phase-2-complete`.

**Phase 3 — SRS + review session**
`srs.js` with full test suite, `userProgress` model, due/submit/undo/suspend endpoints, review session screen (§7.2). Tag `phase-3-complete`.

**Phase 4 — Gamification core**
`awardXP` service, level calculation, streak service, achievement evaluation, gamification profile endpoints, dashboard screen (§7.1) except quests and mini-leaderboard, level-up modal. Tag `phase-4-complete`.

**Phase 5 — Daily quests + statistics**
Quest definitions seed, `userQuests` model, progress tracking, quests section on dashboard, statistics endpoints and screen (§7.7). Tag `phase-5-complete`.

**Phase 6 — Quiz modes**
Quiz session model, quiz endpoints, quiz hub (§7.5), all five modes including drawing canvas with stroke-overlap scoring. Tag `phase-6-complete`.

**Phase 7 — Store + leaderboard + profile**
Store endpoints, inventory, effect application, store screen (§7.10), leaderboard endpoints and screen (§7.9), profile screen with achievements (§7.8). Tag `phase-7-complete`.

**Phase 8 — Onboarding + settings + polish**
Onboarding flow (§6.1), settings screen (§6.13), global keyboard shortcuts and overlay, toasts/skeletons/empty states on every screen, sound effects (Web Audio or bundled per Q5). Tag `phase-8-complete`.

**Phase 9 — PWA + accessibility + performance**
Service worker, manifest, offline review queue (IndexedDB), WCAG audit against §12, Lighthouse run against §13, `A11Y.md`. Tag `phase-9-complete`.

**Phase 10 — Deployment + docs**
`Dockerfile` + `docker-compose.yml` for local dev with MongoDB, `DEPLOY.md` (Render/Railway backend + Vercel frontend), `ARCHITECTURE.md` (Mermaid or ASCII diagram + data flow), final `README.md` including seed-time expectations (5–15 minutes) and the coverage report explanation, `/licenses` route and footer link. Tag `phase-10-complete`.

---

## 18. Phase-End Review Protocol

After each phase, show me:

**(a)** what was built
**(b)** the file tree of new/modified files
**(c)** `git log --oneline --graph -15` and `git diff --stat` since the last tag
**(d)** any deviations from this spec (there should be none without my approval)
**(e)** the acceptance criteria for that phase and confirmation that each is met
**(f)** wait for my go-ahead before starting the next phase

If at any point you are tempted to deviate from §2 (Anti-Slop Rules) or §3 (Design System) for a "better" result, **stop and ask me first.** Do not silently improve.
```