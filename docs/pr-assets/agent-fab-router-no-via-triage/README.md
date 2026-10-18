The existing `routing-slow-issue026-j2-novia` acceptance case still fails: the engine
leaves 12 connections open against an unchanged maximum of six. This is diagnostic
evidence, not a production fix. All experiments retain the input, settings, checker
and expected bound; only one search strategy changes at a time. The permitted engine
violations and added via counts remain zero. Native DRC and thermal refill are outside
this engine acceptance case.

| Version | Repeats | Passes | Opens per repeat | Added vias | Added engine violations |
| --- | ---: | ---: | ---: | ---: | ---: |
| Main | 3 | 0/3 | 12 | 0 | 0 |
| Reverse hard same-sheet fallback | 3 | 0/3 | 12 | 0 | 0 |
| Grid divisors 1, 2, 4, 8 for every span | 3 | 0/3 | 11 | 0 | 0 |
| Exact hard-search edge checks | 3 | 0/3 | 12 | 0 | 0 |
| Existing end-cap access fix | 3 | 0/3 | 12 | 0 | 0 |

The finer grid gains one connection but still fails. It also increases search work;
no timing improvement or general nonregression is established. None of these proposals
is installed in `src/`. Reverse fallback shares the original deadline and clearance
checks. The exact-edge experiment changes only hard same-sheet search edges. The
end-cap row uses the independent pinned fix, without other pending routing changes.
These results do not test compositions of the proposals.

Fresh-input diagnostic attempts retain all input obstacles and disable rip-up and
optimisation. Both pad anchors of each of the 12 remaining pairs pass exact point
clearance. The driver reports success for three pairs in isolation and failure for
nine. This separates interference from newly routed copper from some search misses;
it does not prove geometric feasibility for the nine failures, nor does a successful
driver return alone prove full terminal connectivity. See the complete pairs and
reports in `results.json`. A useful next step is minimising one of those nine pairs
and tracing rejected path insertion before changing the grid or connection order.

Reproduce on the same Linux host, restricted to CPUs 20–25:

```bash
taskset -c 20-25 nice -n 10 timeout 600 python3 docs/pr-assets/agent-fab-router-no-via-triage/probe.py --out /tmp/no-via-triage --repeats 3
```

The output directory must not exist. The script extracts pinned revisions into it,
uses the checkout's installed dependencies, records every source hash and exact patch,
and invokes this unchanged acceptance command three times per version:

```bash
bun run tools/acceptance/run.ts --tier slow --case routing-slow-issue026-j2-novia --report /tmp/report.json
```

Each invocation is expected to exit 1. The outer script asserts the known failures,
zero new violations, zero vias and absence of timeout/abort; its successful exit does
**not** mean acceptance passes. Raw reports and runner output are embedded in
`results.json`. The original main source and end-cap revision are pinned there;
`terminals.ts` is copied into the disposable main tree for the diagnostic only.
All runs use seed 1, maxPasses 100 and timeoutSeconds 60 from the frozen case.
Wall-clock values describe a shared host and overlap with unit checks.

Regenerate the chart from the committed reports:

```bash
python3 docs/pr-assets/agent-fab-router-no-via-triage/render.py
```

Required repository checks:

```bash
taskset -c 20-25 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

No native sweep was repeated for this evidence-only change. All engine/type files
remain identical to main `69cf598`; its previously measured full native reference
is 39/78 passing attempts, 13/26 cases valid in all three repeats, 120 opens and
27 new thermal errors. That historical result is context, not a new measurement or
an outcome established for the scratch proposals. Native thermal safety remains unresolved.
