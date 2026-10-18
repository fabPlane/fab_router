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
