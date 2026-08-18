# Contributing to HevyMap

The main thing worth contributing here is **`data/muscle-map.json`** — the
open-source mapping from Hevy's standard exercises to sub-muscle
contribution splits. This file is HevyMap's crown jewel (see PLAN.md §5):
better mappings make every user's volume tracking more accurate,
immediately, on their next sync.

Code contributions (bug fixes, new features) are welcome too, but the
sections below focus on `muscle-map.json` PRs since that's the highest-value,
lowest-friction way to contribute.

## The schema

Each entry in `data/muscle-map.json` is one Hevy exercise template:

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

- `hevy_id` — the exercise template's ID from Hevy's `/v1/exercise_templates`
  endpoint. Don't invent or guess this; it must match a real template ID.
  Do not edit an existing entry's `hevy_id`.
- `name` — the exercise's display name, matching Hevy's.
- `contributions` — a map of sub-muscle ID → fraction of a hard set that
  exercise allocates to that muscle. Keys **must** be one of the 26 canonical
  sub-muscle IDs in `data/taxonomy.ts` (`front_delt`, `side_delt`,
  `rear_delt`, `upper_chest`, `mid_chest`, `lower_chest`, `lats`,
  `upper_traps`, `mid_traps_rhomboids`, `lower_traps`, `spinal_erectors`,
  `biceps`, `brachialis_brachioradialis`, `triceps_long`, `triceps_lat_med`,
  `forearms`, `rectus_abdominis`, `obliques`, `quads_rectus_femoris`,
  `quads_vasti`, `hamstrings`, `glute_max`, `glute_med`, `adductors`,
  `gastrocnemius`, `soleus`). Coarse groups like `"chest"` or `"triceps"` are
  **not valid keys** — always resolve to the sub-muscle level.
- `confidence` — `"high"`, `"medium"`, or `"low"` (see below).
- `notes` — optional. Use it to record assumptions (grip width, angle,
  stance) that materially change the split, so reviewers and future
  contributors know what the numbers assume.

## The sum-to-1.0 rule

Every entry's `contributions` values must sum to `1.0 ± 0.001`. One hard set
of an exercise is exactly one hard set's worth of stimulus, distributed
across whichever sub-muscles it hits — it can't sum to more or less than 1.

This is enforced automatically: `data/validate-muscle-map.test.ts` runs
`validateMuscleMap()` (in `data/validate-muscle-map.ts`) against the real
`data/muscle-map.json` file as part of `npm run test`, which also runs in CI
on every push and PR. A PR that breaks the sum rule, or uses a
non-canonical key, will fail CI — fix it locally before pushing (see
"Checking your change" below).

## Picking an honest confidence level

Be honest here — the badge is user-facing (exercises using `medium`/`low`
confidence, or falling back to inference, are visibly flagged as
"estimated" in the UI) and drives which mappings the community should
prioritize reviewing.

- **`high`** — you're confident in the split from EMG literature, clear
  biomechanics (e.g. an isolation exercise that overwhelmingly hits one
  muscle), or strong consensus among lifters/coaches. Little room for
  disagreement.
- **`medium`** — a reasonable, defensible split, but one where form
  variation, individual anatomy, or thin literature means someone could
  argue for meaningfully different numbers.
- **`low`** — a best-effort guess. Use this for exercises with sparse EMG
  data, unusual or compound movement patterns that are hard to decompose,
  or where you're genuinely unsure. Low-confidence entries are exactly what
  this project wants community review on — don't round up to `medium` to
  make it look more finished.

If you're revising an existing entry, feel free to raise (or lower) its
confidence to match your revision — just make sure the `notes` field
explains why, especially if you're overriding someone else's prior
high-confidence call.

## Alphabetization

`data/muscle-map.json` is kept alphabetized by `name` (case-sensitive,
ascending) to keep PR diffs small and reviewable — adding one exercise in
the middle of a 400+-entry array should touch one line, not reorder the
file. When adding a new entry, insert it in alphabetical position rather
than appending to the end.

## Checking your change locally

Before opening a PR:

```bash
npm install
npm run test        # includes the muscle-map sum/key validation against the real file
npm run typecheck
npm run lint
```

`npm run test` is the one that matters most for a data-only PR — it will
tell you exactly which entry and which rule failed if something's off. All
three run in CI on your PR; a red CI check means something above didn't
pass.

## Opening the PR

- One exercise (or a small, related batch) per PR is easiest to review.
- In the PR description, briefly say what informed the split (EMG source,
  biomechanical reasoning, personal lifting experience) — this is
  effectively what the `notes` field is for, but expanding on it in the PR
  itself helps reviewers who aren't familiar with the exercise.
- If you're correcting an existing entry rather than adding a new one,
  explain what was wrong with the old split.

Code contributions outside `muscle-map.json` (new inference rules, UI
fixes, etc.) follow the same `npm run test && npm run typecheck && npm run
lint` bar — see CLAUDE.md in the repo root for the fuller set of
conventions (hard invariants, TypeScript strictness, date/week-start
handling, etc.) if you're touching application code.
