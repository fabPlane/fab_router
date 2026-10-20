Adds optional bounded recovery for connections left open after normal routing, guarded by original-terminal connectivity, retained copper and exact represented-rule DRC checks. Late, cancelled or invalid trials roll back. Recovery stays **off by default**.

The latest increment reuses the existing PR #4 allocation-free rim traversal on the current ring/recovery source: walk existing shape parts and rings directly instead of allocating filtered cutouts, flattened parts and sliced probe arrays. Probe order, exact predicates, physical rules, widths, lattice and search settings stay unchanged. Production delta from `49bfc72a` is only `src/geom/onboard.ts`, with the existing 42,048-decision differential guard added. Implementation: `a3a2d38ddea104e4dff4fec8551d27260710a718`.

Fresh native comparison: same frozen **26 cases × 3 repeats**, same host, cores 12–19/nice 10, candidate sweep then control sweep, identical enabled recovery, no overlapping own heavy jobs. **All 78 paired sessions, statistics and full reports except wall time match.** Native findings and warning geometry, opens, fidelity, vias and length do not regress. Both retain **27 known router-introduced native thermal errors**, unresolved.

Observed total route change **-10.44%**, overall median -1.63%, overall p95 -1.58%, sweep wall -8.77%. Only **12/26 case medians and 18/26 case p95 improve**; individual regressions remain below. Timing on this shared host is observational and does not establish universal or causal speedup.

| Full native metric (26 cases × 3 repeats) | Current control | Allocation-free rim traversal |
|---|---:|---:|
| Passed / 78 | 48 | 48 |
| Valid cases / 26 | 16 | 16 |
| Opens | 90 | 90 |
| New native errors (known, unresolved) | 27 | 27 |
| Median route seconds | 1.220020 | 1.200097 |
| p95 route seconds | 16.129187 | 15.875130 |
| Sum route seconds | 427.290283 | 382.683507 |
| Sweep wall seconds | 544.211810 | 496.500959 |
| Sum case medians seconds | 140.071084 | 127.479959 |
| Sum case p95 seconds | 151.150245 | 135.065826 |
| Sum vias | 2826 | 2826 |
| Sum length mm | 60450.378202 | 60450.378202 |

![All case medians, including regressions](https://github.com/fabPlane/fab_router/blob/agent/fab-router-perf-local-rescue/docs/pr-assets/agent-fab-router-perf-local-rescue/rim-composition/timings.png?raw=true)

| Case (3 repeats) | Median before / after s | p95 before / after s | Passed | Opens | New errors |
|---|---:|---:|---:|---:|---:|
| fan-controller-fan-controller-j1 | 5.2082 / 4.7685 | 5.6951 / 5.0749 | 0 / 0 | 12 / 12 | 0 / 0 |
| fan-controller-fan-controller-j2-large | 0.8826 / 0.8520 | 0.9082 / 0.8590 | 3 / 3 | 0 / 0 | 0 / 0 |
| fan-controller-fan-controller-j2-medium | 0.7400 / 0.7187 | 0.7543 / 0.7484 | 3 / 3 | 0 / 0 | 0 / 0 |
| fan-controller-fan-controller-j2-small | 4.0889 / 3.6114 | 4.6470 / 3.7146 | 0 / 0 | 3 / 3 | 0 / 0 |
| hellscribe-hellscribe-j1 | 3.8819 / 4.0999 | 3.9920 / 4.1406 | 0 / 0 | 9 / 9 | 0 / 0 |
| hellscribe-hellscribe-j2-large | 1.0098 / 1.0282 | 1.3740 / 1.1451 | 0 / 0 | 3 / 3 | 0 / 0 |
| kitspace-aquarius-j4 | 55.1644 / 44.7954 | 57.8932 / 45.7321 | 0 / 0 | 45 / 45 | 18 / 18 |
| kitspace-lcr-addon-j3 | 2.1768 / 2.2098 | 2.3538 / 2.3465 | 3 / 3 | 0 / 0 | 0 / 0 |
| kitspace-solenoid-driver-j1 | 0.7464 / 0.7784 | 0.8942 / 0.7851 | 3 / 3 | 0 / 0 | 0 / 0 |
| kitspace-solenoid-driver-j3 | 0.7318 / 0.7329 | 0.7374 / 0.7495 | 3 / 3 | 0 / 0 | 0 / 0 |
| kitspace-solenoid-driver-j4 | 0.8689 / 0.8829 | 0.9276 / 1.0152 | 3 / 3 | 0 / 0 | 0 / 0 |
| nextbusclock-nextbusclockv1-j2-large | 3.0894 / 2.8844 | 3.5571 / 3.3624 | 3 / 3 | 0 / 0 | 0 / 0 |
| nextbusclock-nextbusclockv1-j2-medium | 0.9996 / 1.0079 | 1.0106 / 1.0287 | 3 / 3 | 0 / 0 | 0 / 0 |
| nextbusclock-nextbusclockv1-j2-small | 0.7430 / 0.8777 | 1.0363 / 0.8820 | 3 / 3 | 0 / 0 | 0 / 0 |
| nextbusclock-nextbusclockv1-j3 | 8.8167 / 8.8767 | 9.5451 / 9.2133 | 0 / 0 | 3 / 3 | 0 / 0 |
| paperino-hw-paperino-shield-j4 | 15.4305 / 13.7805 | 16.1292 / 15.8751 | 0 / 0 | 12 / 12 | 0 / 0 |
| photon-sprinkler-sprinkler-j1 | 11.4434 / 11.3639 | 13.6620 / 13.2067 | 3 / 3 | 0 / 0 | 0 / 0 |
| photon-sprinkler-sprinkler-j3 | 14.8287 / 14.7628 | 15.9088 / 15.2243 | 3 / 3 | 0 / 0 | 0 / 0 |
| qrpcard-qrpcard-j1 | 1.4055 / 1.3992 | 1.5364 / 1.4091 | 3 / 3 | 0 / 0 | 0 / 0 |
| qrpcard-qrpcard-j2-medium | 0.8682 / 0.8745 | 0.9747 / 0.8753 | 3 / 3 | 0 / 0 | 0 / 0 |
| qrpcard-qrpcard-j2-small | 0.7453 / 0.7498 | 0.9003 / 0.7571 | 0 / 0 | 0 / 0 | 6 / 6 |
| qrpcard-qrpcard-j4 | 1.0016 / 1.0721 | 1.0071 / 1.2551 | 0 / 0 | 0 / 0 | 3 / 3 |
| rufs-smart-psu-j1 | 0.7472 / 0.7359 | 0.7491 / 0.8706 | 3 / 3 | 0 / 0 | 0 / 0 |
| rufs-smart-psu-j3 | 2.2887 / 2.4679 | 2.4757 / 2.4860 | 0 / 0 | 3 / 3 | 0 / 0 |
| rufs-smart-psu-j4 | 1.3013 / 1.2647 | 1.5883 / 1.4116 | 3 / 3 | 0 / 0 | 0 / 0 |
| sv650sds-sds-tool-j4 | 0.8624 / 0.8842 | 0.8928 / 0.8974 | 3 / 3 | 0 / 0 | 0 / 0 |

Dense6: three alternating pairs, fixed two-pass/600s budgets, all six sessions/statistics identical. Each has 181 opens, zero new native errors, 315 vias and 2317.561458 mm length. Median 179.118061→171.911872s (-4.02%); p95 (max of 3) 182.034268→173.469666s. This custom board is outside the frozen-suite score.

| Ladder (one pair each; engine replay only) | Before s | After s | Engine incomplete (both) |
|---|---:|---:|---:|
| l2 | 18.212826 | 17.184692 | 21 |
| l3-cycle18 | 157.883533 | 170.823648 | 153 |

Ladder sessions, settings, statistics and reports except wall match, with zero added represented-rule violations and no timeouts. These are not fresh native DRC scores.

Validation: typecheck and layer checks pass; **914 tests / 649747 assertions / zero failures**, including the added differential traversal test and unchanged route fingerprints. The first isolated typecheck attempt failed because the snapshot omitted documentation fixtures imported by existing tests. Restoring the unchanged fixtures from the control revision fixed the setup; both logs and the fixture hash audit are retained. No expectations or scoring changed.

| Source-qualified sampled self ms (separate profile) | Control | Candidate |
|---|---:|---:|
| withinRim (geom/onboard) | 11551.401 | 1247.298 |
| partWithinRim (geom/onboard) | 0.000 | 9016.983 |
| pointInRing (geom/predicates) | 10.970 | 3.127 |
| collect (lattice/grid) | 6435.465 | 6734.451 |
| test (lattice/grid) | 3528.965 | 3659.468 |

One separately profiled route per version, with matching output; profiled times are excluded from timing aggregates. Inlining moves attribution between traversal and helper functions, so sampled self time is not a causal CPU-cost estimate.

**Prior limitations remain:** cache-only speed benefit is unsupported (a previous warmed median regressed 9%; a reverse full pair had median +0.15%, p95 +4.07%, total −0.66%). Earlier ring composition had adverse dense/ladder timings. The prior complete enabled slow acceptance was 51 pass/12 existing failures across 63 cases, but its historical 300-second case increased 18→19 incompletes; three fresh isolated pairs then gave 18/18 in every pair. The cause remains unproven. That whole slow suite is **not rerun in this cycle**. No universal, whole-slow-suite or live-editor nonregression claim is made. [Prior evidence and retained adverse attempts](../ring-composition/README.md), [cache replication](../quilt-counterbalanced/README.md).

Reproduce with dependencies installed and the private benchmark runtime already prepared:

```bash
ENGINE=/home/hyper/bench/wt/fr-perf
ASSET="$ENGINE/docs/pr-assets/agent-fab-router-perf-local-rescue/rim-composition"
RUN=/home/hyper/bench/agents/codex-fabpcb-perf/scratch/rim-composition-repro
python3 "$ASSET/prepare-repro.py" "$ENGINE" "$RUN" 49bfc72a a3a2d38ddea104e4dff4fec8551d27260710a718
python3 "$RUN/native.py"
python3 "$RUN/checks.py"
python3 "$RUN/stress.py"
python3 "$ASSET/verify.py"
python3 "$ASSET/verify-dense.py"
```

The stress supervisor runs separate profiles, three alternating dense pairs and one pair each of ladder L2/L3, on cores 12–19/nice 10 with individual timeouts. The dense fixture is `/home/hyper/bench/boards/dense/fab_pcb-case-dense6-bga324-j1`; ladder inputs are `/home/hyper/bench/boards/ladder/{l2,l3-cycle18}.dsn`. Payloads, settings, native records and original licensing/provenance are archived. Verifiers rebuild all native/stress comparisons and derived tables/chart; four native and two dense corruption controls must fail. All attempts are retained.

The source-override benchmark exercises the standalone export/import and engine API. It does not validate the consumer package exporter or live-editor latency. Consumer pin follow-up: https://github.com/fabPlane/fab_pcb/pull/38 .

Retained recovery witness (the latest traversal increment changes no copper):

![Previously closed connection with native checks](https://github.com/fabPlane/fab_router/blob/agent/fab-router-perf-local-rescue/docs/pr-assets/agent-fab-router-perf-local-rescue/point-components/connection.png?raw=true)

[Bounded recovery design and exact rollback gates](../point-components/README.md).
