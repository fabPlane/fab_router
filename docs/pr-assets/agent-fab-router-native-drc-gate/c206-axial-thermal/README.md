# Bounded axial thermal repair

The offline proposal generator previously returned no paths for a horizontal or
vertical signal segment. Six short 45-degree detours now preserve its endpoints,
net, layer and width. Diagonal and pair proposal families and the 304-proposal
stage bound are unchanged. New axial paths follow the complete prior proposal
prefix, so repairs that already succeeded incur no additional native checks. Native acceptance still protects source copper,
source and routed terminal pairs, authored pads/zones/rules and the source open
budget. No production route or stall code changes.

The licensed reduced complete-board ground-pad witness is repairable: its added
horizontal signal segment starves a ground thermal and raises opens from 110 to
111. The first new detour restores zero native errors and 110 opens without losing
source or routed terminal pairs. This is a reduced diagnostic control, not a
repair of the complete scored output. Whole-board source-connectivity failures
remain a separate blocker.

The original source has three outline graphic objects sharing one legacy UUID.
Only the second and third graphical UUIDs are deterministically replaced in the
separate `axial-input.kicad_pcb.gz` fixture, identically for source and routed
snapshots. The original fixture and frozen benchmark input remain unchanged.
No physical geometry or rule edits are made to create this control.

## Reproduce

From the engine checkout:

```bash
bun run typecheck
bun run check:layers
bun run test
bun test test/native-thermal-proposals.test.ts test/native-aquarius-thermal.test.ts
```

Run the retained paired diagnostic checks (three repeats of the same witness,
not three independent routing seeds) using the included `measure.ts`, adjusting
its explicit root and checkout paths. The archive includes both exact engine snapshots and all source/routed
boards, rules, generated proposals, native reports, bundles, and baseline tools.

For each full benchmark phase, from the integration checkout:

```bash
python3 packages/router/bench/native-thermal-config.py --engine ENGINE_TOOLS_CHECKOUT --out NEW_CONFIG_DIRECTORY
taskset -c 20-25 nice -n 10 timeout --kill-after=10s 7200s python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source /home/hyper/bench/wt/fr-bugs --config-dir NEW_CONFIG_DIRECTORY --out NEW_RESULTS_DIRECTORY
```

Use the archived `before-engine` tools for before, the fixed tools for after.
Both phases use identical routing `src/`, frozen cases, native checker and rule
settings on the same host and cores. The explicit copied configuration enables
the optional post-import repair; it does not change the default pipeline.

Independent retained-report replay (no rerouting or fresh native execution):

```bash
mkdir replay
tar -xJf evidence.tar.xz -C replay
python3 verify-native.py replay
python3 compare.py replay
```

![Native copper before and after axial repair](comparison.png)

## Measurements

| Scope | Before | After |
|---|---:|---:|
| Passing runs (26 cases × 3 seeds) | 45/78 | 45/78 |
| Cases valid 3/3 | 15 | 15 |
| Opens | 120 | 120 |
| New native thermal errors | 18 | 18 |
| Reduced witness repairs (same board × 3) | 0/3 | 3/3 |
| Reduced witness errors per repeat | 1 | 0 |
| Reduced witness opens per repeat | 111 | 110 |

Observed median full route-path: 9.345923 → 7.842205 s; no speed claim.

```sh
cd /home/hyper/bench/wt/fr-bugs
mkdir /tmp/c206-before-engine
git archive 80fc5b77 src tools package.json tsconfig.json LICENSE | tar -x -C /tmp/c206-before-engine
cd /home/hyper/bench/wt/fp-bugs
python3 packages/router/bench/native-thermal-config.py --engine /tmp/c206-before-engine --out /tmp/c206-before-config
python3 packages/router/bench/native-thermal-config.py --engine /home/hyper/bench/wt/fr-bugs --out /tmp/c206-after-config
taskset -c 20-25 nice -n 10 timeout --kill-after=10s 7200s python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source /home/hyper/bench/wt/fr-bugs --config-dir /tmp/c206-before-config --out /tmp/c206-before
taskset -c 20-25 nice -n 10 timeout --kill-after=10s 7200s python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source /home/hyper/bench/wt/fr-bugs --config-dir /tmp/c206-after-config --out /tmp/c206-after
cd /home/hyper/bench/wt/fr-bugs
taskset -c 20-25 nice -n 10 bun run typecheck
taskset -c 20-25 nice -n 10 bun run check:layers
taskset -c 20-25 nice -n 10 bun run test
```
