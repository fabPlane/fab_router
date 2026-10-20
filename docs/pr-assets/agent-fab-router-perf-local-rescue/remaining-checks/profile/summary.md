
## Sampled recovery CPU profile

One fresh normal all-net route establishes the six-open control, followed by twenty
post-pass replays from identical normal copper. All twenty after-session hashes
match the native-checked four-open session; each replay restores the before-session
exactly. The Journal's id allocator remains monotonic; only copper/session state is
restored. Each call builds a fresh live index, and no recorded route is searched or
inserted. These are not twenty independent normal routes or native checks.

The profile has 26201 total samples; 12730 are below
`recoverRemaining` and the summary weights those by `timeDeltas` (normal routing
excluded). Recovery replay median/p95 is 0.697876/0.745440s under sampling.
This is sampled self time, not a precise per-function timer, allocation count or
speed comparison. Shared-host profiling overlaps a pinned large-input run.

| Function / module | Recovery sampled self time share |
| --- | ---: |
| `withinRim` / `src/geom/onboard.ts` | 20.93% |
| `collect` / `src/lattice/grid.ts` | 16.47% |
| `test` / `src/lattice/grid.ts` | 8.93% |
| `sweepClear` / `src/route/clear.ts` | 6.09% |
| `coreOf` / `src/geom/distance.ts` | 5.33% |
| `hitBlocks` / `src/route/clear.ts` | 4.59% |
| `simplifyCollinear` / `src/geom/path.ts` | 2.99% |
| `dop8OfPts` / `src/geom/bounds.ts` | 2.68% |
| `legaliseShaped` / `src/route/legalise.ts` | 2.64% |
| `closerConvex` / `src/route/clear.ts` | 2.58% |

[Profile summary](remaining-checks/profile/summary.json),
[raw profile, gzip](remaining-checks/profile/recovery.cpuprofile.gz),
[replays](remaining-checks/profile/replays.json). The raw profile SHA-256 is in
the summary. No geometry/index micro-optimisation is adopted here; production
budget/cancellation integration remains the next priority.

```bash
mkdir -p /tmp/recovery-profile
taskset -c 12-19 nice -n 10 timeout 300 bun --cpu-prof --cpu-prof-name=recovery.cpuprofile --cpu-prof-dir=/tmp/recovery-profile docs/pr-assets/agent-fab-router-perf-local-rescue/run-remaining-profile.ts /tmp/recovery-profile/replays.json
python3 docs/pr-assets/agent-fab-router-perf-local-rescue/summarise-remaining-profile.py /tmp/recovery-profile/recovery.cpuprofile /tmp/recovery-profile/replays.json /tmp/recovery-profile/summary.json
```
