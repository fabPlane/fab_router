# Retained copper recovery guard, cycle 26

The standalone research transaction now compares complete non-router track and
barrel objects, sorted by id, before retaining a proposal. A mismatch rejects the
proposal and rewinds its Journal. This does not enable production recovery.
The callback remains trusted, synchronous and Journal-only; arbitrary direct
mutation of layout objects cannot be undone by this helper.

The regression duplicates the legal short branch as retained copper, then
removes that redundant retained branch while inserting the legal long witness.
This closes the target with zero exact violations and preserves terminal
connectivity, so the existing guards would accept it. The new guard rejects it.
Each rejection restores the exact session, retained object, live lattice entry,
target open and empty live insertion list. Sorting avoids treating Journal
re-append order as a geometry change.

Same ten-pad fixture/settings/host, three normal pipeline repeats; one proposal
per retained origin in each repeat:

| Retained track origin | Guard bypassed | Guard enabled | Exact errors in proposed copper |
| --- | --- | --- | ---: |
| file | accepted (mutation control) | rejected, restored 3/3 | 0 |
| session | not separately bypassed | rejected, restored 3/3 | 0 |
| prior | not separately bypassed | rejected, restored 3/3 | 0 |

The disabled-ownership mutation fails at the first `file` rejection assertion;
it does not continue to the other origins. The full control has 219 assertions.
The four bypass controls disable DRC, terminal preservation, rewind and retained
copper preservation independently; each must fail its intended assertion.
These are harness regression tests, not native routing benchmark scores.
Barrel preservation uses the same snapshot guard but has no new barrel-specific
mutation fixture in this cycle.

Reproduce using unused output directories:

```sh
python3 docs/pr-assets/agent-fab-router-perf-local-rescue/validate-recovery-transaction.py \
  "$PWD" /tmp/recovery-ownership-new
taskset -c 12-19 nice -n 10 timeout 900 bash -c \
  'bun run typecheck && bun run check:layers && bun run test'
```

Production source and default routing behavior are unchanged. This does not
claim faster routing, original-board closure or native DRC safety. Endpoint
regions, budgets and local search integration remain pending.
