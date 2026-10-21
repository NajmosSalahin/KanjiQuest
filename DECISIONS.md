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

### Server secrets in development

`JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` may be empty outside production (dev/test fallbacks). Production requires both, ≥32 chars, plus `MONGODB_URI` — enforced by Zod in `config/env.js`. No `.env` is ever committed (pre-commit + `.gitignore`).

### ESLint scope

Phase 0 ships core ESLint (flat config) + `eslint-config-prettier` only — exactly what the spec's husky/lint-staged requirement needs. React-specific plugins (`eslint-plugin-react-hooks` etc.) are not in the approved library list; add them here (and ask the owner) before installing.

### Client DOM test environment

Not installed in Phase 0 (see "Open questions").

### Mockup-only values (not product behavior)

- Quest/leaderboard figures shown in `mockups.html` are illustrative (within spec ranges).
- Milestone name mapping used in the mockup: **30 = "Sakura"** (label format from `prompt.md` §7.1: "10 days to Sakura."). Names for 14 / 60 / 100 are still unspecified — owner input needed in Phase 4.
- Sample radical mnemonics in the mockup stand in for `server/data/radical-mnemonics.json`.

## Open questions (ask before implementing)

1. **`jsdom` / `happy-dom`** — RTL (`@testing-library/react`, approved) needs a DOM environment under Vitest; neither is in the approved list. To add in Phase 1 when the first client test lands?
2. **Milestone names** — is 30 = "Sakura"? What are 14 / 60 / 100?
3. **Quest titles** — §6.7 lists 12 phrases (e.g. "Review 10 cards"); are they the titles themselves, or do you want separate title + description copy?
