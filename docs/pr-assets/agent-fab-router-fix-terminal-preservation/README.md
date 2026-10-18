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
for provenance, per-case outcomes and limitations once the run completes.
