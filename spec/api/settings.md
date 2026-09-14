# Settings

The settings vocabulary of `route()` and of every acceptance case. Types in
`spec/types/settings.ts`. Units: distances in **micrometres** (converted through the Frame);
times in milliseconds; costs are dimensionless multipliers.

## `RouteSettings`

| Setting | Default | Meaning (observable) |
|---|---|---|
| `maxPasses` | 100 | Upper bound on router passes. A pass sweeps every incomplete connection once. The run stops early when nothing is incomplete or when `maxStagnantPasses` consecutive passes made no progress |
| `maxStagnantPasses` | 3 | See above; 0 disables the stagnation stop |
| `maxItems` | unset | If set, the router completes at most this many connections in the run (fanout and optimiser stages have their own `*MaxItems`); once reached it stops with `stoppedBy: "maxItems"`. A connection counts when its copper is inserted, however many Tracks and Barrels that takes. Used by the suites to freeze a partial result |
| `timeBudgetMs` | unset | Wall-clock budget for the whole `route()` call (fanout + passes + optimiser). On expiry the best snapshot so far is returned with `report.timedOut = true` |
| `connectionBudgetMs` | unset | Wall-clock budget per connection attempt |
| `viaCost` | 50 | Cost of one Barrel between two signal Sheets, in units of one LU-length of track |
| `planeViaCost` | 5 | Cost of one Barrel on a net that owns a plane Sheet (used instead of `viaCost` for that net; dropping into the plane is the cheap way to connect it) |
| `bendCost` | 0 | Extra cost per direction change; `0` means length-only. Higher values yield fewer bends |
| `preferredDirectionCost` | 1.5 | Default `againstCost` for every Sheet (see `layers`). 1 disables the preference |
| `startRipupCost` | 100 | Cost charged for ripping up a `free` other-net item on the first attempt; grows with that item's rip history |
| `ripupEnabled` | true | If false, other-net items are hard obstacles |
| `fanoutEnabled` | false | Run the fanout pre-pass |
| `fanoutMaxPasses`, `fanoutMaxItems` | unset | Bound the fanout stage the way `maxPasses` / `maxItems` bound routing |
| `routerEnabled` | true | Run the routing passes (false: fanout and/or optimiser only) |
| `optimizerEnabled` | true | Run the optimiser after routing completes |
| `optimizerPasses`, `optimizerMaxItems` | unset | Bound the optimiser stage the way `maxPasses` / `maxItems` bound routing |
| `strictDrc` | false | If true, an insertion is refused when it would produce *any* violation, even in regions where the input already violates. If false, insertions are refused only when they add a violation that involves the new item |
| `neckWidthUm` | unset | Minimum width a Track may neck down to on its final leg into a Pad when the full width does not fit |
| `copperToEdgeClearanceUm` | unset | Required spacing between any copper and the Rim; overrides the file's outline clearance |
| `holeClearanceUm` | unset | Required spacing between a drill hole and any other-net copper or any other hole; overrides the file |
| `angleMode` | from file, else `45` | `90`, `45`, or `any`; `report.effectiveSettings.angleMode` is always resolved |
| `layers` | `{}` | Per-Sheet overrides `{ active?, preferDir?: "h" \| "v", alongCost?, againstCost? }`. The cost of one LU of a leg on a Sheet is `alongCost` (default 1) when the leg runs parallel to the Sheet's preferred direction and `againstCost` (default `preferredDirectionCost`) otherwise; a Sheet with no preferred direction uses `alongCost` for every leg. Merged per Sheet and per field: defaults ← file ← caller. No clamping of any cost: values are used as given |
| `viasAllowed` | true | If false, every connection must be completed on one Sheet; Barrels are never inserted |
| `ignoreNetGroups` | `[]` | Names of NetGroups whose nets are neither routed nor counted as incomplete |
| `seed` | 1 | Seed for the router's pseudo-random choices. Same Layout + same settings + same seed ⇒ identical output |
| `shoveEnabled` | true | Push movable free Tracks aside within their slack instead of only ripping them (docs/DESIGN.md §9a). R-1/R-2 hold regardless |
| `shoveWindowUm` | ~3× track pitch | Max perpendicular displacement of one shoved segment |
| `shoveMaxDepth` | 4 | Cascade recursion bound for transitive shoves |
| `shoveMaxMoved` | 12 | Max segments moved in one shove trial |
| `presentCongestionCost` | ~`startRipupCost` | Present-sharing weight in the PathFinder cost; 0 = history-only |
| `orderByDifficulty` | true | Route connections in descending (airline × local congestion) order; false = legacy `(net, id)` |
| `detailedRouter` | `off` (fast) / `tiles` (slow) | Gridless detailed router for locked channels (docs/DESIGN.md §9b): `off`, `lineprobe`, or `tiles` |
| `detailedMaxTiles` | — | Region tile budget for the detailed router |
| `detailedBudgetMs` | — | Per-connection wall-clock cap for the detailed router |

Acceptance cases use short names: `router → routerEnabled`, `optimizer → optimizerEnabled`,
`fanout → fanoutEnabled`, `timeoutSeconds × 1000 → timeBudgetMs`, `optimizerMaxPasses →
optimizerPasses`; `fanoutMaxPasses`, `fanoutMaxItems`, `optimizerMaxItems` map to themselves.

## Default preferred direction

When neither the file nor the caller gives a Sheet a preferred direction, signal Sheets alternate,
and the first signal Sheet prefers the direction of the board's longer side (horizontal when the
Rim's bounding box is at least as wide as it is tall). Plane Sheets have none.

## Settings from the file

A DSN `structure` may carry an `autoroute_settings` block, and a rules file may carry one too
(grammar in `spec/formats/dsn.md`). Entries map as follows; anything else in the block is ignored:

| file entry | field |
|---|---|
| `(vias on/off)` | `viasAllowed` |
| `(via_costs n)` | `viaCost` |
| `(plane_via_costs n)` | `planeViaCost` |
| `(start_ripup_costs n)` | `startRipupCost` |
| `(autoroute on/off)` | `routerEnabled` |
| `(postroute on/off)` | `optimizerEnabled` |
| `(fanout on/off)`, `(start_pass_no n)` | ignored (a stale block must not switch the fanout pre-pass on) |
| `(layer_rule <Sheet> (active …) (preferred_direction horizontal/vertical) (preferred_direction_trace_costs x) (against_preferred_direction_trace_costs y))` | `layers[<Sheet>] = { active, preferDir: "h"/"v", alongCost: x, againstCost: y }` |
| a `layer_rule` naming a Sheet the Stack lacks | that rule is skipped with a `warning`; the rest of the block applies |
| an unknown or mis-spelled keyword | skipped |

A rules file's block, when present, replaces the DSN's block (`applyRules`).
`readDsn` exposes what it found as `layout.settingsFromFile` (a `Partial<RouteSettings>`) and
**does not apply it**; `route()` applies, in order: built-in defaults ← `layout.settingsFromFile`
(only if the caller passes `useFileSettings: true`) ← the caller's `settings`. Acceptance cases of
kind `settings` check the effective settings object returned in `report.effectiveSettings`.

## Determinism

With identical inputs and settings, `route()` produces identical Tracks and Barrels (same
coordinates, same order in `layout.tracks`/`layout.barrels`), except that fields marked advisory
(`wallClockMs`) may differ. Time budgets, when they expire, may change the result; cases that
pin exact counts therefore set budgets generously and are tagged advisory on wall clock.
