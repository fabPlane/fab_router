Plane contact regression evidence
===============================

`tryPlaneVia` used to treat a via spanning a plane sheet as successful plane-net completion, even when the target pour was elsewhere or had a hole around the via. The minimal two-layer fixture has one signal pad and one plane pour. The regression first fails on main; the control places real pour copper underneath the pad. A barrel-only fence also forces a displaced via and stub, checking atomic rollback and a successful displaced escape.

The fix verifies live connectivity of the original connection terminals after inserting the via and legalised stub. If they remain separate, the journal rewinds before another sheet or ordinary routing tier is considered. It does not extend the existing via search or guarantee that all reachable pour copper will be found. Rejected fixtures still have one open. Native thermal starvation remains unresolved.

`regressions.json` includes three identical fixture audits per version, full measured copper, per-test outcomes and log hashes. The public API repeated-pass audit demonstrates three false completions/three useless vias before, zero/zero after. The actual connection remains open in both. All synthetic engine checks report zero violations. These are synthetic engine diagnostics, not native benchmark passes.

```bash
taskset -c 20-25 nice -n 10 python3 docs/pr-assets/agent-fab-router-fix-plane-contact/regression.py --baseline 69cf598 --repeats 3 --out /tmp/plane-contact-regression
python3 docs/pr-assets/agent-fab-router-fix-plane-contact/render.py
taskset -c 20-25 nice -n 10 timeout 1800 bash -c 'bun run typecheck && bun run check:layers && bun run test'
cd ~/bench/wt/fp-bugs
taskset -c 20-25 nice -n 10 timeout 2400 python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source ~/bench/wt/fr-bugs --out /tmp/plane-contact-native
```

The render uses the actual measured pad/pour/via geometry and projects both copper layers at a common scale; it is not a native board render. The fixture and rendering code are authored for this regression. No external board asset is used.

The native summary script checks every captured source hash, frozen controls, case/seed outcomes and copper counts against the same-host historical main sweep. Run it with the source commit recorded in benchmark-summary.json:

```bash
python3 docs/pr-assets/agent-fab-router-fix-plane-contact/summarize.py ~/bench/agents/codex-fabpcb-bugs/scratch/c1-before-full /tmp/plane-contact-native --source-commit COMMIT
```

This independent main-based change touches the plane-via helper in passes.ts. Other pending terminal-preservation, progress, prior-target and pad-access fixes must be retained separately during integration. No performance functions change.

Requested pour component controls
--------------------------------

Four additional tests place a separate same-net pour under the signal pad while the requested pour remains distant. Both endpoint orders must reject the local escape if it only contacts the wrong component. A retained plane-layer track then joins the pours: both endpoint orders must accept the same via through transitive copper connectivity. Tests preserve the retained track/pads/pours, compare live and rebuilt connectivity, assert zero spacing violations, and rewind successful insertions through the caller's journal mark.

The identical four tests run three times per revision: main passes two connected controls and fails both disconnected cases; the guard passes all four. `components.json` records per-run outcomes/log hashes and engine/test hashes. This is additional synthetic regression coverage, not a new production change or native benchmark run; the recorded full native sweep still covers the unchanged engine.

```bash
taskset -c 20-25 nice -n 10 python3 docs/pr-assets/agent-fab-router-fix-plane-contact/component-regression.py --out /tmp/plane-components
```

Final cycle-42 required checks passed: typecheck, layer checks (65 files, zero violations), and 869 tests / zero failures / 398557 assertions (215.99 seconds). The full log includes all four added component tests; its hash is recorded in components.json.

## Reachable plane candidates

A clear via at the signal pad can miss the plane while a later ring candidate contacts it.
The first-placement helper previously stopped the plane escape before examining that candidate.
`viaDropsNear` now enumerates the existing ordered, bounded placements; `dropViaNear` still
returns the first placement for its other callers. Plane routing inserts each candidate and
its legalised stub, verifies live connectivity to the requested terminal, and rewinds rejected
copper before trying another candidate. The connection deadline and cancellation signal apply.
This extends the contact guard; it does not add an exhaustive plane search or native thermal model.

Five additional regressions cover a nearby pour edge and window edge in both endpoint orders,
plus the public API. Each fixture changes from one open to zero with one via and one stub;
there are zero engine spacing violations and caller rollback restores the initial board.
Three repeats of the identical tests: `3189e6c` **0 pass / 5 fail** each; candidate search
**5 pass / 0 fail** each. These are synthetic engine fixtures, not frozen native benchmark passes.

```bash
python3 docs/pr-assets/agent-fab-router-fix-plane-contact/candidate-regression.py --out /tmp/plane-candidates
bun test test/plane-candidate-search.test.ts test/plane-contact.test.ts test/plane-target-component.test.ts
python3 docs/pr-assets/agent-fab-router-fix-plane-contact/candidate-render.py
```

`candidates.json` contains repeated raw geometry, log hashes, and source/test hashes.
`plane-candidates.png` renders that geometry with both layers projected at the same scale.
