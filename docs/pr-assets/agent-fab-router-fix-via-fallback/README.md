# Later permitted via forms

`dropViaNear` used `pickBarrel` once, then searched every offset using only that
form. A blocked first form exhausted the search even when the next permitted
form could join the same sheets with exact clearance. The fixture has one SMD
pad, one opposite-layer terminal region and two barrel keepouts. The first
1.2 mm via cannot clear the corridor; the second 0.6 mm via fits at the anchor.

The fix retains existing exact-span preference and candidate order within each
span class. It exhausts the existing target/ring search for one candidate before
trying the next. `pickBarrel` and its other search callers are unchanged; the
change applies to `dropViaNear` consumers (fanout, plane helpers, line probes and
channel routing). It does not provide fallback forms in the multilayer A* matrix.
Pending plane enumeration/stop changes also edit via.ts and need to preserve
this candidate loop when integrated. No combined validation is claimed here.

On the same host and core set, three repeats of the identical eight tests give
5 pass / 3 fail before and 8 pass / 0 fail after. The public fanout fixture has
1 open / 0 added vias before and 0 opens / 1 added via after; both have zero
engine DRC violations. Pads, permitted forms, via rules, fences and the terminal
region are preserved. Controls cover disabled fanout/vias, absent alternatives,
nonspanning alternatives and first-fitting-form priority. Raw repeated logs,
geometry and source/test hashes are in regressions.json. This is a synthetic
engine regression, not a native benchmark score or thermal preservation test.

```bash
bun test test/via-fallback.test.ts
python3 docs/pr-assets/agent-fab-router-fix-via-fallback/regression.py --out /tmp/via-fallback-repeated
python3 docs/pr-assets/agent-fab-router-fix-via-fallback/render.py
bun run typecheck && bun run check:layers && bun run test
```

The PNG renders measured synthetic geometry. Dashed outlines show the rejected
candidate, not retained copper. Searching additional forms can add clearance
work after a candidate is exhausted; no performance improvement is claimed.
