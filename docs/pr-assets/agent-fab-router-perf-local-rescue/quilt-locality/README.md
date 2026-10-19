# Quilt front-cache locality diagnostic

The earlier whole-board census measured a 97.85% authoritative map hit rate. This follow-up measures the locality prerequisite for a bounded front cache. A scratch-only observer simulates 64, 256 and 1,024 slots **per quilt** with slot `((gx & (size-1)) ^ Math.imul(gy,31)) & (size-1)`. It compares the unchanged numeric map key, records cold slots and collisions, and clears all simulated validity bits on every invalidation, including empty invalidations. Every simulated hit must also be an authoritative map hit. The map still supplies every routing decision; no lookup is bypassed. The observer cannot measure net savings: hashing, checking, filling, allocation and invalidation would all cost work in a real implementation.

Only `src/route/quilt.ts` differs in the scratch engine. All 1,536 implementation/spec/test hashes are checked against the independent archived control; reversing precisely the three insertions restores the original module hash. A separate deterministic trace compares the observer with a Map-based slot reference, including negative coordinates, collisions, partial/full/empty invalidation and unaffected map entries. Its clearance callback is stubbed only for accounting checks, not geometry claims. Six record mutations and two source mutations must be rejected.

Three sequential complete-board replays use the archived input, enabled recovery settings, cores 12–19, nice 10 and individual 300-second timeouts. Sessions, effective settings, final statistics and reports except wall time must match the independent control. Recovery logs match after removing only nested seconds. Counts aggregate all phases and must match across repeats and reconcile against the earlier census. Observer timing is provenance only. No fresh native DRC, full 26×3, dense, ladder or slow acceptance result is claimed; historical native thermal errors remain unresolved. No benchmark score or speed gain is claimed and no history row is warranted.

From the repository root, with an unused work directory:

```bash
asset=docs/pr-assets/agent-fab-router-perf-local-rescue/quilt-locality
work=/home/hyper/bench/agents/codex-fabpcb-perf/scratch/cycle76
python3 "$asset/prepare.py" "$work/work"
taskset -c 12-19 nice -n 10 timeout 30 bun "$asset/controls.ts" "$work/work/source"
for r in 1 2 3; do
  taskset -c 12-19 nice -n 10 timeout 300 bun "$asset/run.ts" "$work/work/source" "$work/work/input" "$work/replay$r"
done
PYTHONDONTWRITEBYTECODE=1 python3 "$asset/report.py" "$work" "$asset"
rsvg-convert -w 1600 "$asset/chart.svg" -o "$asset/chart.png"
taskset -c 12-19 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
PYTHONDONTWRITEBYTECODE=1 python3 "$asset/verify.py"
```

`table.md` contains the measured counts; `records.json.gz` preserves all three records and sessions. These measurements apply to this board and hash only. They do not establish a best capacity, a memory bound across concurrently live quilts, or a speed gain. Adoption requires a separately measured candidate, complete output parity, alternating timing, fresh full native 26×3 and stress/acceptance validation. Earlier lattice-slot/key experiments addressed a different module and remain parked after mixed or adverse suite timing.

The selected observer hash has many collisions even at 1,024 slots; high map hit share does not translate directly to high bounded-slot hit share. Treat alternative hashes or capacities as distinct experiments. Scratch observer typecheck and layer checks pass. Their brief run overlapped the diagnostic replays; no observer wall times are used for a performance comparison.

Final production gates pass: typecheck, layer checks (71 files, zero violations), and 912 tests / 399,733 assertions, zero failures (327.48 seconds). Production tests ran after the three replays ended. The independent trace totals 536 calls, nine authoritative map hits and four invalidations. The chart PNG was visually inspected.
