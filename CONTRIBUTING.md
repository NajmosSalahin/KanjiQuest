# Contributing

## Branching (`prompt.md` §15)

```
main   ← deployable, always tagged per phase
 └─ dev        ← integration
     └─ feat/phase-N-slug   ← one branch per phase (or per feature)
```

- Never push directly to `main` (no force-push, no rebase, no `reset --hard` on shared branches without explicit owner confirmation).
- A phase is not complete if `git status` is dirty.

## Commits

Conventional Commits, one logical change per commit:

```
feat(auth): add refresh token rotation
fix(mockups): avatar focusability and persistent rating-fill demo
test(srs): cover ease-factor floor at 1.30
```

## Hooks

- **pre-commit** — `lint-staged`: ESLint `--fix` + Prettier on staged `*.{js,jsx}`, Prettier on `*.{json,css,html,md}`
- **pre-push** — `npm test`

## Testing

- Backend: Vitest + Supertest + mongodb-memory-server (`server/tests/`)
- Frontend: Vitest + React Testing Library (starts Phase 1)
- Every phase ships with green tests.

## Spec discipline

- `prompt.md` is the source of truth for design, copy, and features. Zero creative latitude on §2 (anti-slop) and §3 (design system).
- Unspecified details → ask the owner; approved deviations get a D-id in `DECISIONS.md` and `IMPLEMENTATION_PLAN.md` §3.
- Never add a dependency outside the approved list (`prompt.md` §3.8) without updating `DECISIONS.md` and asking first.

## Phase-end review (`prompt.md` §18)

After each phase, present: (a) what was built, (b) file tree of changes, (c) `git log --oneline --graph -15` + `git diff --stat` since the last tag, (d) deviations, (e) acceptance criteria met, (f) **wait for the owner's go-ahead** before the next phase.
