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

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/longtimec0ming/hevymap&env=HEVY_API_KEY,ACCESS_PASSWORD&envDescription=HEVY_API_KEY%20is%20required%20(from%20Hevy%20Pro%20%E2%86%92%20Settings%20%E2%86%92%20Developer).%20ACCESS_PASSWORD%20is%20optional%20%E2%80%94%20leave%20it%20blank%20to%20deploy%20without%20a%20password%20gate.)

Forks the repo into your own GitHub account and prompts for both env vars
during setup. Leave `ACCESS_PASSWORD` blank if you don't want the app gated
behind a password (see [Environment variables](#environment-variables)
above).

## Build status

Tracking `CLAUDE.md`'s build order. Updated as each step lands.

- [x] **Step 1 — Data foundation:** `data/taxonomy.ts` (26 canonical sub-muscles), `muscle-map.json` schema + types, validation tests (sum-to-1.0, valid sub-muscle keys only)
- [x] **Step 2 — Platform:** Hevy API proxy route (`app/api/hevy/[...path]/route.ts`), `lib/hevy.ts` client (pagination, count, incremental sync via `workouts/events`), IndexedDB layer (`lib/storage.ts`) + prefs
- [x] **Step 3 — Volume math:** `lib/volume.ts` fractional set/tonnage allocation math + exercise resolution (override → repo map → inference → coarse fallback), `data/inference-rules.ts` keyword/equipment heuristics, `lib/overrides.ts` localStorage overrides (export/import), tests
- [x] **Step 4 — Muscle map seeding:** `data/muscle-map.json` seeded for all 451 standard Hevy exercises (the account's 11 custom exercises are excluded, per `is_custom`). Confidence: 220 high / 142 medium / 89 low — see [`CONTRIBUTING.md`](./CONTRIBUTING.md) once available for how to propose corrections.
- [x] **Step 5 — Pages:** shadcn/ui dark theme (custom tokens in `app/globals.css`, single amber `--brand` accent), dashboard/history/workouts/exercises/settings pages, first-run import screen, `components/body-map/index.tsx` integration contract (now implemented by build step 6). Dashboard has a timeframe selector (rolling 7 days / calendar week / calendar month / custom range / all-time, `components/dashboard/period-selector.tsx`) driving the body map, summary strip, and neglect radar — targets are pro-rated to the period length (weekly target × days/7); all-time compares a weekly-average rate against the unscaled weekly target instead, labeled in the UI. Sparklines stay fixed at 8 weeks regardless of the selector. History and Workouts group the 26 sub-muscles under their 6 coarse regions (`lib/groups.ts`) instead of listing them flat: History's week-over-week table has group subtotal rows with indented sub-muscle rows, its trend charts toggle between 6 group lines and a drilled-in group's sub-muscles, and each workout card's muscle summary is a collapsible per-region accordion.
- [x] **Step 6 — Body map:** `components/body-map/` — hand-authored SVG anatomical figure (front + back, 26 addressable `data-muscle-id` regions), cold→accent→hot heatmap ramp with legend, hover tooltip (sets/tonnage/% of target), click + externally-controlled highlight, keyboard focus. Color/percent math unit-tested in `color-scale.test.ts`. Redrawn as realistic line-art anatomy (`components/body-map/muscle-regions.ts`): curved cubic-bezier contours throughout (a `symmetricContour` helper mirrors centerline shapes like the head/torso, a `teardrop` helper shapes the limb muscles), plus a head/hair silhouette, fingered hands, and shaped feet.
- [x] **Step 7 — Ship polish:** access-password gate (`proxy.ts` — see note below — plus `app/login/page.tsx` and `app/api/auth/route.ts`), `lib/units.ts` kg↔lbs display conversion (wired into the settings toggle, dashboard tonnage, body-map tooltips, workout body maps), GitHub Actions CI (`.github/workflows/ci.yml`), [`CONTRIBUTING.md`](./CONTRIBUTING.md), Vercel deploy button, `LICENSE`

v1 is feature-complete against CLAUDE.md's build order (steps 1–7 all done). See "v1 status" below for an honest read on the Definition of Done checklist, not just a checkbox.

> **Note on `proxy.ts`:** PLAN.md §2 specifies `middleware.ts`. This repo runs Next.js 16, where that file convention is deprecated and renamed to `proxy.ts` (identical behavior, renamed file/export) — see `node_modules/next/dist/docs/.../file-conventions/proxy.md`. The gate lives at `proxy.ts` for that reason.

## v1 status

Honest self-assessment against CLAUDE.md's "Definition of done":

- ✅ **Body map works at all three scopes** — time range (dashboard), single workout, single exercise (workouts page, exercises page) — verified by reading through each call site.
- ✅ **Custom exercise flow** — custom exercises resolve through the override → repo map → inference → fallback chain and are badged "estimated" until a user defines a mapping (`app/exercises/page.tsx`); code-verified, not manually run against a live custom exercise in this session.
- ✅ **Override export/import round-trips** — unit-tested in `lib/overrides.test.ts` (`"export/import round-trips"`, merge/replace modes, and rejection of invalid/malformed input without partial writes).
- ✅ **CI green** — `npm run typecheck`, `npm run lint`, and `npm run test` all pass locally as of this build step; `.github/workflows/ci.yml` runs the same three commands on every push/PR. Not yet observed green on GitHub Actions itself (no push has triggered it yet).
- ⚠️ **Fresh clone + valid key: full history imports with progress UI; dashboard renders correctly on desktop and mobile** — the import screen, progress bar, and responsive layout are all implemented, but this hasn't been exercised end-to-end against a real Hevy account with real history in this session. Worth a manual pass before calling v1 fully proven.
- ⚠️ **README deploy button works on a clean Vercel account** — the button uses Vercel's standard clone-and-prompt-env-vars URL shape pointed at this repo; not yet clicked through on an actual clean Vercel account.

## Screenshots

_TODO: add a screenshot or short GIF of the dashboard body map here (PLAN.md §13). None captured yet — this needs a real running session with actual workout data, not something fabricated._

## Roadmap (out of scope for v1)

Per PLAN.md §14:

- Multi-user / shared deployments
- Garmin or other integrations (parent Health HQ project)
- Scheduled summaries (Telegram/email) — natural v2 via Vercel Cron
- Per-set RIR/intensity weighting

## Docs

- [`PLAN.md`](./PLAN.md) — full product & technical spec
- [`CLAUDE.md`](./CLAUDE.md) — how to work in this repo, build order, hard invariants
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — focused on `muscle-map.json` PRs: schema, sum-to-1.0 rule, confidence levels, alphabetization

## License

[MIT](./LICENSE)
