# Nudge terminal membership regression

`nudgeClear` removes a conflicting free track and asks its caller to reroute the
track between its first and last points. Keeping those endpoints does not keep
pads or branches attached to the original track's interior. The old code accepts
a clear replacement that disconnects C and connects previously isolated D; A and
B remain joined, and the incomplete count remains one.

The fix snapshots pad/pour terminal groups for affected nets before removing any
victims. After rerouting and the existing exact clearance check, every original
group must remain connected. Otherwise the complete trial rewinds through the
existing Journal, restoring the live Lattice as well as the original tracks.
Prior helper pours remain nonterminals. No additional DRC rules are inferred.

The original synthetic fixture has four pads, one layer, and one free track. A
second case attaches C through a retained held branch. Neither fixture contains
board-source material. The supplied image renders actual recorded geometry;
it is not a native board render. The dashed line is the requested channel, not
committed copper. A rejected nudge leaves that channel blocked.

| Same fixture on the same host/cores, three repeats | Main | Candidate |
| --- | ---: | ---: |
| Interior C remains joined to A/B | 0/3 | 3/3 |
| C through a held branch remains joined to A/B | 0/3 | 3/3 |
| Total opens, each fixture/repeat | 1 | 1 |
| Engine spacing violations, each fixture/repeat | 0 | 0 |
| Targeted regression tests, each repeat | 1 pass / 2 fail | 3 pass / 0 fail |

The third regression accepts a safe reroute retaining the original terminal
group. Rejection tests also verify original copper records, journal mark, live
obstacle presence and the blocked-channel query after rollback. These are helper
regressions for a production strategy rung; they do not establish a completion
improvement on a frozen board.

Reproduce from the repository root:

```bash
bun run typecheck
bun run check:layers
bun run test
for repeat in 1 2 3; do
  timeout 60 taskset -c 20-25 nice -n 10 bun test test/nudge-terminals.test.ts
done
bun run docs/pr-assets/agent-fab-router-fix-nudge-terminals/audit.ts > /tmp/nudge-after.json
python3 docs/pr-assets/agent-fab-router-fix-nudge-terminals/render.py
```

For the before comparison, create a separate source directory using
`git archive 69cf598 | tar -x -C /tmp/nudge-main` (create the directory first),
copy the two new test files into the corresponding `test/` directories there,
and run its test with Bun. The audit accepts that directory as its final
argument; it loads the before nudge implementation while keeping the identical
fixture, journal, clearance and connectivity modules.

Native verification uses the unchanged standalone harness:

```bash
cd /home/hyper/bench/wt/fp-bugs
timeout 2400 taskset -c 20-25 nice -n 10 python3 benchmarks/autorouter/benchmark.py \
  --router fab-router \
  --fab-router-source /home/hyper/bench/wt/fr-bugs \
  --out /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c23-after-full
```

`benchmark-summary.json` contains the completed before/after full-suite results,
per-case metrics and verified candidate hashes. The before sweep is the existing
cycle-1 main measurement on the same host, core set, frozen cases, settings,
checker/runtime, order and seeds. The candidate sweep began before the source
commit was created; its source identity is verified by file hashes. Timings are
descriptive shared-host observations; required tests overlap the candidate run.

This branch starts at main and excludes other independent pending fixes. During
integration, preserve PR #15's ignored-obstacle guard in `nudgeClear`; PR #12's
terminal-preservation fix applies to optimisation and is a separate caller.
The current performance PR modifies lattice tests/evidence, outside this fix.
Native thermal starvation remains unresolved.

Validate the full native comparison and source hashes with:

```bash
python3 docs/pr-assets/agent-fab-router-fix-nudge-terminals/summarize.py \
  /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c1-before-full \
  /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c23-after-full
```

Completed full native comparison: 39/78 passing attempts, 13/26 valid cases,
120 opens and 27 new thermal errors before and after. Every attempt has identical
pass/open/error/via/length metrics. Median route seconds 1.172079 → 1.254189
(+7.0%); negative descriptive shared-host/test-overlap observation.
Required checks: typecheck, layer boundaries (65 files, zero violations),
862 tests / zero failures / 398474 assertions, 221.02 seconds.
