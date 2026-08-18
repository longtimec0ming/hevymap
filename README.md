# HevyMap

Open-source sub-muscle volume tracker built on the [Hevy](https://hevy.com) API.

Hevy tracks muscle groups coarsely ("chest", "shoulders"). HevyMap pulls your workouts via the Hevy API and allocates every set to fine-grained sub-muscles (front/side/rear delts, upper/mid/lower chest, triceps heads, etc.), visualized on an interactive anatomical body map with weekly volume tracking against evidence-based targets.

One deployment = one user's data. No accounts, no database — all your workout data lives in your browser (IndexedDB) and in Hevy. MIT licensed.

## Stack

- Next.js (App Router), TypeScript (strict), Tailwind CSS + shadcn/ui
- Recharts for trend charts
- IndexedDB (`idb`) for workout cache, localStorage for lightweight prefs
- Deployable on Vercel (hobby tier) or fully local

## Local setup

```bash
git clone https://github.com/longtimec0ming/hevymap.git
cd hevymap
npm install
cp .env.example .env.local   # then fill in HEVY_API_KEY
npm run dev
```

Get a Hevy API key from Hevy Pro → Settings → Developer.

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `HEVY_API_KEY` | yes | Server-side only, used by the Hevy API proxy. Never exposed to the client. |
| `ACCESS_PASSWORD` | no | If set, gates the whole app behind a password form (useful when self-hosting somewhere reachable by others). Unset = no gate. |

## Commands

```bash
npm run dev         # local dev server
npm run build        # production build
npm run test          # Vitest (includes muscle-map validation)
npm run lint            # ESLint
npm run typecheck        # tsc --noEmit
```

## Deploy to Vercel

_Deploy button coming once the app is feature-complete (build step 7)._

## Build status

Tracking `CLAUDE.md`'s build order. Updated as each step lands.

- [x] **Step 1 — Data foundation:** `data/taxonomy.ts` (26 canonical sub-muscles), `muscle-map.json` schema + types, validation tests (sum-to-1.0, valid sub-muscle keys only)
- [x] **Step 2 — Platform:** Hevy API proxy route (`app/api/hevy/[...path]/route.ts`), `lib/hevy.ts` client (pagination, count, incremental sync via `workouts/events`), IndexedDB layer (`lib/storage.ts`) + prefs
- [x] **Step 3 — Volume math:** `lib/volume.ts` fractional set/tonnage allocation math + exercise resolution (override → repo map → inference → coarse fallback), `data/inference-rules.ts` keyword/equipment heuristics, `lib/overrides.ts` localStorage overrides (export/import), tests
- [x] **Step 4 — Muscle map seeding:** `data/muscle-map.json` seeded for all 451 standard Hevy exercises (the account's 11 custom exercises are excluded, per `is_custom`). Confidence: 220 high / 142 medium / 89 low — see [`CONTRIBUTING.md`](./CONTRIBUTING.md) once available for how to propose corrections.
- [ ] **Step 5 — Pages:** dashboard, workouts, history, exercises, settings
- [ ] **Step 6 — Body map:** SVG anatomical figure (front + back, 26 addressable paths), heatmap + drill-down
- [ ] **Step 7 — Ship polish:** access-password middleware, README deploy button, CONTRIBUTING.md

## Docs

- [`PLAN.md`](./PLAN.md) — full product & technical spec
- [`CLAUDE.md`](./CLAUDE.md) — how to work in this repo, build order, hard invariants
- `CONTRIBUTING.md` — coming in step 7, focused on `muscle-map.json` PRs

## License

MIT
