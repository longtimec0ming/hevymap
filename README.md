# HevyMap

[![CI](https://github.com/longtimec0ming/hevymap/actions/workflows/ci.yml/badge.svg)](https://github.com/longtimec0ming/hevymap/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Sub-muscle volume tracker for [Hevy](https://hevy.com), open source.

Hevy tracks muscle groups coarsely ("chest", "shoulders"). HevyMap pulls in your workouts — via the Hevy API or a free CSV export, your choice — and allocates every set to 26 fine-grained sub-muscles (front/side/rear delts, upper/mid/lower chest, triceps heads, and more), visualized on an interactive anatomical body heat map, with weekly volume tracked against evidence-based targets.

Each deployment is your own, private copy: your data lives in Hevy and in your browser. There's no shared hosted app, no accounts, and no database.

## Screenshots

_Coming soon — a screenshot/GIF of the dashboard body map will go here once captured from a real account._

## Requirements

You need Hevy workout data to get in, but **not** Hevy Pro. Two ways to connect, chosen on first run:

- **A Hevy API key** — requires Hevy Pro. Get one from the Hevy app under **Settings → Developer** (or the developer settings at [hevy.com](https://hevy.com); exact wording may vary by app version — check Hevy's own help docs if you can't find it). You can either set this once in the deployment's environment (`HEVY_API_KEY`), or paste it into the app itself the first time you open it — no redeploy needed.
- **A Hevy CSV export** — free, no Pro required. In the Hevy app: **Settings → Export data**. Upload the file on first run; it's parsed entirely in your browser and never leaves your device.

## Run it

### A. Deploy your own copy on Vercel (recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/longtimec0ming/hevymap&env=HEVY_API_KEY,ACCESS_PASSWORD,HEVYMAP_SECRET&envDescription=All%20optional.%20HEVY_API_KEY%20pre-connects%20a%20Hevy%20Pro%20API%20key%20(you%20can%20also%20paste%20one%20in-app%2C%20or%20import%20a%20free%20CSV%20export%2C%20instead).%20ACCESS_PASSWORD%20gates%20the%20app%20behind%20a%20password.%20HEVYMAP_SECRET%20keeps%20an%20in-app-connected%20key%20across%20restarts.)

This forks the repo into your own GitHub account and prompts for the env vars during setup — all optional, leave any of them blank. It's a private instance of the app on your own Vercel account — nobody else can see your data unless you set `ACCESS_PASSWORD` and share it.

- **`HEVY_API_KEY`** (optional) — your key from Hevy Pro, if you'd rather set it once here than paste it into the app. Leave blank to connect in-app instead (via a pasted key or a CSV upload).
- **`ACCESS_PASSWORD`** (optional) — if your deployment is reachable on the open internet (which any default Vercel URL is), set this so random visitors can't load your workout data. Leave it blank only if you're comfortable with the URL being unprotected.
- **`HEVYMAP_SECRET`** (optional) — see [Bring your own API key](#bring-your-own-api-key) below. Only matters if you're connecting a key in-app rather than setting `HEVY_API_KEY`.

### B. Run it locally

```bash
git clone https://github.com/longtimec0ming/hevymap.git
cd hevymap
npm install
cp .env.example .env.local   # optional: fill in HEVY_API_KEY, or connect in-app instead
npm run dev
```

Open `http://localhost:3000`. On first run, either connect your Hevy API key (in the app, if `HEVY_API_KEY` isn't set) or upload a Hevy CSV export.

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `HEVY_API_KEY` | no | Server-side only, used by the Hevy API proxy. Never exposed to the client. If unset, you can connect a key in-app instead, or use a CSV import. |
| `ACCESS_PASSWORD` | no | If set, gates the whole app behind a password form — set this for any deployment reachable by others. Unset = no gate. |
| `HEVYMAP_SECRET` | no | Encrypts the cookie used to store a key connected in-app (see below). Falls back to `ACCESS_PASSWORD` if that's set, then to a random per-process secret. Only relevant if `HEVY_API_KEY` is unset. |

### Bring your own API key

If `HEVY_API_KEY` isn't set, the first-run screen lets you paste your own Hevy API key instead. It's validated against the real Hevy API, then stored as an **encrypted, httpOnly cookie** — never in `localStorage`/IndexedDB, never sent to client-side JavaScript, never logged. Encryption uses AES-256-GCM, keyed from (in order) `ACCESS_PASSWORD`, then `HEVYMAP_SECRET`, then — if neither is set — a random secret generated once when the server process starts.

That last case has a real tradeoff: **without `ACCESS_PASSWORD` or `HEVYMAP_SECRET` set, a restart or redeploy invalidates the encryption key, so any in-app-connected API key is silently disconnected** and you'll need to reconnect (or re-upload your CSV, or set `HEVY_API_KEY`) next time. Set `HEVYMAP_SECRET` on any real deployment to avoid this. Settings has a "Disconnect" action to clear the cookie deliberately.

### Commands

```bash
npm run dev         # local dev server
npm run build       # production build
npm run test         # Vitest (includes muscle-map validation)
npm run lint         # ESLint
npm run typecheck   # tsc --noEmit
```

## Privacy & security

- A server-configured `HEVY_API_KEY` is read only by the server-side proxy route and is never sent to the browser, logged, or stored anywhere but your own deployment's environment variables.
- A key connected in-app is validated server-side, then stored as an encrypted, httpOnly cookie — never in `localStorage`/IndexedDB, never sent to client-side JavaScript, never logged. See [Bring your own API key](#bring-your-own-api-key).
- A CSV export is parsed entirely in your browser (File API) — it's never uploaded anywhere.
- Your workout data (from either source) is cached in your browser's IndexedDB. It isn't sent to any third-party server or database — HevyMap doesn't run one.
- No accounts, no sign-up, no telemetry or analytics.
- Because each deployment is single-user, set `ACCESS_PASSWORD` on any copy reachable from the open internet (this is the default for a Vercel deploy).

## Features

- **Dashboard** — a compact single-row stat strip (workouts, hard sets, volume, avg volume/workout, hours trained, current streak, most-trained sub-muscle, longest workout) for the selected period with vs-previous-period deltas; the body heat map for the current period (rolling 7 days, calendar week, calendar month, custom range, or all-time) with a neglect radar for under-trained muscles (each row links straight to that muscle's pre-filtered view on Exercises) and, next to it, a click-a-muscle drill-down panel (which exercises fed it this period, plus a "Find exercises" link) and a recent-workouts card; a full-width 12-month consistency heatmap and a full-width sets-by-sub-muscle chart; and further chart cards (sets by muscle group, hours trained, volume progression, workouts, PRs over time) each with its own independent range (ALL/1Y/6M/3M/1M) and week/month bucket toggle. Per-muscle sparklines are tucked behind a collapsible toggle.
- **History** — trend lines and week-over-week comparisons, with the 26 sub-muscles grouped under their 6 coarse regions; hover a sub-muscle's trend card for a link to its pre-filtered view on Exercises.
- **Workouts** — your full history from Hevy; every row shows its muscle-group distribution at a glance, and each workout and exercise expands into its own body map.
- **Exercises** — a searchable, filterable mapping browser: filter by sub-muscle (with a contribution threshold — primary/significant/any), equipment, and source/confidence (repo-map tier, override, estimated, custom-only), sort by name/contribution/confidence, each result showing its top contributions and confidence as chips. Deep-linkable via `/exercises?muscle=<id>&group=<region>` (used by the dashboard's neglect radar, muscle drill-down panel, and History's sub-muscle links) with a dismissible banner showing that muscle's current-week volume vs target. Picking an exercise shows its body-map contribution split next to a compact per-sub-muscle slider editor (grouped by region, lock a value to pin it while adjusting the rest), with confidence/source badges and auto-rebalancing sliders that always sum to 100% (needed for custom exercises, and to override any mapping you disagree with).
- **Settings** — kg/lbs units, warm-up-set toggle, per-muscle weekly targets, override export/import, and (depending on your data source) a force re-sync button, or a re-upload CSV / switch-to-API-key affordance.

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
- CSV imports don't carry Hevy's own exercise IDs (the file has names, not IDs), and can't sync incrementally — re-upload a fresh export to bring in new workouts. CSV exercise names are matched to `muscle-map.json` by exact name (case-insensitive); anything that doesn't match falls to inference/fallback and is badged "estimated", same as an unmapped API exercise.
- Without `ACCESS_PASSWORD` or `HEVYMAP_SECRET` set, an in-app-connected API key is lost on server restart/redeploy (see [Bring your own API key](#bring-your-own-api-key)).

## Contributing / architecture

For details on the muscle-map schema, the sum-to-1.0 rule, confidence levels, and how to submit a mapping PR, see [`CONTRIBUTING.md`](./CONTRIBUTING.md). The full technical/product spec this project was built against lives in [`PLAN.md`](./PLAN.md), if you want the deeper architecture picture.

## License

[MIT](./LICENSE)
