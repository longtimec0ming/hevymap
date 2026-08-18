# HevyMap

[![CI](https://github.com/longtimec0ming/hevymap/actions/workflows/ci.yml/badge.svg)](https://github.com/longtimec0ming/hevymap/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Sub-muscle volume tracker for [Hevy](https://hevy.com), open source.

Hevy tracks muscle groups coarsely ("chest", "shoulders"). HevyMap pulls your workouts via the Hevy API and allocates every set to 26 fine-grained sub-muscles (front/side/rear delts, upper/mid/lower chest, triceps heads, and more), visualized on an interactive anatomical body heat map, with weekly volume tracked against evidence-based targets.

Each deployment is your own, private copy: your data lives in Hevy and in your browser. There's no shared hosted app, no accounts, and no database.

## Screenshots

_Coming soon — a screenshot/GIF of the dashboard body map will go here once captured from a real account._

## Requirements

- A **Hevy Pro** account. The Hevy API requires Pro, and HevyMap can't fetch your workouts without it.
- A Hevy API key. In the Hevy app, look under **Settings → Developer** (or the developer settings at [hevy.com](https://hevy.com)) for an option to generate one. Exact wording may vary by app version — if you can't find it, check Hevy's own help docs.

## Run it

### A. Deploy your own copy on Vercel (recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/longtimec0ming/hevymap&env=HEVY_API_KEY,ACCESS_PASSWORD&envDescription=HEVY_API_KEY%20is%20required%20(from%20Hevy%20Pro%20%E2%86%92%20Settings%20%E2%86%92%20Developer).%20ACCESS_PASSWORD%20is%20optional%20%E2%80%94%20leave%20it%20blank%20to%20deploy%20without%20a%20password%20gate.)

This forks the repo into your own GitHub account and prompts for both env vars during setup. It's a private instance of the app on your own Vercel account — nobody else can see your data unless you set `ACCESS_PASSWORD` and share it.

- **`HEVY_API_KEY`** (required) — your key from Hevy Pro.
- **`ACCESS_PASSWORD`** (optional) — if your deployment is reachable on the open internet (which any default Vercel URL is), set this so random visitors can't load your workout data. Leave it blank only if you're comfortable with the URL being unprotected.

### B. Run it locally

```bash
git clone https://github.com/longtimec0ming/hevymap.git
cd hevymap
npm install
cp .env.example .env.local   # then fill in HEVY_API_KEY
npm run dev
```

Open `http://localhost:3000`.

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `HEVY_API_KEY` | yes | Server-side only, used by the Hevy API proxy. Never exposed to the client. |
| `ACCESS_PASSWORD` | no | If set, gates the whole app behind a password form — set this for any deployment reachable by others. Unset = no gate. |

### Commands

```bash
npm run dev         # local dev server
npm run build       # production build
npm run test         # Vitest (includes muscle-map validation)
npm run lint         # ESLint
npm run typecheck   # tsc --noEmit
```

## Privacy & security

- Your Hevy API key is read only by the server-side proxy route and is never sent to the browser, logged, or stored anywhere but your own deployment's environment variables.
- Your workout data is cached in your browser's IndexedDB. It isn't sent to any third-party server or database — HevyMap doesn't run one.
- No accounts, no sign-up, no telemetry or analytics.
- Because each deployment is single-user, set `ACCESS_PASSWORD` on any copy reachable from the open internet (this is the default for a Vercel deploy).

## Features

- **Dashboard** — body heat map for the current period, with a timeframe selector (rolling 7 days, calendar week, calendar month, custom range, or all-time), summary stats, and a neglect radar for under-trained muscles.
- **History** — trend lines and week-over-week comparisons, with the 26 sub-muscles grouped under their 6 coarse regions.
- **Workouts** — your full history from Hevy, each workout and exercise expandable into its own body map.
- **Exercises** — a searchable mapping browser showing how every exercise splits across sub-muscles, confidence badges, and an editor for defining your own splits (needed for custom exercises, and to override any mapping you disagree with).
- **Settings** — kg/lbs units, warm-up-set toggle, per-muscle weekly targets, override export/import, and a force re-sync button.

## How the muscle mapping works

Every standard Hevy exercise has an entry in [`data/muscle-map.json`](./data/muscle-map.json): the exercise ID, its name, and a set of sub-muscle contribution weights that sum to exactly 1.0. A set of Incline Bench Press, for example, might allocate 0.55 to upper chest, 0.25 to front delt, and the rest split across the triceps heads — one hard set is one hard set's worth of stimulus, distributed across whatever it actually trains. Each entry also carries a `confidence` level (`high` / `medium` / `low`) so you can see at a glance which splits are well-established versus best-effort guesses.

Exercises resolve in this order: your own override (set in the mapping editor) → the repo's `muscle-map.json` → keyword/equipment-based inference rules → a coarse fallback. Anything below a repo-defined mapping is visibly badged "estimated" in the UI, since custom Hevy exercises and unmapped standard ones can't ship with a verified split. If you spot a mapping you think is wrong, or want to improve a `low`-confidence entry, see [`CONTRIBUTING.md`](./CONTRIBUTING.md) — mapping PRs are the highest-value way to contribute, since a better split helps every user immediately on their next sync.

## Roadmap

Out of scope for v1, but plausible future directions:

- Multi-user / shared deployments
- Integrations with other fitness trackers (e.g. Garmin)
- Scheduled summaries (Telegram/email)
- Per-set RIR/intensity weighting

## Limitations

- Bodyweight exercises count sets normally, but tonnage only reflects logged *added* weight, not bodyweight itself.
- Custom Hevy exercises (yours, not the standard bank) always need a mapping defined manually — there's no way to ship one in the repo since their IDs are per-account.
- Some standard-exercise mappings are still `low`-confidence best-effort guesses. These are flagged in the UI and in `muscle-map.json`; contributions to firm them up are welcome.

## Contributing / architecture

For details on the muscle-map schema, the sum-to-1.0 rule, confidence levels, and how to submit a mapping PR, see [`CONTRIBUTING.md`](./CONTRIBUTING.md). The full technical/product spec this project was built against lives in [`PLAN.md`](./PLAN.md), if you want the deeper architecture picture.

## License

[MIT](./LICENSE)
