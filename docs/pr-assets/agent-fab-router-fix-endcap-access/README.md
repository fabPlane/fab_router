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

Measured full native results (26 cases, three repeats each): main 39/78 passes, 13/26 valid
cases, 120 opens, 27 new thermal errors; candidate 42/78 passes, 14/26 valid cases, 117 opens,
27 new thermal errors. Only rufs J3 changes: each repeat gains completion, with one extra via
and 4.988991 mm more track. All other pass/open/error-type/via/length values are identical.
All 74 captured engine source hashes match `7dffe49`; the harness captured main HEAD before
the source commit was created. Executable sources stayed unchanged during the entire sweep.
The source and control audit is in `benchmark-summary.json`; the native checker evidence for
the pictured repeat is in `native-contact.json`. The full required checks passed: typecheck,
65 layer-checked files with zero violations, 866 tests, zero failures, 398510 assertions.

The follow-up policy tests use two independent blocked-centre connections. A global item
cap of one completes only one net across three allowed passes; a cap of two completes both.
Ignoring either group leaves that net physically open while completing the active net.
All cases preserve pads, use full-width tracks, add no vias and have zero engine violations.
The identical expanded eleven-test suite runs three times per revision: main passes two
controls and fails nine tests; the candidate passes all eleven. `policy-regressions.json`
records source identities, commands, results and log hashes. The engine remains byte-identical
to native-measured `7dffe49`; no additional native sweep or routing gain is claimed.

Final follow-up checks: typecheck passes; 65 files have zero layer violations; 870 tests
pass with zero failures and 398546 assertions (222.21 seconds).

Integration audit for PR #20 and PR #27:

```bash
taskset -c 20-25 nice -n 10 timeout 1500 python3 docs/pr-assets/agent-fab-router-fix-endcap-access/composition.py --out /tmp/pad-endcap-composition --full
```

Use a new output directory. The script extracts the two pinned revisions, installs
both final regression files identically in all three snapshots, and composes the
on-pad short probes before the unchanged end-cap fallback. It writes an exact patch
against `e65b9c3`, source/test/log hashes and results. The patch is a review artifact;
production sources on this branch remain unchanged. Existing local dependencies are
shared read-only through a symlink.

Across three repeats each, pad-edge alone passes 18/27 and fails nine end-cap cases;
end-cap alone and the composition each pass all 27. Thus the present regression corpus
does not establish any extra completion benefit from retaining the on-pad fallback.
The composition preserves it to check the integration requested in both PRs. This
covers engine compatibility only; no composed native benchmark or new native routing
improvement is claimed. The earlier native table applies only to the independent
end-cap source `7dffe49`, not to the composed patch.

Full composition checks pass: typecheck, 65 layer-checked files/zero violations,
886 tests/zero failures/398644 assertions (212.15 seconds). Independent branch
checks also pass: 870 tests/zero failures/398546 assertions (212.64 seconds).
All 80 engine/type files on the independent branch still match native-measured
`7dffe49`. See `composition.json`, `composition.patch` and
`composition-branch-checks.json` for the pinned inputs, exact patch and log hashes.
