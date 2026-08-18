# CLAUDE.md — HevyMap

Read PLAN.md first. It is the authoritative spec; this file is how to work in this repo.

## What this is
Open-source (MIT) sub-muscle volume tracker for Hevy users. Next.js App Router + TypeScript + Tailwind + shadcn/ui, deployed on Vercel or run locally. No database, no accounts: server is a thin authenticated proxy to the Hevy API; all user data lives in IndexedDB client-side.

## Hard invariants (never violate)
1. `HEVY_API_KEY` is server-side only. It appears exclusively in `app/api/hevy/[...path]/route.ts`. Never in client code, never logged, never in the repo.
2. Every `muscle-map.json` entry's contributions sum to 1.0 ± 0.001. The CI test that enforces this must always pass.
3. Only the 26 canonical sub-muscle IDs from `data/taxonomy.ts` may appear as contribution keys. Coarse groups ("chest", "shoulders") are forbidden in data.
4. All weights stored/computed in kg; convert to lbs only at display time via `lib/units.ts`.
5. Resolution order for exercise mappings: user override → repo map → inference rules → coarse fallback. Estimated mappings must be visibly badged in the UI.

## Build order
1. `data/taxonomy.ts` + muscle-map JSON schema + validation test (everything depends on these)
2. Hevy proxy route + `lib/hevy.ts` (pagination, count, incremental sync) + IndexedDB layer
3. `lib/volume.ts` allocation math + tests
4. Seed `data/muscle-map.json` for the full Hevy standard exercise bank (fetch `/v1/exercise_templates` via the proxy; use EMG-literature-informed heuristics; set honest `confidence` values)
5. Dashboard + workouts + history + exercises + settings pages
6. SVG body map component (front + back, 26 addressable paths, scope selector per PLAN §9) — expect the most iteration here
7. Access-password middleware, README with Deploy button, CONTRIBUTING.md, polish

## Suggested agent split (parallel workstreams)
- **A — Data:** taxonomy, schema, muscle-map seeding, inference rules, validation tests
- **B — Platform:** proxy, Hevy client, sync engine, IndexedDB, units, auth middleware
- **C — UI:** shadcn theme, dashboard/history/workouts/exercises/settings, mapping editor
- **D — Body map:** the SVG asset + component, heatmap scales, drill-down interactions
A and B are independent. C depends on A's taxonomy and B's storage interfaces (agree TypeScript interfaces first, mock behind them). D depends only on taxonomy + a `VolumeByMuscle` interface.

## Conventions
- TypeScript strict; no `any` in `lib/` or `data/`.
- shadcn components via CLI into `components/ui/`; do not hand-roll equivalents; customize the theme in one place (globals/theme tokens).
- All date logic respects the user's week-start setting (default Monday). Use date-fns.
- Warm-up sets excluded from volume by default (Hevy set type flag); respect the settings toggle everywhere volume is computed.
- Client fetches go only to `/api/*` — never directly to api.hevyapp.com.
- Keep `muscle-map.json` alphabetized by exercise name to minimize PR diff noise.
- **Keep `README.md` current.** Any commit that completes a build step, adds a command/env var, or changes setup instructions must update `README.md` in the same commit: tick off the relevant box in its "Build status" checklist, and update Stack/Commands/Environment/Deploy sections if they changed. Treat this the same as updating a test — the task isn't done until README reflects it.

## Commands
- `npm run dev` / `npm run build`
- `npm run test` (Vitest) — includes the full muscle-map validation
- `npm run lint`, `npm run typecheck`

## Environment
- `.env.local`: `HEVY_API_KEY` (required), `ACCESS_PASSWORD` (optional — gate disabled when unset)
- Hevy API base: `https://api.hevyapp.com/v1/`, auth header `api-key`. Key endpoints: `workouts` (paginated), `workouts/count`, `workouts/events?since=`, `exercise_templates` (includes user's custom exercises).
- Verify endpoint details against Hevy's current API docs before implementing the client; do not guess response shapes — fetch a real sample first.

## Definition of done (v1)
- Fresh clone + valid key: full history imports with progress UI; dashboard renders weekly body map correctly on desktop and mobile.
- Body map works at all three scopes: time range, single workout, single exercise.
- Custom exercise flow: appears badged as estimated → user defines mapping → volume recomputes.
- Override export/import round-trips.
- CI green; README deploy button works on a clean Vercel account.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
