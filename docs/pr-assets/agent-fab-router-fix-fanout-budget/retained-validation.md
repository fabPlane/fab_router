# Retained copper and nested fanout rollback

The additional regressions exercise the existing budget fix with retained file
copper and a journal that already contains an insertion and a removal. In the
late-rejection case the first escape is accepted and the second exceeds the
remaining budget. Rewinding fanout must preserve the earlier journal operations;
rewinding the outer transaction must then restore the original file copper.
These tests add no production changes.

Same machine, cores 20–25, three repeats per version; baseline source `69cf598`,
candidate production source `cfe7376`:

| Measurement, identical in every repeat | Before | After |
| --- | ---: | ---: |
| Cap 1, existing track + via: new items | 2 | 0 |
| Cap 2, existing track + via: new items | 2 | 2 |
| Cap 3, earlier journal mutations: new fanout items | 4 | 2 |
| Cap 3, earlier journal mutations: escaped pads | 2 | 1 |
| Final engine DRC violations in each scenario | 0 | 0 |
| Regression tests per repeat | 1 pass / 2 fail | 3 pass / 0 fail |

The cap-2 control proves that existing copper does not consume the additions-only
stage budget. The journal test checks retained records, inserted IDs, live index
membership, operation counts and both nested rewinds. Full geometry and reports
are in `retained-before.json` and `retained-after.json`.

Reproduce from the repository root (the baseline snapshot stays outside the worktree):

```bash
scratch_dir="$HOME/bench/agents/codex-fabpcb-bugs/scratch/c22-reproduce"
mkdir -p "$scratch_dir/test/helpers"
git archive 69cf598 src spec/types | tar -x -C "$scratch_dir"
cp test/fanout-budget-retained.test.ts "$scratch_dir/test/"
cp test/helpers/fanout-budget.ts "$scratch_dir/test/helpers/"
(cd "$scratch_dir" && taskset -c 20-25 nice -n 10 bun test test/fanout-budget-retained.test.ts)
taskset -c 20-25 nice -n 10 bun test test/fanout-budget-retained.test.ts
taskset -c 20-25 nice -n 10 bun docs/pr-assets/agent-fab-router-fix-fanout-budget/retained-audit.ts "$scratch_dir"
taskset -c 20-25 nice -n 10 bun docs/pr-assets/agent-fab-router-fix-fanout-budget/retained-audit.ts .
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

The first test command intentionally fails on the baseline. Repeat the test and
audit commands three times to reproduce the reported stability. The audit itself
already performs three repeats.

All 80 tracked `src` / `spec/types` files match `cfe7376` byte for byte. No native
benchmark was repeated for this test-only follow-up. The retained cycle-20 full
native comparison is 39/78 passing attempts, 13/26 cases valid 3/3, 120 opens and
27 new thermal errors, unchanged from main. No new completion, thermal safety
or speed improvement is claimed. The existing budget chart illustrates the same
resource-bound repair.

Complete cycle-22 checks passed: typecheck; layer checks (65 files, zero violations); 870 tests, zero failures, 398537 assertions (216.07 seconds). Log hashes and source identity are retained in `retained-checks.json`.
