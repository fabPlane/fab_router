# Clear search trails lost during angle shaping: rejected fallback

This is diagnostic evidence, with **no production engine change**. The four-pad fixture reduces one real Issue026 J2 no-via failure. Its direct line passes exact clearance, but both 45° shapings cross the required clearance of a neighbouring pad. A* finds an already clear detour, then string pulling replaces it with that same direct shortcut; legalisation fails. All four fixture rotations fail on main.

`candidate.patch` retries the original centreline through the existing exact legaliser after the pulled path fails. No clearance rule changes. Identical tests run three times per version: main 0 pass / 4 fail; proposal 4 pass / 0 fail, with full-width tracks, unchanged pads, zero vias and zero engine violations. Tests live here as an explicit unresolved diagnostic, outside the active suite. The portable runner installs the same tests into both disposable trees, asserts their expected exit statuses, and preserves raw logs in `regressions.json`.

Same input, settings, runner, machine and CPUs 20–25; three repeats each:

| Measurement | Main | Rejected fallback |
| --- | ---: | ---: |
| Four-pad regression tests per repeat | 0/4 pass | 4/4 pass |
| Four-pad opens per repeat | 1 | 0 |
| Issue026 no-via acceptance opens per repeat | 12 | 10 |
| Issue026 acceptance passes (unchanged maximum six) | 0/3 | 0/3 |
| Full native pass attempts | 39/78 | 42/78 |
| Native cases valid 3/3 | 13/26 | 14/26 |
| Native total opens | 120 | 123 |
| Native total new thermal errors | 27 | 27 |
| Native hellscribe J2-large opens / thermal errors per repeat | 1 / 0 | 2 / 1 |
| Native nextbus J3 opens per repeat | 3 | 7 |

**Rejected:** new native thermal errors and worsened opens on individual cases violate nonregression despite the aggregate pass gain. Hellscribe J1 improves from 0/3 to 3/3, paperino J4 loses one open per repeat, and Aquarius loses one thermal error per repeat. Aggregate thermal counts therefore hide the new hellscribe J2-large error; `native-rejection.json` preserves each native finding. All 26 cases and every attempt are retained in `benchmark-summary.json`, with 74 candidate source hashes and input/config/checker/runtime/order/seed/core controls verified against the historical exact-main reference. Native zone refill semantics remain unrepresented by the engine. No native safety or performance gain is claimed.

The candidate full checks pass typecheck/layer boundaries but fail the unchanged Issue026 J2 fingerprint: 862 pass / 1 fail. That golden was not edited. The final evidence branch has all 80 engine/type files identical to main; its isolated exact-source checks pass typecheck, 65 layer-checked files and 859 tests / 398454 assertions. `final-checks.json` records hashes, and final branch source/test bytes were checked against the tested snapshot.

Fresh-input traces keep all original obstacles and disable rip-up/optimisation. Five pairs (nets 2, 4, 5, 7, 9) hit the pop cap at both resolutions. Four others (nets 0, 15, 16, 18) find paths but never insert; some proposed edges cross obstacles, while net 0 has every original segment clear. Three pairs insert on fresh input. This classifies these attempts, without asserting the five capped pairs are geometrically impossible or that every insertion failure has the same cause.

Reproduce (new output directories required):

```bash
taskset -c 20-25 nice -n 10 timeout 900 python3 docs/pr-assets/agent-fab-router-no-via-triage/trail/regression.py --out /tmp/trail-regression --repeats 3
taskset -c 20-25 nice -n 10 timeout 120 python3 docs/pr-assets/agent-fab-router-no-via-triage/trail/trace.py --out /tmp/trail-trace
python3 docs/pr-assets/agent-fab-router-no-via-triage/trail/render.py /tmp/trail-regression/regressions.json --out /tmp/trail-image
# Use the runner-created /tmp/trail-regression/after as the candidate source.
# The harness requires Git HEAD metadata. This local snapshot is never pushed.
git -C /tmp/trail-regression/after init -b agent/trail-experiment
git -C /tmp/trail-regression/after add src spec tools test package.json tsconfig.json bun.lock bunfig.toml
git -C /tmp/trail-regression/after -c user.name=RouterExperiment -c user.email=experiment@example.invalid commit -m "Record rejected routing experiment"
cd /path/to/fp-bugs
taskset -c 20-25 nice -n 10 timeout 1800 python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source /tmp/trail-regression/after --out /tmp/trail-native
```

The recorded native command used `/home/hyper/bench/wt/fr-bugs` while the candidate patch was present, with output `/home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c52-after-full`. Its captured HEAD predates the patch commit; **source hashes**, checked against the portable proposal, establish the exact tested code. To audit saved benchmark runs:

```bash
python3 docs/pr-assets/agent-fab-router-no-via-triage/trail/summarize.py /path/to/c1-before-full /path/to/c52-after-full --candidate-json docs/pr-assets/agent-fab-router-no-via-triage/trail/regressions.json
```

Next work: preserve angle-feasible paths without promoting this fallback, and solve native thermal constraints before accepting changed copper. Search-pop limits are a separate remaining failure class.
