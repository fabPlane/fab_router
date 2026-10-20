### Cycle 94: strict-left polygon edge filter rejected after full native benchmark

Tested skipping a polygon edge whose two endpoints lie strictly left of the containment probe, after the existing closed-y prefilter. Such an edge can neither contain the probe nor cross its +x ray; equality still reaches the exact predicate. The change is two isolated lines in src/geom/predicates.ts, with no caching, preparation, mutation assumption, rule or setting change. The patch is REVERTED: this commit publishes measurements only. Engine code and consumer pin remain unchanged.

Earlier default CPU profiles place repeated rim containment among the largest sampled frames (Aquarius partWithinRim 7.846 sampled seconds). That motivates reducing edge work, but no fresh profile or causal cost attribution is claimed here. A standalone comparison passes 2,462,175 classifications: generated rings, finite coordinates, repeated/zero-length edges, boundary vertices and midpoint offsets, reversed winding, mutation and coordinate limits. Independent source reconstruction matches all 1,488 source/spec hashes in each variant. No nonfinite-coordinate equivalence is claimed.

Fresh native runs: same host hyper-ms-lin, Bun 1.4.0, KiCad 10.0.6, cores 12–19, nice 10, control sweep then candidate sweep. Same 26 cases, shuffled order, three seeds, frozen inputs/settings/checker/runtime. No overlapping own heavy benchmark/check jobs; other host workloads remain uncontrolled. Each sweep has a 1,800-second outer timeout; the harness retains its existing per-attempt safety limit. All 156 attempts finish checked; none omitted. Native route seconds include required export/import/cleanup; independent native checks and rendering are excluded. Overall p95 uses nearest rank across 78 attempts; per-case p95 is maximum of three.

| Metric, 26 cases × 3 repeats per version | Control | Rejected candidate |
|---|---:|---:|
| Passed / 78 | 39 | 39 |
| Valid cases / 26 | 13 | 13 |
| Opens | 120 | 120 |
| Known unresolved new native errors | 27 | 27 |
| Median route s | 1.066495 | 1.151887 |
| p95 route s | 13.757288 | 15.034727 |
| Total route s | 322.909072 | 363.431232 |
| Sweep wall s | 433.883965 | 480.693867 |
| Sum case medians s | 107.288458 | 119.724555 |
| Sum case p95 s | 112.516354 | 126.395237 |
| Vias | 2826 | 2826 |
| Length mm | 58809.321397 | 58809.321397 |

REJECTED: total route time +12.55%, sweep wall +10.79%, sum case medians +11.59%, sum case p95 +12.33%. The focused gate below was favorable, but does not override the adverse full suite. Sequential shared-host sweeps do not establish a causal slowdown or a universal predicate-performance claim. No speed improvement is shipped.

All 78 paired sessions are byte-identical; all paired input DSNs/manifests/settings, full engine results/reports/statistics except wallClockMs, native findings and warning geometry match. Passed count, opens, fidelity, vias and length are unchanged. The 27 existing introduced native thermal errors remain unresolved; there is no DRC fix or completion gain. Local recovery remains default off. Dense6, ladder and whole slow acceptance are not rerun after rejection.

![Full-suite per-case timing changes](https://github.com/fabPlane/fab_router/blob/agent/fab-router-perf-local-rescue/docs/pr-assets/agent-fab-router-perf-local-rescue/ring-left/native.png?raw=true)

| Case (3 repeats/version) | Control median / p95 s | Candidate median / p95 s | Median change | Passed both | Opens / native errors both |
|---|---:|---:|---:|---:|---:|
| fan-controller-fan-controller-j1 | 3.174232 / 3.368224 | 3.884502 / 4.036491 | +22.38% | 0/3 | 15 / 0 |
| fan-controller-fan-controller-j2-large | 0.844652 / 0.857998 | 0.863911 / 0.930251 | +2.28% | 3/3 | 0 / 0 |
| fan-controller-fan-controller-j2-medium | 0.725917 / 0.730680 | 0.728873 / 0.885660 | +0.41% | 3/3 | 0 / 0 |
| fan-controller-fan-controller-j2-small | 2.632944 / 2.633168 | 2.980433 / 3.006009 | +13.20% | 0/3 | 3 / 0 |
| hellscribe-hellscribe-j1 | 2.216905 / 2.462707 | 2.186611 / 2.230548 | -1.37% | 0/3 | 9 / 0 |
| hellscribe-hellscribe-j2-large | 0.992762 / 1.030746 | 1.004648 / 1.032973 | +1.20% | 0/3 | 3 / 0 |
| kitspace-aquarius-j4 | 38.171044 / 38.242191 | 43.571342 / 45.482476 | +14.15% | 0/3 | 45 / 18 |
| kitspace-lcr-addon-j3 | 2.213589 / 2.229745 | 2.082188 / 2.174400 | -5.94% | 3/3 | 0 / 0 |
| kitspace-solenoid-driver-j1 | 0.723061 / 0.750707 | 0.861724 / 0.868427 | +19.18% | 3/3 | 0 / 0 |
| kitspace-solenoid-driver-j3 | 0.714795 / 0.841782 | 0.734940 / 0.750784 | +2.82% | 3/3 | 0 / 0 |
| kitspace-solenoid-driver-j4 | 0.723427 / 0.890995 | 0.865641 / 0.869405 | +19.66% | 3/3 | 0 / 0 |
| nextbusclock-nextbusclockv1-j2-large | 2.823336 / 2.902005 | 3.124919 / 3.191920 | +10.68% | 3/3 | 0 / 0 |
| nextbusclock-nextbusclockv1-j2-medium | 0.990594 / 0.992354 | 1.011250 / 1.023535 | +2.09% | 3/3 | 0 / 0 |
| nextbusclock-nextbusclockv1-j2-small | 0.746802 / 0.865601 | 0.774913 / 0.882525 | +3.76% | 3/3 | 0 / 0 |
| nextbusclock-nextbusclockv1-j3 | 6.942918 / 8.072392 | 7.869869 / 8.557415 | +13.35% | 0/3 | 9 / 0 |
| paperino-hw-paperino-shield-j4 | 11.201822 / 12.949353 | 12.305265 / 14.107949 | +9.85% | 0/3 | 18 / 0 |
| photon-sprinkler-sprinkler-j1 | 10.228440 / 10.281310 | 11.698842 / 11.918909 | +14.38% | 0/3 | 6 / 0 |
| photon-sprinkler-sprinkler-j3 | 13.142807 / 13.757288 | 14.381270 / 15.034727 | +9.42% | 0/3 | 6 / 0 |
| qrpcard-qrpcard-j1 | 1.238924 / 1.381437 | 1.393750 / 1.438225 | +12.50% | 3/3 | 0 / 0 |
| qrpcard-qrpcard-j2-medium | 0.843257 / 0.866747 | 0.891346 / 1.005494 | +5.70% | 3/3 | 0 / 0 |
| qrpcard-qrpcard-j2-small | 0.723567 / 0.744582 | 0.750995 / 0.787544 | +3.79% | 0/3 | 0 / 6 |
| qrpcard-qrpcard-j4 | 0.982382 / 1.032326 | 1.061979 / 1.188077 | +8.10% | 0/3 | 0 / 3 |
| rufs-smart-psu-j1 | 0.593303 / 0.711877 | 0.860350 / 0.874061 | +45.01% | 3/3 | 0 / 0 |
| rufs-smart-psu-j3 | 1.739163 / 1.780967 | 1.799133 / 1.953757 | +3.45% | 0/3 | 3 / 0 |
| rufs-smart-psu-j4 | 1.106223 / 1.258754 | 1.155960 / 1.256147 | +4.50% | 0/3 | 3 / 0 |
| sv650sds-sds-tool-j4 | 0.851593 / 0.880420 | 0.879902 / 0.907529 | +3.32% | 3/3 | 0 / 0 |

| Focused direct replay, 3 alternating pairs/case | Control median / p95 s | Candidate median / p95 s |
|---|---:|---:|
| kitspace-aquarius-j4 | 34.686552 / 34.723281 | 33.384301 / 33.433193 |
| photon-sprinkler-sprinkler-j3 | 10.971389 / 11.296220 | 10.845764 / 11.211385 |
| paperino-hw-paperino-shield-j4 | 10.115201 / 10.149872 | 9.098430 / 9.586202 |

All 18 focused sessions also match independent retained default references, and their full reports/settings match after removing only wallClockMs. These direct engine replays are not native scores. Raw sessions, reports, timing and process logs are retained. Candidate typecheck passes. Required unchanged production checks pass: typecheck, 71 layer files / zero violations, 914 tests / zero failures / 649,747 assertions in 328.12 seconds; raw results are in checks.log; no test expectation, checker or physical rule is weakened.

Reproduce from the repository root (Bun, Python, Git and the benchmark checkout's private native runtime must already be installed):
```sh
asset=docs/pr-assets/agent-fab-router-perf-local-rescue/ring-left
python3 "$asset/reproduce.py" /tmp/ring-left-focused
python3 "$asset/reproduce-native.py" /home/hyper/bench/wt/fp-perf /tmp/ring-left-native
python3 "$asset/verify.py"
PYTHONDONTWRITEBYTECODE=1 python3 "$asset/test-verifier.py"
mkdir /tmp/ring-left-evidence
tar -xJf "$asset/native-evidence.tar.xz" -C /tmp/ring-left-evidence
python3 "$asset/verify-native.py" /tmp/ring-left-evidence
bun run typecheck && bun run check:layers && bun run test
```
Focused reproduction reconstructs both source variants from the adjacent licensed immutable archive, applies exactly the candidate patch, validates all source hashes, checks the predicate and reruns 18 timed attempts with 180-second process limits. Add --prepare-only to reconstruct/check without routing. Native reproduction makes local scratch Git snapshots for the harness's commit field and runs both 78-attempt sweeps. It does not edit tracked engine or benchmark source. Native artifacts include frozen controls, all raw attempts/boards/reports/steps, source identities, logs and input licenses; large visualization files are omitted. The extracted archive's complete member manifest and all native comparisons independently pass. Focused verifier tests reject altered sessions, reports, source identity and missing runs even after recomputing artifact hashes. No routing attempt failed or was repeated/omitted.
