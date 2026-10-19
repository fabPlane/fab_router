# Layer-aware thermal discovery diagnostic

The offline selector now associates native thermal pad markers with copper layers
through the reported zone UUID. Generated segments are ranked only against
markers on their own layer; unknown zone layers produce no candidates. Connected
pair discovery uses the same filtered eight-track budget. Original copper remains
excluded. Two regression tests fail first on the previous implementation; all
three tests pass after the change, including connected-pair discovery.

This is an offline diagnostic, not an engine or integration fix. It does not
establish production R-1 safety or change the historical suite score.
The exact same complete Aquarius J4 source, input, rules, machine and native
10.0.6 checker are used as c176, with three native search repeats rather than
three routing seeds. Every rejected proposal and native report is retained.

Reproduce from the repository root with native 10.0.6 and fresh directories:

```sh
R=docs/pr-assets/agent-fab-router-fix-thermal-reproducer
mkdir -p /tmp/thermal-layer-search
tar -xJf "$R/c177-layer-discovery/native.tar.xz" -C /tmp/thermal-layer-search
/usr/bin/python3 -B "$R/c177-layer-discovery/verify.py" --results /tmp/thermal-layer-search
/usr/bin/python3 -B "$R/c177-layer-discovery/restore.py" --results /tmp/thermal-layer-search
/usr/bin/python3 -B "$R/c177-layer-discovery/test_layers.py"
taskset -c 20-25 nice -n 10 timeout 7200 /usr/bin/python3 -B "$R/c177-layer-discovery/complete.py" --source /tmp/thermal-layer-search/source/board.kicad_pcb --input /tmp/thermal-layer-search/input/board.kicad_pcb --out /tmp/thermal-layer-search/fresh
taskset -c 20-25 nice -n 10 timeout 1200 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

The source license is retained in adjacent `aquarius-reduced/LICENSE` and
c176 records baseline provenance. No frozen inputs, scoring, checker, shared
runtime, engine, adapter or performance routing functions change.

| Variant | Thermal errors/output | Opens/output | Proposals/repeat | Wrong-layer ranked tracks | Repeats |
| --- | ---: | ---: | ---: | ---: | ---: |
| Before: layer-blind discovery (c176) | 6 | 15 | 68 | 4/8 | 3 |
| After: layer-aware discovery | 6 | 15 | 64 | 0/8 | 3 |

After filtering, each repeat evaluates 48 single-track and 16 connected-pair
proposals. All 64 add errors (8–20 errors per candidate), with zero accepted
intermediates. Every repeat restores the exact initial bytes. Layer filtering
alone is insufficient to repair this board. Required typecheck/layer checks
and all 859 engine tests pass; three discovery regression tests pass.

![Layer-aware discovery results](https://github.com/fabPlane/fab_router/blob/agent/fab-router-fix-thermal-reproducer/docs/pr-assets/agent-fab-router-fix-thermal-reproducer/c177-layer-discovery/comparison.png?raw=true)

All 195 native checks are archived (three baselines plus 192 rejected proposals).
The 2,271 aggregate errors and 2,934 aggregate opens include rejected candidates;
these are diagnostic accounting, not scores. No candidate is published.
Layer-aware geometry search is exhausted here; the next investigation needs
thermal spoke topology or native-aware route integration, rather than another
unchanged ranking sweep.
