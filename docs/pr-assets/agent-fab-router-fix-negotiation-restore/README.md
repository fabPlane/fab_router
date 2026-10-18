# Restore removals with the winning routing state

The detailed negotiation loop rewinds its Journal and restores the best copper
snapshot even after a successful first pass. Previously that snapshot contained
only inserted tracks and vias. A shoved obstacle was removed and replaced during
the trial, but rewind brought its original geometry back. Restoring only the
insertions left both obstacle versions and put the original across the new route.
The optional planned driver's losing-trial fallback shares these snapshot helpers.

The Journal now exposes removed ids that remain absent at capture time. Snapshots
retain those ids and replay their removal through the Journal before inserting
the winning copper. This keeps the layout and lattice in step. The default local
loop's routing strategy and clearance predicate are unchanged.

The regression adapts the repository's small shove-test board: one layer, two
nets, four surface pads, and one free obstacle track. Its vertical obstacle closes
the space between the board edges. Shoving moves its middle aside and completes
the horizontal signal route without changing the obstacle endpoints. Both nets
stay connected. The previous detailed loop adds one spacing violation when it
restores the unshifted original track alongside that result.

`comparison.png` renders the actual synthetic geometry retained in the audit;
it is not a native board render. `before.json` and `after.json` preserve all track
records, full reports and DRC results for three repeats of each setting. The
baseline has one clearance violation in every detailed repeat; the candidate has
none. Both default-loop controls remain clean and complete.

## Reproduce

From this repository with Bun 1.4 and rsvg-convert:

```bash
bun test test/negotiation-restore.test.ts
bun docs/pr-assets/agent-fab-router-fix-negotiation-restore/audit.ts "$PWD" > /tmp/negotiation-after.json
mkdir -p /tmp/negotiation-main
git archive 69cf598 | tar -x -C /tmp/negotiation-main
bun docs/pr-assets/agent-fab-router-fix-negotiation-restore/audit.ts /tmp/negotiation-main --expect-unsafe > /tmp/negotiation-before.json
python3 docs/pr-assets/agent-fab-router-fix-negotiation-restore/render.py
bun run typecheck && bun run check:layers && bun run test
```

The default audit asserts the repaired behavior; `--expect-unsafe` asserts the
known main failure. The third unit test checks removal capture and rewind.

## Frozen native nonregression

From the integration checkout on the same Linux host, cores 20–25:

```bash
cd /home/hyper/bench/wt/fp-bugs
taskset -c 20-25 nice -n 10 timeout 3600 python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source /home/hyper/bench/wt/fr-bugs --out /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c18-after-full
cd /home/hyper/bench/wt/fr-bugs
python3 docs/pr-assets/agent-fab-router-fix-negotiation-restore/validate.py /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c1-before-full /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c18-after-full "$PWD" /tmp/negotiation-benchmark.json
```

The frozen suite uses the default local loop, so it supplies nonregression
coverage; the synthetic fixture exercises the repaired optional loop. No claim
that this change fixes any frozen-board failure or native thermal starvation.
The snapshot helpers also serve the planned fallback, but this fixture does not
force that fallback. Independent pending fixes are excluded. Timing on this
shared host with overlapping tests is descriptive only.

Frozen native benchmark: same 26 cases × three repeats per version, same machine, inputs, configuration, harness, runtime, order and seeds. Captured source hashes all verified against the baseline and candidate.

| Full fab_router sweep | Main baseline | Candidate |
| --- | ---: | ---: |
| Passing attempts | 39/78 | 39/78 |
| Cases valid 3/3 | 13/26 | 13/26 |
| Opens, total | 120 | 120 |
| New native errors, total | 27 | 27 |
| Median route seconds | 1.172079 | 1.229518 |

Every attempt also has identical via count and track length. Median time increased 4.9%; no isolated speed conclusion on the shared host.
