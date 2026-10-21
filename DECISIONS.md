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

## Open questions (ask before implementing)

1. ~~**`jsdom` / `happy-dom`**~~ — resolved Phase 1: `jsdom` added with owner approval.
2. **Milestone names** — is 30 = "Sakura"? What are 14 / 60 / 100?
3. **Quest titles** — §6.7 lists 12 phrases (e.g. "Review 10 cards"); are they the titles themselves, or do you want separate title + description copy?
4. **Password reset** — §7.11 shows a "Forgot password?" link but §9 has no reset endpoints. In scope (Phase 8 polish?) or drop the link?
