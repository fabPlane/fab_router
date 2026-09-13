# Settings

The settings vocabulary of `route()` and of every acceptance case. Types in
`spec/types/settings.ts`. Units: distances in **micrometres** (converted through the Frame);
times in milliseconds; costs are dimensionless multipliers.

## `RouteSettings`

| Setting | Default | Meaning (observable) |
|---|---|---|
| `maxPasses` | 100 | Upper bound on router passes. A pass sweeps every incomplete connection once. The run stops early when nothing is incomplete or when `maxStagnantPasses` consecutive passes made no progress |
| `maxStagnantPasses` | 3 | See above; 0 disables the stagnation stop |
| `maxItems` | unset | If set, the router stops as soon as inserting the next Track or Barrel would make the Layout's routed item count (Tracks + Barrels it added) exceed this number. Used by cases to freeze a partial result |
| `timeBudgetMs` | unset | Wall-clock budget for the whole `route()` call (fanout + passes + optimiser). On expiry the best snapshot so far is returned with `report.timedOut = true` |
| `connectionBudgetMs` | unset | Wall-clock budget per connection attempt |
| `viaCost` | 50 | Cost of one Barrel between two signal Sheets, in units of one LU-length of track |
| `planeViaCost` | 100 | Cost of a Barrel that passes a plane Sheet |
| `bendCost` | 0 | Extra cost per direction change; `0` means length-only. Higher values yield fewer bends |
| `preferredDirectionCost` | 1.5 | Multiplier on leg length when a leg runs against its Sheet's preferred direction (`preferDir`). 1 disables the preference |
| `startRipupCost` | 100 | Cost charged for ripping up a `free` other-net item on the first attempt; grows with that item's rip history |
| `ripupEnabled` | true | If false, other-net items are hard obstacles |
| `fanoutEnabled` | false | Run the fanout pre-pass |
| `routerEnabled` | true | Run the routing passes (false: fanout and/or optimiser only) |
| `optimizerEnabled` | true | Run the optimiser after routing completes |
| `optimizerPasses` | unset | Upper bound on optimiser passes |
| `strictDrc` | false | If true, an insertion is refused when it would produce *any* violation, even in regions where the input already violates. If false, insertions are refused only when they add a violation that involves the new item |
| `neckWidthUm` | unset | Minimum width a Track may neck down to on its final leg into a Pad when the full width does not fit |
| `copperToEdgeClearanceUm` | unset | Required spacing between any copper and the Rim; overrides the file's outline clearance |
| `holeClearanceUm` | unset | Required spacing between a drill hole and any other-net copper or any other hole; overrides the file |
| `angleMode` | from file, else `45` | `90`, `45`, or `any` |
| `layers` | `{}` | Per-Sheet overrides: `{ active?: boolean, preferDir?: "h" \| "v", againstCost?: number }` |
| `viasAllowed` | true | If false, every connection must be completed on one Sheet; Barrels are never inserted |
| `ignoreNetGroups` | `[]` | Names of NetGroups whose nets are neither routed nor counted as incomplete |
| `seed` | 1 | Seed for the router's pseudo-random choices. Same Layout + same settings + same seed ⇒ identical output |

Acceptance cases use the same names, plus `timeoutSeconds` (= `timeBudgetMs / 1000`) and the
sub-run limits `fanoutMaxPasses`, `fanoutMaxItems`, `optimizerMaxPasses`, `optimizerMaxItems`,
which bound the fanout and optimiser stages the same way `maxPasses` / `maxItems` bound routing.

## Settings from the file

A DSN `structure` may carry an `autoroute_settings` block, and a rules file may carry one too.
`readDsn` exposes what it found as `layout.settingsFromFile` (a `Partial<RouteSettings>`) and
**does not apply it**; `route()` applies, in order: built-in defaults ← `layout.settingsFromFile`
(only if the caller passes `useFileSettings: true`) ← the caller's `settings`. Acceptance cases of
kind `settings` check the effective settings object returned in `report.effectiveSettings`.

## Determinism

With identical inputs and settings, `route()` produces identical Tracks and Barrels (same
coordinates, same order in `layout.tracks`/`layout.barrels`), except that fields marked advisory
(`wallClockMs`) may differ. Time budgets, when they expire, may change the result; cases that
pin exact counts therefore set budgets generously and are tagged advisory on wall clock.
