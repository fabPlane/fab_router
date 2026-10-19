The DSN exporter retains sub-lattice placement. For example, a footprint at
70.405952 mm exports as 70405.952 µm. Layout construction quantizes it to 70406 µm;
previous session export then imported that rounded location into the native board.
The fix retains the authored location of an unchanged imported part, using a
separate nanometre placement resolution when needed. Explicitly moved parts use
their current positions. Route resolution and generated copper are unaffected.

The three synthetic boards isolate native save, writer-session import, and an
empty-placement import control, each repeated three times. The empty-placement
control is diagnostic only; scored benchmark outputs are never modified.

Seven regressions cover off-lattice coordinates, both axes, unit conversion,
on-lattice output, moved parts, added parts, and direct authored-coordinate checks
across the engine corpus. The 24 updated expected trees change only placement
coordinates/resolution. Component identities, rotations, sides, and every other
canonical scope remain equal; see golden-audit.json. Acceptance comparisons remain
strict. The placement resolution exception is documented in spec/formats/ses.md.

Native benchmark evidence and comparison.json contain every attempt from both
26-case, three-repeat runs. This is a placement-fidelity fix. Existing thermal DRC
failures and unrouted connections remain unresolved; no routing-speed gain is claimed.

Reproduce from the engine checkout (native benchmark setup is required):

```bash
bun run typecheck && bun run check:layers && bun run test
bun test test/ses-placement-precision.test.ts
/usr/bin/python3 docs/pr-assets/agent-fab-router-fix-placement-precision/c196/probe.py \
  "$PWD" ~/bench/agents/codex-fabpcb-bugs/scratch/c196/repro-probe --fixed
cd ~/bench/wt/fp-bugs
taskset -c 20-25 nice -n 10 python3 benchmarks/autorouter/benchmark.py \
  --router fab-router \
  --fab-router-source ~/bench/agents/codex-fabpcb-bugs/scratch/c196/before-source \
  --out ~/bench/agents/codex-fabpcb-bugs/scratch/c196/repro-before
taskset -c 20-25 nice -n 10 python3 benchmarks/autorouter/benchmark.py \
  --router fab-router --fab-router-source ~/bench/wt/fr-bugs \
  --out ~/bench/agents/codex-fabpcb-bugs/scratch/c196/repro-after
```

The before checkout is unmodified commit 69cf598db98c136bff16bbe02bccdded95674b18.
The after run records working-tree source hashes; those hashes are independently
checked against the published source. For archived comparisons, extract the evidence
archive and invoke compare.py with the before directory, after directory, and output
JSON path. These scripts require the native Python module.

The strict source-pad inventory is copied unchanged from engine commit
`db315c4b8fa5c7e863bf5077d09290f9ebad8c15` for reproducible validation. Run:

```bash
bun docs/pr-assets/agent-fab-router-fix-placement-precision/c196/audit-pads.ts \
  /path/to/before /path/to/after /tmp/pad-audit.json
/usr/bin/python3 docs/pr-assets/agent-fab-router-fix-placement-precision/c196/compare.py \
  /path/to/before /path/to/after /tmp/comparison.json
```

Measured result (same 26 tasks × 3 repeats per phase):

| Metric | Before | After |
| --- | ---: | ---: |
| Native passes | 39/78 | 39/78 |
| Cases valid 3/3 | 13/26 | 13/26 |
| Opens | 120 | 120 |
| New native errors | 27 | 27 |
| Outputs with moved footprints | 12/78 | 0/78 |
| Strict source-pad inventory preserved | 66/78 | 78/78 |

All 78 route scopes are identical. Original and extracted archive comparisons pass.
