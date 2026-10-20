# Insertion-stage census, cycle 19

No routing change is adopted. This extends the previous unchanged-control census with counters at existing exact trail legalisation and layered rollback return sites. The disposable source changes only `src/route/passes.ts`; 1,487 source/spec files were compared and regeneration reproduced every measured byte. Production source remains at control `69cf598`.

Three seed-1 replays (one per board, same inputs/settings/machine/cores 12–19) reproduce the previous native-run sessions byte for byte. Every existing search counter for all nine final residual keys also matches. These are diagnostic engine replays, **not fresh native benchmark attempts**, a repair trial, or a performance comparison. No timing is claimed; unit checks overlapped the diagnostic processes. The shared history records one explicitly unscored diagnostic row; native score fields are blank and no prior scored run is repeated.

| Board | Replays | Residual connections before | After | Session matches |
|---|---:|---:|---:|---:|
| paperino-hw-paperino-shield-j4 | 1 | 6 | 6 | 1/1 |
| photon-sprinkler-sprinkler-j3 | 1 | 2 | 2 | 1/1 |
| rufs-smart-psu-j3 | 1 | 1 | 1 | 1/1 |

Across the nine owning `routeConnection` contexts there are 1,474 trail attempts, 1,107 rejected legalisations, 367 legalised trial legs, and six layered-leg rejection events. None of those owning connection calls returns success. No layered barrel rejection was observed in those contexts. Counts include recursive neighbour reroutes and partial multi-leg trials that may later be rolled back; **legalised trial legs do not prove that the stalled connection itself had a legal path**. Search goals and trail attempts are different populations and must not be divided to infer a success rate.

This rules out a blanket explanation that every attempted leg fails exact legalisation. It does not yet identify which successful trial legs belong to neighbours or which outer transaction later fails. The next diagnostic must carry actual trial net and parent stage/transaction identity, then locate the first rejecting segment on the stalled connection itself. Do not increase budgets or reduce margins based on these aggregate counts.

Reproduce from the repository root, with the previous complete native work directory available (its input/session hashes are in `grid-census.json`):

```sh
ASSETS=docs/pr-assets/agent-fab-router-perf-local-rescue
OUT=$HOME/bench/agents/codex-fabpcb-perf/scratch/cycle19-reproduce
mkdir -p "$OUT"
python3 "$ASSETS/insertion-census.py" . "$OUT/source"
taskset -c 12-19 nice -n 10 timeout 600 python3 "$ASSETS/replay-insertion.py" "$OUT" "$HOME/bench/agents/codex-fabpcb-perf/scratch/cycle18/native-complete"
taskset -c 12-19 nice -n 10 timeout 120 bun run --cwd "$OUT/source" typecheck
taskset -c 12-19 nice -n 10 timeout 900 bash -c 'bun run typecheck && bun run check:layers && bun run test'
python3 "$ASSETS/plot-insertion.py" "$OUT/insertion-census.png"
```

`insertion-results.json` retains all nine rows, including prior counters. `insertion-source-audit.json` pins generator and measured-source hashes. Generators and replay reject existing outputs. No new fixture test or full 26×3/dense/ladder run was done for this observation-only update; those remain mandatory for an adopted rescue implementation.

Validation: typecheck passes; layer check 65 files / zero violations; 859 tests pass, zero fail, 398,454 assertions (254.38 s). Diagnostic source typecheck also passes. Python AST and whitespace checks pass; overwrite guard rejects an existing destination. No adopted routing change, fixture, or native score gain.
