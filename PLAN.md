# HevyMap — Product & Technical Specification (v1)

Open-source sub-muscle volume tracker built on the Hevy API. One deployment = one user's data. MIT licensed.

**Elevator pitch:** Hevy tracks muscle groups coarsely ("chest", "shoulders"). HevyMap pulls your workouts via the Hevy API and allocates every set to fine-grained sub-muscles (front/side/rear delts, upper/mid/lower chest, triceps heads, etc.), visualized on an interactive anatomical body map with weekly volume tracking against evidence-based targets.

---

## 1. Stack

- Next.js 14+ (App Router), TypeScript, strict mode
- Tailwind CSS + shadcn/ui (CLI-installed, customized dark theme — must NOT look like default shadcn)
- Recharts for trend charts
- IndexedDB (via `idb`) for workout cache; localStorage for lightweight prefs
- No database, no accounts. Stateless server; all user data lives client-side + in Hevy.
- Deployable on Vercel (hobby tier) AND fully runnable locally (`npm run dev`).

## 2. Repo structure

```
hevymap/
├── app/
│   ├── page.tsx                      # Dashboard
│   ├── history/page.tsx              # Trends & week-over-week
│   ├── workouts/page.tsx             # Workout list → per-workout & per-exercise body maps
│   ├── exercises/page.tsx            # Mapping browser + editor
│   ├── settings/page.tsx             # Units, targets, sync, export/import overrides
│   ├── login/page.tsx                # Access password gate (only if ACCESS_PASSWORD set)
│   └── api/
│       ├── auth/route.ts             # Password check → httpOnly session cookie
│       └── hevy/[...path]/route.ts   # Server-side proxy → api.hevyapp.com, injects HEVY_API_KEY
├── components/
│   ├── body-map/                     # SVG anatomy component (front + back)
│   ├── dashboard/                    # Summary strip, neglect radar, sparkline grid
│   ├── mapping-editor/               # Per-exercise contribution editor
│   └── ui/                           # shadcn components
├── data/
│   ├── muscle-map.json               # THE dataset: Hevy exercise ID → sub-muscle weights
│   ├── taxonomy.ts                   # Sub-muscle definitions (see §4)
│   └── inference-rules.ts            # Keyword/equipment rules for unmapped/custom exercises
├── lib/
│   ├── hevy.ts                       # API client: pagination, count, incremental sync
│   ├── volume.ts                     # Fractional set/tonnage allocation math
│   ├── storage.ts                    # IndexedDB cache + prefs
│   └── units.ts                      # kg canonical ↔ lbs display conversion
├── middleware.ts                     # Access-password gate
├── .env.example                      # HEVY_API_KEY=, ACCESS_PASSWORD= (optional)
├── LICENSE                           # MIT
├── CONTRIBUTING.md                   # Focused on muscle-map.json PRs
└── README.md                         # Deploy-to-Vercel button + local quickstart
```

## 3. Security & self-hosting model

- `HEVY_API_KEY` is read ONLY in the server-side proxy route. It must never appear in client bundles, client fetches, the repo, or logs. All browser requests go to `/api/hevy/*`.
- `ACCESS_PASSWORD` (optional): if set, `middleware.ts` gates every route behind a password form; successful login sets an httpOnly, secure, sameSite cookie. If unset (typical local use), no gate.
- README must include: (1) a "Deploy to Vercel" button that forks the repo and prompts for both env vars; (2) local quickstart: clone → `.env.local` → `npm run dev`; (3) where to get a Hevy API key (Hevy Pro, hevy.com developer settings).

## 4. Muscle taxonomy (v2, 32 sub-muscles, locked)

IDs are snake_case and canonical across the codebase.

**Shoulders:** `front_delt`, `side_delt`, `rear_delt`, `rotator_cuff`
**Chest:** `upper_chest`, `mid_chest`, `lower_chest`, `serratus_anterior`
**Back:** `lats_upper`, `lats_lower`, `spinal_erectors`
**Traps:** `upper_traps`, `mid_traps_rhomboids`, `lower_traps`, `neck`
**Arms:** `biceps`, `brachialis_brachioradialis`, `triceps_long`, `triceps_lat_med`, `forearms`
**Core:** `rectus_abdominis`, `obliques`, `hip_flexors`
**Legs:** `quads_rectus_femoris`, `quads_vasti`, `hamstrings`, `glute_max`, `glute_med` (displayed as "Glute Med / Abductors"), `adductors`, `gastrocnemius`, `soleus`, `tibialis_anterior`

v1's 26-muscle taxonomy split `lats` into `lats_upper`/`lats_lower`, pulled `upper_traps`/`mid_traps_rhomboids`/`lower_traps` out of Back into their own **Traps** region (alongside the new `neck`), and added `hip_flexors`, `tibialis_anterior`, `rotator_cuff`, and `serratus_anterior`. Region display order: Shoulders, Chest, Back, Traps, Arms, Core, Legs.

Each taxonomy entry: `{ id, displayName, region, bodySide: "front" | "back" | "both", defaultWeeklyTargetSets: [min, max] }`. Default targets seeded from hypertrophy literature (10–20 hard sets/week for major movers; smaller ranges for small muscles like forearms/soleus). All targets user-editable in settings.

## 5. muscle-map.json (the open-source crown jewel)

One entry per Hevy standard exercise template (~400+). Schema:

```json
{
  "hevy_id": "05293BCA",
  "name": "Incline Bench Press (Barbell)",
  "contributions": {
    "upper_chest": 0.55,
    "front_delt": 0.25,
    "triceps_lat_med": 0.13,
    "triceps_long": 0.07
  },
  "confidence": "high",
  "notes": "Assumes 30–45° incline; steeper biases front delt"
}
```

Rules:
- Contributions MUST sum to 1.0 ± 0.001 (enforced by a unit test that validates the entire file in CI).
- ALL entries resolve to sub-muscle level. Coarse groups ("chest", "triceps") are forbidden as keys.
- `confidence: "high" | "medium" | "low"` — flags where community review is wanted.
- Seed the file from Hevy's `/v1/exercise_templates` bank using exercise-science heuristics (name, equipment, angle keywords, EMG-literature priors). Every standard exercise gets an entry, even if `low` confidence.
- CONTRIBUTING.md explains the schema, the sum rule, and how to PR mapping improvements with rationale.

## 6. Custom exercises & user overrides

- Custom Hevy exercises have per-account IDs → cannot ship in the repo map.
- Resolution order for any exercise: **user override → repo map → inference rules → coarse fallback.**
- Inference rules: use Hevy's coarse muscle tag + name/equipment keywords (e.g. "incline" → upper chest bias; "reverse fly"/"face pull" → rear delt; "close grip" → triceps emphasis; "lateral raise" → side delt). Output is flagged `estimated`.
- Any exercise using inference or fallback is visibly badged "estimated — click to define" throughout the UI, deep-linking to the mapping editor.
- Mapping editor: sliders/inputs per sub-muscle, live sum validation to 1.0, applies to standard AND custom exercises (overriding standard entries covers form differences, e.g. elbow-flared rows → more rear delt).
- Overrides persist in localStorage and are exportable/importable as JSON from settings.

## 7. Data sync & history

- **First run:** full history import. Use `/v1/workouts/count` for a progress bar; paginate `/v1/workouts` until complete. Show a dedicated import screen (this can take a minute for years of history). Store everything in IndexedDB.
- **Subsequent loads:** instant render from IndexedDB, then incremental sync via Hevy's workout events endpoint (changes since last sync timestamp) — handles new, edited, and deleted workouts.
- Settings: "Force full re-sync" button; last-synced timestamp displayed.
- All Hevy calls go through the server proxy; client never sees the key.

## 8. Volume math

- A logged set allocates fractionally: 1 hard set of incline bench = 0.55 sets `upper_chest`, 0.25 `front_delt`, 0.13 `triceps_lat_med`, 0.07 `triceps_long`.
- **Primary metric:** fractional hard sets per sub-muscle per period. **Secondary (toggle):** tonnage (weight × reps, allocated by the same fractions).
- Warm-up sets (Hevy flags them) excluded by default; settings toggle to include.
- Bodyweight exercises: sets count normally; tonnage uses logged added weight only (document this limitation).
- Periods: rolling 7 days, calendar week (user-selectable week start, default Monday), calendar month, custom range.
- Weekly target bands drive heatmap coloring and the neglect radar.

## 9. Body map (hero component)

Custom-built SVG anatomical figure, front + back views, each of the 32 sub-muscles as separately addressable paths (`data-muscle-id`). No third-party anatomy libraries with restrictive licenses — the SVG is an original asset of the repo.

**Scope selector — the body map renders at every level:**
1. **Time range:** rolling 7 days / calendar week / month / custom range / all-time — heatmap colored by volume vs (pro-rated) targets.
2. **Single workout:** from the workouts page, see exactly what one session hit.
3. **Single exercise:** from the mapping browser or a workout's exercise row, the map lights up that exercise's contribution split (this doubles as the mapping editor's live preview).

Interactions: hover tooltip (sets, tonnage, % of target); click a muscle → drill-down panel listing which exercises fed it in the current scope, sorted by contribution. Color scale: cold/desaturated (neglected) → accent (in target band) → hot (above). Include a color-scale legend. Muscles with zero data render as neutral outlines.

## 10. Pages

- **Dashboard:** body map (default: current calendar week) + summary strip (total sets, sessions, tonnage, biggest week-over-week mover) + neglect radar ("rear_delt: 3 sets — 7 below target") + sparkline grid (one per sub-muscle, last 8 weeks).
- **History:** per-sub-muscle trend lines / small multiples across weeks and months; week-over-week comparison table.
- **Workouts:** reverse-chron list from cache; each expands to per-workout body map + exercise rows; each exercise row → per-exercise body map view.
- **Exercises:** searchable mapping browser (shadcn command palette), confidence/estimated badges, mapping editor.
- **Settings:** units (kg default / lbs), week start day, warm-up toggle, per-muscle target editor, override export/import, force re-sync, about/license.

## 11. Units

- Canonical storage: kg (Hevy API returns kg). Conversion at display time only, via `lib/units.ts`. Settings toggle kg/lbs, default kg. Affects tonnage and weight displays only.

## 12. Visual design requirements

- Dark-first, Whoop/Garmin-report energy: near-black background, single restrained accent for the heatmap ramp, generous whitespace, `tabular-nums` for all data.
- Customized shadcn theme (custom radius, palette, font — e.g. Inter or Geist) so it reads bespoke.
- Fully responsive: body map views stack vertically on mobile; dashboard usable one-handed post-workout.
- Empty states, loading skeletons, and the import progress screen all designed, not default.

## 13. Quality bar

- CI (GitHub Actions): typecheck, lint, unit tests. Tests must cover: muscle-map sum validation across the whole file, volume allocation math, unit conversion, inference rules.
- No `any` types in lib/ and data/ layers.
- README screenshots/GIF of the body map once built.

## 14. Out of scope for v1 (document as roadmap in README)

- Multi-user / shared deployments
- Garmin or other integrations (parent Health HQ project)
- Scheduled summaries (Telegram/email) — natural v2 via Vercel Cron
- Per-set RIR/intensity weighting
