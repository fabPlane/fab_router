The four-pad fixture isolates a power-track access failure seen on the rufs J3 board.
The pad's centre and long-edge midpoint collide with neighbouring pads at full track width.
A round end-cap centred outside the pad can still overlap its copper with positive area.
The new fallback requires exact pad contact, exact clearance and actual terminal connectivity
after insertion. It uses at most eight candidates per endpoint and retains the existing
connection deadline, cancellation and global item budgets. It tries hard-obstacle searches;
it does not rip copper for the fallback. Candidate points are deterministic axial offsets
from convex-core vertices and edge midpoints; this is a bounded strategy, not exhaustive access.

Run from the repository root:

```bash
taskset -c 20-25 nice -n 10 python3 docs/pr-assets/agent-fab-router-fix-endcap-access/regression.py --baseline 69cf598 --repeats 3 --out /tmp/endcap-regression
bun docs/pr-assets/agent-fab-router-fix-endcap-access/audit.ts > /tmp/endcap-after.json
python3 docs/pr-assets/agent-fab-router-fix-endcap-access/render.py
python3 docs/pr-assets/agent-fab-router-fix-endcap-access/render-native.py
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
cd ~/bench/wt/fp-bugs
taskset -c 20-25 nice -n 10 timeout 1800 python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source ~/bench/wt/fr-bugs --out /tmp/endcap-native
cd ~/bench/wt/fr-bugs
python3 docs/pr-assets/agent-fab-router-fix-endcap-access/summarize.py ~/bench/agents/codex-fabpcb-bugs/scratch/c1-before-full /tmp/endcap-native --source-commit 7dffe49
```

For a fresh native baseline, extract `69cf598` into a separate directory and run the same
benchmark command using that directory as `--fab-router-source` and a distinct `--out`.
The recorded baseline and candidate use the same machine, CPUs 20–25, frozen inputs/rules,
harness, native checker, runtime, deterministic order and three seeds per case.
Timing is descriptive on a shared host; no speed improvement is claimed.

`before.json` and `after.json` contain three public-API fixture runs each, with all copper
records. `regressions.json` identifies repeated test outcomes and log hashes. Native images
are unchanged KiCad front-copper exports, cropped to identical board coordinates in the
comparison. To regenerate either source export from the corresponding result board:

```bash
kicad-cli pcb export svg --layers F.Cu --page-size-mode 1 --exclude-drawing-sheet --mode-single --output /tmp/native.svg /path/to/final.kicad_pcb
```

The native board's original license is retained in `native-board-LICENSE`. The fixture and
rendering/audit scripts are original repository work. No frozen board, rule, checker or
runtime was changed. The synthetic fixture does not model thermal spokes; unresolved native
thermal starvation remains outside this fix.

This independent branch starts at main and does not include PR #20's on-pad attachment fallback.
Both changes touch the final fallback in `routeConnection`; preserve both attachment strategies
and the end-cap post-insertion connectivity check during integration. Other pending `passes.ts`
fixes also need to be preserved. Performance branches modifying geometry were not edited.
