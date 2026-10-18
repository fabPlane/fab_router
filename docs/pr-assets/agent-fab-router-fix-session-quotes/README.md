# Design quote inheritance during session import

`writeSes` uses the design quote character required by F-S30. `applySes` previously
lexed every session with the default double quote. With an apostrophe design,
`'signal (A)'` became an unknown net and `'front (signal)'` an unknown layer;
replacement removed the input track and imported none. The result still reported
`ok: true` with a warning. The fix initializes the lexer from `Layout.file.quote`,
then the legacy attached document, then the double-quote default. A declaration
in the session overrides that inherited initial state through the existing lexer.

The fixture is an original two-point track, 1 mm long and 0.2 mm wide, on one
layer. It exercises public write/apply APIs without a native board or proprietary
material. `comparison.png` renders actual track records; the dashed mark denotes
the input geometry when import loses it. It is not a native board render.

## Reproduce the regression and three-repeat audit

From the repository root, with Bun 1.4:

```bash
bun test test/session-quotes.test.ts
bun run docs/pr-assets/agent-fab-router-fix-session-quotes/audit.ts "$PWD" > /tmp/session-quotes-after.json
python3 docs/pr-assets/agent-fab-router-fix-session-quotes/render.py
bun run typecheck && bun run check:layers && bun run test
```

For the same audit on main, use a separate source snapshot. The script remains
in the candidate checkout and loads the API from the supplied source root:

```bash
mkdir -p /tmp/session-quotes-main
git archive 69cf598 | tar -x -C /tmp/session-quotes-main
bun run docs/pr-assets/agent-fab-router-fix-session-quotes/audit.ts /tmp/session-quotes-main --expect-missing > /tmp/session-quotes-before.json
```

The default audit asserts preservation; `--expect-missing` asserts the known
baseline loss and its warning. `before.json` and `after.json` retain all three
repeats, full track records, session text and diagnostics. Seven regression tests
cover attached/copy/legacy layouts, authoritative public facts, explicit session
declarations, ordinary double quotes and quoted-layer lookup with a bare net.

## Native nonregression

On the same Linux host, pinned to cores 20–25, from the integration checkout:

```bash
cd /home/hyper/bench/wt/fp-bugs
taskset -c 20-25 nice -n 10 timeout 3600 python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source /home/hyper/bench/wt/fr-bugs --out /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c17-final-full
```

Compare with the historical main run (same machine, cases, seeds, controls):

```bash
cd /home/hyper/bench/wt/fr-bugs
python3 docs/pr-assets/agent-fab-router-fix-session-quotes/validate.py /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c1-before-full /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c17-final-full "$PWD" /tmp/session-quotes-benchmark.json
```

`benchmark-summary.json` records final measurements and verifies captured source
hashes against the candidate files and baseline commit. The frozen native boards
use ordinary quotes; this sweep checks for regressions, while the tiny fixture
exercises the repaired path. Timing on a shared host with overlapping tests is
descriptive only. Other pending independent fixes are excluded.

The first native launch (`c17-after-full`) was deliberately interrupted after
strict typechecking exposed an optional-property error. Its artifacts are retained;
it is not a completed run or a benchmark score. The final launch uses the explicit
fallback and a fresh directory. No executable source changes during the final run.
