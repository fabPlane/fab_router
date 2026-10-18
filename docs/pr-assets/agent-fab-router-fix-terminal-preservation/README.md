# Terminal preservation during optimisation

The original four-pad fixture is in `test/helpers/optimise-terminals.ts`. A free
router track joins A–C–B. D is isolated on the potential A–B shortcut. The old
optimiser accepts that shortcut: C becomes isolated and D joins A/B, keeping the
aggregate incomplete count at one. This violates R-6 despite zero DRC violations.
The new guard preserves connected groups of pad/pour terminal IDs, updating its
baseline after each accepted mutation. Track/barrel IDs may change normally.

The regression also covers a pour replacing C, a held branch from the bend to C,
and a safe shortening with an independent retained connection to C. The image is
plotted from actual synthetic fixture coordinates, not a native board render.
Three-repeat `before.json`/`after.json` audits retain input/output copper and pad
partitions. These diagnostic results are not native benchmark pass counts.

Reproduce from the repository root (output paths may be changed):

```bash
mkdir -p /tmp/terminal-baseline
git archive 69cf598 src spec | tar -x -C /tmp/terminal-baseline
bun docs/pr-assets/agent-fab-router-fix-terminal-preservation/audit.ts /tmp/terminal-baseline /tmp/terminal-before.json
bun docs/pr-assets/agent-fab-router-fix-terminal-preservation/audit.ts "$PWD" /tmp/terminal-after.json
bun test test/optimise-terminals.test.ts
bun run typecheck && bun run check:layers && bun run test
cd /home/hyper/bench/wt/fp-bugs
taskset -c 20-25 nice -n 10 timeout 3600 python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source /home/hyper/bench/wt/fr-bugs --out /tmp/terminal-native-full
```

The baseline archive is read-only test source, not another worktree. Both audits
use the same parser, fixture and lattice; only the optimiser module differs.
Native before/after comparison uses the same 26 frozen cases, three repeats,
settings and checker on the same machine/core set. See benchmark-summary.json
for provenance, per-case outcomes and limitations.

After a complete native sweep, validate source identity and all before/after
controls and outcomes from the router repository root:

```bash
python3 docs/pr-assets/agent-fab-router-fix-terminal-preservation/validate.py /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c1-before-full /tmp/terminal-native-full "$PWD" /tmp/terminal-benchmark-summary.json
```

The baseline is the historical same-machine main-source sweep at `69cf598`;
its source hashes are verified against that commit. The candidate sweep records
the pre-commit HEAD because the fix was committed while native checking ran;
all 74 captured source hashes are verified against the committed fix. No
executable source changed during either sweep. Independent pending PRs #8 and
#9 touch the same optimizer: integration must retain their isolated-copper
cleanup and ignored-net mutation guards alongside this partition guard.

## Measured outcome

All 78 frozen attempts match main in pass/open/error/via/length outcomes:
39/78 passing, 13/26 cases valid 3/3, 120 opens, 27 new errors (all thermal).
Median route seconds are 1.172079 before and 1.152014 after (-1.7%); the shared
host and overlapping tests preclude an isolated speed claim. The regression
fix preserves A–C in 3/3 synthetic repeats versus 0/3 on main, with one open
and zero DRC violations in both versions. Native completion did not improve.
Required checks passed: typecheck, layers (65 files, zero violations), and
863 tests / zero failures / 398478 assertions (213.53 seconds). No golden,
DRC, scoring, frozen fixture or runtime changes were needed.
