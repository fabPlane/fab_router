# Adverse dogleg clearance isolation

This static full-board diagnostic isolates the extra error from the negative track-3 dogleg. It is a clearance violation, not a thermal violation. Native reports identify track `917bc58f-bf38-4e94-917f-0fa6c8a519d8` and U1 pad 40 `9ed9deec-e5aa-43e2-8257-ea9e272f0724`: actual clearance 0.0930 mm versus required 0.1270 mm.

Only the translated segment's two endpoints are restored in the third variant. Both endpoint links and every other object tree are retained before refill. This removes the added clearance error but leaves all six original thermal errors. These are static checks, not automatic routing or a production fix. Native opens do not prove preservation of terminal partitions; the earlier selector has a separate partition audit.

Same host, cores 20–25, native version 10.0.6, three fresh repeats each:

| Variant | Native errors per repeat | Identified clearance pair | Opens |
| --- | ---: | ---: | ---: |
| Baseline | 6 | 0 | 15 |
| Negative track-3 dogleg | 7 | 1 | 15 |
| Restore segment, retain links | 6 | 0 | 15 |

Reproduce from the repository root (use a new output directory):

```sh
taskset -c 20-25 nice -n 10 timeout 300 /usr/bin/python3 docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced/isolate-clearance.py --out /tmp/native-clearance-isolation
python3 docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced/clearance-chart.py /tmp/native-clearance-isolation
python3 docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced/verify-clearance.py /tmp/native-clearance-isolation
bun run typecheck && bun run check:layers && bun run test
```

Retained boards, sidecars, complete DRC reports, native logs and SHA-256 manifests are under this directory. The input records are reused from `selection-results`; their bytes are checked before and after. The script asserts repeat agreement and the exact newly implicated UUID pair. Frozen benchmark inputs and production engine code are unchanged. This diagnosis demonstrates why a thermal-only objective is insufficient when generating repair candidates.
