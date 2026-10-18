Issue026 slow acceptance audit
=============================

Same host, cores 20–25, three repeats per revision. Main 69cf598 versus
pad-attachment production source 1bbd5f3 (checkout f5f2a7f).

| Profile | Main | Pad attachment | Opens before → after | Added engine DRC |
| --- | --- | --- | --- | --- |
| No vias | Fail 3/3 | Fail 3/3 | 12 → 12 | 0 → 0 |
| One pass, optimizer limits | Pass 3/3 | Pass 3/3 | 6 → 6 | 0 → 0 |

No-via expects at most six opens. It stops from stagnation after seven passes,
without timeout/cancellation; all non-timing measured fields are identical in all
six reports. This is an unresolved baseline acceptance failure. Its expectation
remains intact. The optimizer-limits profile stops at its one-pass limit.
These are engine acceptance cases, not native refill checks. No native completion,
thermal safety, speed improvement, or full slow-tier pass is claimed.

`slow-acceptance.json` retains all measured and expected fields, mismatches, log and
report hashes, and tracked production/spec/runner identities. `slow-audit.py`
asserts the exact existing failure and equal non-timing outcomes; it is an evidence
audit, not a replacement for the failing acceptance command.

Reproduce from the repository root (use a new empty directory for `audit`):

```bash
audit=/tmp/pad-attachment-slow-audit
mkdir -p "$audit/baseline"
git archive 69cf598 | tar -x -C "$audit/baseline"
for repeat in 1 2 3; do
  suffix="-$repeat"
  if [ "$repeat" = 1 ]; then suffix=; fi
  for version in before after; do
    tree="$PWD"
    if [ "$version" = before ]; then tree="$audit/baseline"; fi
    (cd "$tree" && taskset -c 20-25 nice -n 10 timeout 600 bun run acceptance -- \
      --tier slow --case 'routing-slow-issue026-*' \
      --report "$audit/slow-$version$suffix.json") \
      > "$audit/slow-$version$suffix.log" 2>&1
    # Both versions are expected to exit 1; inspect every report.
    status=$?
    test "$status" = 1 || exit 1
  done
done
python3 docs/pr-assets/agent-fab-router-fix-pad-attachment/slow-audit.py "$audit"
```

The initial unfiltered slow-tier attempts were interrupted during their first
routing case after parsing, and are excluded. An extra initial launch used the
wrong working directory and was interrupted before scoring. Their local logs
remain in cycle-30 scratch. Only the six completed filtered reports are scored.
