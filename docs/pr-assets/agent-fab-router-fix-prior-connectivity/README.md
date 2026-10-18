# Prior-copper connectivity after rip-up

`tryAttachPrior` previously used connectivity cached at the beginning of the pass. An earlier connection can rip the track that joined a terminal to Prior copper. A later attachment then routes just the other terminal to that copper and returns success while the intended terminals remain disconnected. Recompute connectivity when usable same-net Prior copper exists. Nets without such copper skip the extra connectivity calculation.

The four-pad, one-sheet fixture has a locked obstacle, two signal terminals, one Prior rectangle and a retained signal bridge. It starts with zero spacing violations. A journalled removal models earlier rip-up. Before the fix, both endpoint orientations return success with one open. After the fix, both terminals reach Prior copper, zero opens remain, and no violations or vias are added. Journal rollback and preservation of the obstacle and Prior copper are asserted. The intact-bridge control stays connected and unchanged.

`before.json` and `after.json` contain three repeats each of the removed-bridge and intact-bridge fixtures, including full measured geometry. The PNG is a render of the first removed-bridge run. `regressions.json` records three repeated baseline/fixed test logs by hash; baseline is 1 pass/2 failures each time, candidate is 3 passes/0 failures each time.

Reproduce (Bun 1.4, Linux):

```bash
# Prepare a baseline outside the checkout, then run the same final test file.
mkdir -p /tmp/prior-connectivity-baseline
git archive 69cf598 | tar -x -C /tmp/prior-connectivity-baseline
cp test/prior-connectivity.test.ts /tmp/prior-connectivity-baseline/test/
cp test/helpers/prior-connectivity.ts /tmp/prior-connectivity-baseline/test/helpers/
for repeat in 1 2 3; do
  taskset -c 20-25 nice -n 10 timeout 60 bun test --cwd /tmp/prior-connectivity-baseline test/prior-connectivity.test.ts
  taskset -c 20-25 nice -n 10 timeout 60 bun test test/prior-connectivity.test.ts
done
# The baseline test is expected to exit 1.
taskset -c 20-25 nice -n 10 timeout 60 bun docs/pr-assets/agent-fab-router-fix-prior-connectivity/audit.ts /tmp/prior-connectivity-baseline
taskset -c 20-25 nice -n 10 timeout 60 bun docs/pr-assets/agent-fab-router-fix-prior-connectivity/audit.ts "$PWD"
python3 docs/pr-assets/agent-fab-router-fix-prior-connectivity/render.py
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
# From an independently configured native benchmark checkout:
# Give the archived baseline Git metadata for the benchmark source audit.
git -C /tmp/prior-connectivity-baseline init
git -C /tmp/prior-connectivity-baseline add .
git -C /tmp/prior-connectivity-baseline -c user.name=Benchmark -c user.email=benchmark@localhost commit -m 'Prepare routing baseline'
cd /home/hyper/bench/wt/fp-bugs
taskset -c 20-25 nice -n 10 timeout 1200 python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source /tmp/prior-connectivity-baseline --out /tmp/prior-connectivity-native-before
taskset -c 20-25 nice -n 10 timeout 1200 python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source /home/hyper/bench/wt/fr-bugs --out /tmp/prior-connectivity-native
```

The committed native summary validator checks every captured source hash against its Git revision, matches frozen input/configuration/harness/runtime/order/seed/CPU controls, and requires identical per-attempt pass/open/error/via/length outcomes. The native sweep measures 26 cases, three repeats each, on the same host and cores as the baseline. It is a complete fab_router sweep, not a five-engine comparison. Native thermal starvation and the separate Issue026 no-via acceptance failure remain unresolved. This PR does not include the other pending fixes.

Generate the public summary from saved runs, in the router checkout:

```bash
python3 docs/pr-assets/agent-fab-router-fix-prior-connectivity/summarize.py /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c1-before-full /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c33-after-full --source 9963847 --out docs/pr-assets/agent-fab-router-fix-prior-connectivity/benchmark-summary.json
```

| Verification | Main 69cf598 | Fix 9963847 | Repeats |
| --- | ---: | ---: | ---: |
| Regression file | 1 pass / 2 failures | 3 pass / 0 failures | 3 each |
| Removed-bridge fixture opens | 1 | 0 | 3 each |
| Intact-bridge control opens | 0 | 0 | 3 each |
| Fixture DRC violations, either control | 0 | 0 | 3 each |
| Native passing attempts | 39/78 | 39/78 | 3 per case |
| Native cases valid 3/3 | 13/26 | 13/26 | 3 per case |
| Native opens, summed attempts | 120 | 120 | 3 per case |
| New native DRC errors, summed attempts | 27 | 27 | 3 per case |
| Median native route seconds | 1.172079 | 1.152706 | 78 attempts each |

Validation: typecheck passed; layer check passed (65 files, zero violations); 862 tests passed, zero failed, 398479 assertions (234.93 seconds). The check-log hash is in `checks.json`. Native timing is descriptive on a shared host with overlapping tests, with no speed claim. Every native outcome and copper metric matches baseline; all 27 new errors remain thermal starvation.
