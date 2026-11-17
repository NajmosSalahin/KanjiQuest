# Deployment

Kanji Garden runs on free tiers with three pieces:

| Piece  | Host                           | URL                                   |
| ------ | ------------------------------ | ------------------------------------- |
| Client | Vercel (static deploy)         | <https://kanjiquest.vercel.app>       |
| API    | Render (Node web service)      | <https://kanjiquest-api.onrender.com> |
| Data   | MongoDB Atlas (owner-supplied) | via `MONGODB_URI`                     |

The client is a static SPA; it reaches the API through a same-origin rewrite on
Vercel (`/api/*`, `/uploads/*`, `/health`), which keeps the API's
`SameSite=Strict` session cookies working. Render and Vercel free tiers spin
the API down when idle — the first request after a quiet period is slow
(several seconds to a minute); the smoke script tolerates the cold start.

## 1. Database (MongoDB Atlas)

1. Create a free Atlas cluster and a database user.
2. Allow Render's egress (or `0.0.0.0/0` for the free tier) in Network Access.
3. Copy the connection string; it becomes `MONGODB_URI` below.
4. Seed once from your machine (see §4).

## 2. API on Render

The repo contains [`render.yaml`](../render.yaml) — a Blueprint for one free
Node web service named `kanjiquest-api`:

- Build: `npm install`
- Start: `npm run start -w server`
- Health check: `/api/v1/health`
- Node: `22.11.0`

### Blueprint deploy

1. Render Dashboard → **New → Blueprint** → connect the repo.
2. Apply `render.yaml`.
3. Fill the `sync: false` variables in the dashboard (never commit them):

   | Variable             | Required | Notes                                                   |
   | -------------------- | -------- | ------------------------------------------------------- |
   | `MONGODB_URI`        | yes      | Atlas connection string                                 |
   | `JWT_ACCESS_SECRET`  | yes      | long random string                                      |
   | `JWT_REFRESH_SECRET` | yes      | different long random string                            |
   | `CLIENT_ORIGIN`      | yes      | `https://kanjiquest.vercel.app`                         |
   | `BREVO_API_KEY`      | yes*     | *password-reset email; `EMAIL_PROVIDER=brevo` is preset |

   Already set by the blueprint: `NODE_ENV=production`, `STORAGE_DRIVER=mongo`,
   `EMAIL_PROVIDER=brevo`, `EMAIL_FROM`, `EMAIL_FROM_NAME`.

4. Deploy. `NODE_ENV=production` makes session cookies `Secure` and keeps
   avatar bytes in Mongo (`STORAGE_DRIVER=mongo`) so Render's ephemeral disk
   cannot lose them.

### Manual service (or Railway)

Any Node host works: build `npm install`, start `npm run start -w server`,
health check `/api/v1/health`, and the same environment variables. Railway's
service settings accept the same commands and variables; add a public domain
and point `CLIENT_ORIGIN` at the Vercel URL. No Docker/MongoDB add-on is
needed (D1).

### Auto-deploy and verification

Render auto-deploys every push to `main`. Confirm the live commit instead of
trusting the dashboard:

```bash
render deploys list srv-dbd08ge7bikc73a42b6g --output json
```

## 3. Client on Vercel

The client is **not** built by Vercel from Git. `deploy/deploy-client.ps1`
builds `client/dist`, injects `deploy/vercel.json.tpl` with the API URL
(rewrites for `/api/*` and `/health`, security headers), and deploys the static
output with the Vercel CLI:

```powershell
.\deploy\deploy-client.ps1 -ApiUrl https://kanjiquest-api.onrender.com
```

Requirements: `vercel login` once and `VERCEL` CLI on `PATH`. The script runs
`npm run build -w client` first, so a failed build never ships.

> **Keep Vercel Git integration disconnected.** A Git-triggered build would
> publish `client/` without the generated `dist/vercel.json`, removing the
> `/api/*` proxy and breaking auth (this happened once; see DECISIONS.md).
> Pushes to `main` deploy the Render API only; ship the client explicitly.

The generated `vercel.json` adds `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY`, and `Referrer-Policy: strict-origin-when-cross-origin`,
and rewrites SPA routes to `index.html`.

## 4. Seeding and migrations (once per database)

Run these locally with `MONGODB_URI` pointing at the target database. They are
idempotent upserts and cache downloads in `server/.data/`.

```bash
npm run download-data -w server
npm run seed-radicals -w server
npm run seed-kanji -w server
npm run seed-achievements -w server
npm run seed-quests -w server
```

Expect **5–15 minutes** end to end; `seed-kanji` finishes with the §5.7
coverage report (total, SVG, words, sentences, JLPT, Jōyō/Jinmeiyō). Missing
sources for rare kanji are expected and are not errors.

Upgrading an existing database: run the highest applicable
`npm run migrate-XXX -w server` (e.g. `migrate-100`) once.

## 5. Password-reset email (Brevo)

`EMAIL_PROVIDER=brevo` sends resets through Brevo's HTTPS API. Set
`BREVO_API_KEY` in the Render dashboard only; `EMAIL_FROM` must be a verified
sender. In development (`EMAIL_PROVIDER=console`) the reset link is logged
instead of emailed. Test with “Forgot password?” on the live login page.

Never echo, commit, or write the key into a tracked file; the pre-commit hook
also rejects secret-looking filenames.

## 6. Docker (local only)

`Dockerfile` and `docker-compose.yml` build the API and an nginx-served client
on <http://localhost:8080>. There is no Mongo service (D1); compose reads
`MONGODB_URI` from `.env` and runs the API with `NODE_ENV=development` because
local HTTP cannot use `Secure` cookies. See D27: these files were statically
reviewed but not run-tested on the build machine. Render continues to run the
native Node service above.

```bash
copy .env.example .env   # fill MONGODB_URI + JWT secrets
docker compose up --build
```

## 7. Post-deploy verification

Run the live smoke suite after both deploys:

```bash
node deploy\smoke.mjs
```

It exits non-zero on failure and ends with `=== 84/84 passed ===`. It covers
health through the proxy, auth/cookies, CRUD, SRS, gamification, quests, quiz,
store, leaderboard, stats, uploads, licenses, security headers, PWA assets, and
SPA fallbacks. The script creates `smoke+<timestamp>@example.com` and removes
that user when local DB access is available.

Per-phase release order: tests → build → commit/push `main` + `dev` → verify
the Render deploy → deploy the client → smoke → tag
`phase-N-complete` / `vX.Y.Z`.

## 8. Troubleshooting

| Symptom                                    | Likely cause / fix                                                                             |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `/api/*` 404 on the Vercel URL             | Client was deployed without generated `vercel.json`; rerun the deploy script.                  |
| Login sets a cookie but requests are guest | Check `CLIENT_ORIGIN`, the rewrite proxy, and that the API is `NODE_ENV=production` on Render. |
| First request takes ~30–60 s               | Render free-tier cold start; retry.                                                            |
| 502/520 from the proxy                     | API restarted or cold; wait, then rerun smoke.                                                 |
| Password-reset email never arrives         | `BREVO_API_KEY`, verified `EMAIL_FROM`, and `EMAIL_PROVIDER=brevo`.                            |
| Avatars vanish after a deploy              | `STORAGE_DRIVER` must be `mongo` in production.                                                |
| Empty kanji list after a fresh deploy      | Seed the database (§4) against the production `MONGODB_URI`.                                   |
