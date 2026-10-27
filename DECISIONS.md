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

## Implementation notes (deployment — owner-directed early hosting)

### Live preview after every phase (2026-10-22, owner request)

The owner asked to host the site online from Phase 2 onward, watching it grow phase by phase, rather than waiting for Phase 10. This uses the **exact Phase 10 stack early** (Render free-tier API + Vercel free-tier client + Atlas), so Phase 10's `DEPLOY.md`/`ARCHITECTURE.md`/final-hardening obligations are unchanged — they document and finish what's already running. Zero cost.

**Architecture — why a Vercel rewrite proxy:** spec §14 mandates `SameSite=Strict` httpOnly cookies, which browsers never send across _different_ sites. A Vercel-hosted client calling a Render-hosted API directly would therefore be logged out on every request. Fix without touching the security model: Vercel rewrites `/api/*` (and `/health`) to the Render URL, so the browser only ever talks to one origin — cookies stay `SameSite=Strict`, the client's relative `/api/v1` base (`client/src/lib/api.js`) needs no changes, and CSRF double-submit logic is untouched. `deploy/vercel.json.tpl` holds the rewrite template (API URL injected at deploy time); `deploy/deploy-client.ps1` builds the client and deploys `client/dist` per phase.

**Vercel Git integration — disconnected; client deploys are CLI-only (2026-10-27):** connecting the repo during project setup armed Git auto-deploy, and a push to `main` produced a production build _without_ the generated `dist/vercel.json` (the rewrite proxy exists only in the built output, injected by `deploy-client.ps1`). That rewrite-less deployment took over `kanjiquest.vercel.app` and every proxied `/api/*` call 404'd while the Render API stayed healthy — caught by the post-push verification; the aliased deployment's creation time matched the push to the second (forensics: `git-main` alias, 4 s build). Fixed with `vercel git disconnect` + a CLI redeploy, verified by the full 17-check live smoke. The integration must stay off: the repo isn't structured for Vercel Git builds (`client/dist` is gitignored, `vercel.json` is generated per deploy). **Consequence for Phase 10: pushing to `main` deploys the Render API only — the client ships per phase via `deploy-client.ps1 -ApiUrl …`.**

**Render service:** declared via `render.yaml` blueprint (repo root): free web service, `npm install` at repo root (workspaces — `server` depends on `@kanjigarden/shared`), `npm run start -w server`, health check `/api/v1/health`, Node 22. Secrets (`MONGODB_URI`, JWT secrets, `CLIENT_ORIGIN`) are `sync: false` — set in the dashboard/via API, never committed.

**Known free-tier limits (acceptable for previews):** Render free services spin down after ~15 min idle (first request after idle takes ~30–50 s); the ephemeral disk wipes on redeploys (irrelevant until avatar uploads in a later phase); Atlas Network Access must allow Render egress (`0.0.0.0/0` — the owner was advised to rotate the Atlas password given the open allowlist).

## Open questions (ask before implementing)

1. ~~**`jsdom` / `happy-dom`**~~ — resolved Phase 1: `jsdom` added with owner approval.
2. **Milestone names** — is 30 = "Sakura"? What are 14 / 60 / 100?
3. **Quest titles** — §6.7 lists 12 phrases (e.g. "Review 10 cards"); are they the titles themselves, or do you want separate title + description copy?
4. **Password reset** — §7.11 shows a "Forgot password?" link but §9 has no reset endpoints. In scope (Phase 8 polish?) or drop the link?
