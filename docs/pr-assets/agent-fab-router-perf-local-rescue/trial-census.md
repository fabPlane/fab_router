# Trial attribution and first blocked segments, cycle 20

Production src/spec/tools/test remain exactly at control `69cf598`. No rescue implementation or performance improvement is adopted. This diagnostic resolves the net-attribution ambiguity in the cycle-19 counters and records the first rejecting exact segment in each failed angle-shaping variant.

Three final seed-1 engine replays, one per board, use the previous native inputs/settings on the same machine and cores 12–19. All three sessions match byte for byte; every existing search and legalisation-stage counter and all nine final residual keys match. An initial three-replay trace omitted enclosing via-route boundaries; the refined trace adds those boundaries and reproduces the same outcomes. Six diagnostic replays total are explicitly unscored in the shared history. These are not fresh native checks, a repair trial, or a timing comparison. Required unit checks overlapped the refined replays; no timing inference is made.

| Board | Final trace repeats | Residuals before | After | Sessions match |
|---|---:|---:|---:|---:|
| paperino-hw-paperino-shield-j4 | 1 | 6 | 6 | 1/1 |
| photon-sprinkler-sprinkler-j3 | 1 | 2 | 2 | 1/1 |
| rufs-smart-psu-j3 | 1 | 1 | 1 | 1/1 |

All 1,474 observed `insertTrail` calls use the owning residual connection's net; zero use another net. Of those calls, 1,107 reject legalisation and 367 legalise a partial trail. All 367 successful trail calls have a failed enclosing via-routing stage: 113 in `tryRouteViaPoints`, 242 in `tryRouteViaJog`, and 12 in `insertLayeredTrail`. Their owning `routeConnection` calls all return false. The trace records call IDs and parent IDs, not an assertion that partial copper survives its transaction. The existing via-route code rewinds failed multi-leg trials.

The 1,107 rejected trail calls expose 1,459 failed shaping variants (a trail can try two variants). Each record contains that variant's first failing segment, sheet, width, neck width, angle mode and full-width blocker IDs, captured from the existing clearance query without additional geometry queries. Of these first failures, 1,417 are on a first/last shaped segment and 42 are interior. **A trial endpoint can be a proposed via site; this does not establish that 1,417 failures occur at original pads.** An offline comparison with original DSN pad/barrel positions classifies 686 of those first failures as touching an original endpoint, 731 as touching only another trial endpoint, and 42 as interior. It performs no routing or clearance queries. All nine original endpoint pairs resolve to pads/barrels; unsupported pour attachments are rejected rather than approximated. This still does not prove that every other endpoint is a via site. It also does not count every blocked segment, prove a graph path is legal, identify the only failure cause, or show that changing spacing/budgets helps. The replay setting `neckWidthUm` is zero; recorded profiles have neck width equal to full width, so neck-down is disabled and no neck-down success is inferred.

| Residual | Trail attempts | Legalised partial trails | Rejected trails | First failing variant segment: end / interior |
|---|---:|---:|---:|---:|
| paperino /INT1 | 84 | 18 | 66 | 80 / 12 |
| paperino /SPI_MOSI | 73 | 15 | 58 | 68 / 14 |
| paperino /SPI_CLK | 62 | 14 | 48 | 64 / 0 |
| paperino /SPI_CS1 | 62 | 14 | 48 | 64 / 0 |
| paperino /~{BUSY} | 62 | 14 | 48 | 64 / 0 |
| paperino /~{RST} | 62 | 14 | 48 | 64 / 0 |
| photon +5V | 346 | 64 | 282 | 315 / 6 |
| photon GND | 251 | 50 | 201 | 268 / 0 |
| rufs +BATT | 472 | 164 | 308 | 430 / 10 |

`trial-results.json` retains every observed call tree for the nine residual keys and all first-blocked segments; `trial-summary.json` is derived by the committed summariser. The instrumented source differs only in `passes.ts` (wrappers/counters) and `legalise.ts` (reuse the existing clearance result and record rejection details). Source audit covers 1,482 tracked src/spec files plus five copied ignored acceptance CSVs. The diagnostic generator checks both edited source files against the control before creating output. A content mutation to `legalise.ts` is rejected before output creation; output guards preserve existing source/replay/summary destinations; regeneration reproduces both measured files exactly.

Reproduce from the repository root with installed dependencies, matplotlib, and the previous native work directory (input/session hashes are in `grid-census.json`):

```sh
ASSETS=docs/pr-assets/agent-fab-router-perf-local-rescue
OUT=$HOME/bench/agents/codex-fabpcb-perf/scratch/cycle20-reproduce
mkdir -p "$OUT"
python3 "$ASSETS/trace-trials.py" . "$OUT/source"
taskset -c 12-19 nice -n 10 timeout 120 bun run --cwd "$OUT/source" typecheck
taskset -c 12-19 nice -n 10 timeout 600 python3 "$ASSETS/replay-trials.py" "$OUT" "$HOME/bench/agents/codex-fabpcb-perf/scratch/cycle18/native-complete"
python3 "$ASSETS/summarise-trials.py" "$OUT" "$OUT/trial-summary.json"
taskset -c 12-19 nice -n 10 timeout 120 bun "$ASSETS/classify-trial-ends.ts" "$HOME/bench/agents/codex-fabpcb-perf/scratch/cycle18/native-complete" "$OUT/trial-results.json" "$OUT/trial-endpoints.json"
python3 "$ASSETS/plot-trials.py" "$OUT/trial-summary.json" "$OUT/trial-endpoints.json" "$OUT/trial-census.png"
taskset -c 12-19 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

No frozen input, checker, scoring, shared runtime or other agent's worktree was edited. A fresh full 26×3 native diagnostic run is recorded below. No new fixture test or dense/ladder/slow run was done for this observation-only update. The actual default-off legal relaxation and genuine full-pipeline stall regression remain unfinished. Next: select a concrete failed endpoint transition from this trace, inspect the captured segment and blocker geometry at an original endpoint or intermediate trial site, then test an exact-rule local search/legalisation lever with rollback and terminal preservation. Larger search budgets alone are not supported by this evidence.


## Full native verification

The fresh diagnostic sweep completed all 26 cases × three seeds on cores 12–19, after the required unit checks. All 78 raw SES hashes, input/settings/manifest hashes, quality/via/length outcomes and pre-existing search counters match the previous cycle-18 diagnostic control. Native runner/checker/runtime/input/order identities are verified. Effective per-attempt settings match; the config source-path override differs. Candidate source hashes differ only in the two diagnostic files. The local Git snapshot is provenance for a disposable generated source tree, not an adopted or remotely published engine change. `trial-native.json` retains all attempts, per-case median/p95 pipeline times, quality/copper metrics and source identities.

These are sequential diagnostic runs against a historical control on the same shared host. Timing includes observation overhead and host variation; the values below establish no performance improvement. Per-case p95 is the maximum of three repeats; overall p95 uses nearest rank across 78 attempts. Both runs retain existing thermal errors and are not DRC-clean.

| Measure | Prior diagnostic control | Trial-attribution diagnostic |
|---|---:|---:|
| Cases × repeats | 26 × 3 | 26 × 3 |
| Passed attempts | 39/78 | 39/78 |
| Cases passing 3/3 | 13/26 | 13/26 |
| Opens summed | 120 | 120 |
| New native errors summed | 27 | 27 |
| Overall median pipeline seconds | 1.264383 | 1.229615 |
| Overall p95 pipeline seconds | 18.213576 | 16.771766 |
| Total pipeline seconds | 425.532927 | 396.295112 |

| Case | Prior median/p95 s | Diagnostic median/p95 s | Passed both | Opens both | New errors both | Median vias both | Median length mm both |
|---|---:|---:|---:|---:|---:|---:|---:|
| fan-controller-fan-controller-j1 | 4.099/5.811 | 3.639/3.709 | 0/3 | 15 | 0 | 102 | 909.022 |
| fan-controller-fan-controller-j2-large | 1.038/1.209 | 0.851/0.875 | 3/3 | 0 | 0 | 26 | 561.860 |
| fan-controller-fan-controller-j2-medium | 0.752/0.859 | 0.717/0.761 | 3/3 | 0 | 0 | 27 | 531.997 |
| fan-controller-fan-controller-j2-small | 3.509/4.001 | 3.323/3.969 | 0/3 | 3 | 0 | 22 | 495.567 |
| hellscribe-hellscribe-j1 | 2.293/2.344 | 1.981/2.030 | 0/3 | 9 | 0 | 100 | 1315.786 |
| hellscribe-hellscribe-j2-large | 1.244/1.499 | 1.132/1.142 | 0/3 | 3 | 0 | 111 | 1369.282 |
| kitspace-aquarius-j4 | 53.753/56.537 | 51.623/54.396 | 0/3 | 45 | 18 | 130 | 1731.113 |
| kitspace-lcr-addon-j3 | 2.332/3.044 | 2.137/2.162 | 3/3 | 0 | 0 | 40 | 845.486 |
| kitspace-solenoid-driver-j1 | 0.859/1.000 | 0.868/0.876 | 3/3 | 0 | 0 | 12 | 352.691 |
| kitspace-solenoid-driver-j3 | 0.881/0.908 | 0.743/0.870 | 3/3 | 0 | 0 | 12 | 354.176 |
| kitspace-solenoid-driver-j4 | 0.867/0.989 | 0.735/1.070 | 3/3 | 0 | 0 | 9 | 239.685 |
| nextbusclock-nextbusclockv1-j2-large | 3.161/3.214 | 3.290/3.337 | 3/3 | 0 | 0 | 41 | 1522.059 |
| nextbusclock-nextbusclockv1-j2-medium | 1.010/1.126 | 1.024/1.112 | 3/3 | 0 | 0 | 1 | 1484.105 |
| nextbusclock-nextbusclockv1-j2-small | 0.745/0.754 | 0.731/0.735 | 3/3 | 0 | 0 | 2 | 1498.273 |
| nextbusclock-nextbusclockv1-j3 | 8.142/8.867 | 8.287/8.854 | 0/3 | 9 | 0 | 65 | 1428.725 |
| paperino-hw-paperino-shield-j4 | 16.965/18.214 | 16.395/16.772 | 0/3 | 18 | 0 | 1 | 171.235 |
| photon-sprinkler-sprinkler-j1 | 13.383/13.588 | 12.578/12.675 | 0/3 | 6 | 0 | 12 | 585.655 |
| photon-sprinkler-sprinkler-j3 | 16.474/16.525 | 15.080/15.714 | 0/3 | 6 | 0 | 12 | 589.076 |
| qrpcard-qrpcard-j1 | 1.411/2.182 | 1.361/1.520 | 3/3 | 0 | 0 | 59 | 828.234 |
| qrpcard-qrpcard-j2-medium | 0.874/0.882 | 0.858/0.868 | 3/3 | 0 | 0 | 20 | 472.915 |
| qrpcard-qrpcard-j2-small | 0.739/0.744 | 0.723/0.727 | 0/3 | 0 | 6 | 17 | 480.433 |
| qrpcard-qrpcard-j4 | 1.151/1.298 | 1.245/1.256 | 0/3 | 0 | 3 | 38 | 523.199 |
| rufs-smart-psu-j1 | 0.901/0.912 | 0.842/0.872 | 3/3 | 0 | 0 | 27 | 387.434 |
| rufs-smart-psu-j3 | 1.953/1.967 | 1.884/1.915 | 0/3 | 3 | 0 | 26 | 379.018 |
| rufs-smart-psu-j4 | 1.261/1.268 | 1.214/1.254 | 0/3 | 3 | 0 | 16 | 322.007 |
| sv650sds-sds-tool-j4 | 0.883/1.011 | 0.835/0.879 | 3/3 | 0 | 0 | 14 | 224.075 |


Exact full-sweep reproduction (own control checkout with production source at `69cf598`, installed benchmark checkout, and the cycle-18 native control):

```sh
CONTROL_SOURCE=$HOME/bench/wt/fr-perf \
BENCHMARK_CHECKOUT=$HOME/bench/wt/fp-perf \
PRIOR_NATIVE=$HOME/bench/agents/codex-fabpcb-perf/scratch/cycle18/native-complete \
RUN_ROOT=$HOME/bench/agents/codex-fabpcb-perf/scratch/cycle20-full-reproduce \
bash docs/pr-assets/agent-fab-router-perf-local-rescue/reproduce-trial-native.sh
```

Validation: typecheck passes; layer check 65 files / zero violations; 859 tests pass, zero fail, 398,454 assertions (237.99 s). Diagnostic source typecheck and offline helper strict TypeScript check pass. Python AST, shell syntax, content-mutation rejection, overwrite guards, complete source audit, exact regeneration and endpoint-count partitions pass. The chart was visually inspected. Required checks are retained in `trial-required-checks.txt`; observer checks in `trial-observer-checks.txt`.
