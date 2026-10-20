# Complete-net source-connectivity reproducer

Diagnostic only: source geometry/rules are unchanged and no engine/tool behavior
changes. Minimize the existing Aquarius 466-item, 56-net added-copper fixture by
removing whole generated nets. Every retained net keeps all its generated items.
The result retains 74 items: +3V3 (63), /Inputs/TCK (11).

Same source, same native 10.0.6 checker, same host/cores, three fresh gate decisions
per control (each decision checks both source and candidate):

| Control | New thermal errors | Opens | Lost source pairs | Accepted |
|---|---:|---:|---:|---:|
| Source | 0 | 110 | 0 | 3/3 |
| Full generated output | 6 | 15 | 348 | 0/3 |
| Two complete generated nets | 2 | 94 | 61 | 0/3 |

Two-net split isolates GNDD U1.53, not the U1.39 of the older three-track cut.
Each entire-net deletion restores all pairs: +3V3 alone retains both thermal
findings (U1.53/U1.55) with 95 opens; TCK alone has no errors and 108 opens.
The retained native-filled B.Cu GNDD zone has one filled outline in the source
and +3V3-only control, but two in the combined witness. This is a pour-component
cut as well as a thermal finding. `zone-topology.py` reads these retained boards
without refill, DRC or saving.
Therefore neither scalar open counts nor thermal markers substitute for terminal
connectivity. This is one-net-deletion-minimal for this retained pair, not global
board minimality, an automatic repair, or a full benchmark score improvement.

The raw minimizer summary uses `added_before/after` for grouped-net counts
(56 and 2); copper-item counts are 466 and 74 in the discovery rows.

36 discovery/refill attempts are retained, including source and three final
repeats. Nine additional paired gate decisions are retained. Independent replay
reconstructs every submitted copper inventory and compares it with native saved
boards using Decimal physical geometry and semantic net names; all 36 match.
It independently recomputes lost pairs and all report counts, verifies complete
per-net inventories and both single-net deletion controls. No attempt omitted.

Initial focused test failed on mistaken pad identity U1.39; corrected from native
terminal partitions to U1.53. Initial and corrected logs retained. The last four
control assertions were added before the full suite loaded this test file;
final full-suite coverage is authoritative: 926 passes, zero failures, 398879
assertions, 873.20 seconds. The command wrapper returned 143 while the owned
child continued; the complete passing summary is retained and every child PID
ended. A final focused/static command was repeated for a clean captured exit. No production fix/fail-first claim.

Last full optional suite is retained c211, not rerun here: before and after both
45/78 passes,15/26 valid,120 opens,18 thermal errors. Last default result remains
39/78,13/26,120 opens,27 thermal errors. Full Aquarius remains unresolved.

From engine checkout:
```sh
asset=docs/pr-assets/agent-fab-router-native-drc-gate/c212-complete-net-connectivity
mkdir -p /tmp/c212-replay
tar -xJf "$asset/evidence.tar.xz" -C /tmp/c212-replay
python3 "$asset/verify.py" /tmp/c212-replay
python3 /tmp/c212-replay/verify-parsers.py /tmp/c212-replay
python3 /tmp/c212-replay/zone-topology.py /tmp/c212-replay
# Optional: rerender the retained native layer crops.
python3 /tmp/c212-replay/render.py
rsvg-convert /tmp/c212-replay/board-comparison.svg -o /tmp/c212-replay/board-comparison.png
mkdir -p /tmp/c212-gate/minimized
cp /tmp/c212-replay/minimized/selected.sexpr /tmp/c212-gate/minimized/
taskset -c 20-25 nice -n 10 timeout 900 bun /tmp/c212-replay/reproduce-recheck.ts /tmp/c212-gate
taskset -c 20-25 nice -n 10 timeout 1800 python3 "$asset/reproduce-minimize.py" --repo "$PWD" --out /tmp/c212-fresh
taskset -c 20-25 nice -n 10 timeout 600 bun test test/native-aquarius-connectivity.test.ts
taskset -c 20-25 nice -n 10 timeout 2400 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

Next: use the two complete nets to find an ownership-preserving detour restoring
U1.53 and thermal spokes without dropping source/current pairs. The current
search refuses an already source-disconnecting baseline; do not weaken that
boundary or the open/source/rule budgets just to publish this witness.
