A resolution-less session must use the design file's resolution. Public `Layout.file`
facts survive a shallow copy, whereas the hidden source document does not. The regression
uses mm/1000000 file ticks and a coarsened frame (100000 LU/mm). The old fallback treated
file ticks as LU: track coordinates and widths grew tenfold.

Run the four regression checks:

```sh
bun test test/session-units.test.ts
```

Reproduce the baseline failures while retaining the same tests (from repository root):

```sh
probe=$(mktemp -d /tmp/session-units.XXXXXX)
cp -r src spec "$probe/"
mkdir "$probe/test"
cp test/session-units.test.ts "$probe/test/"
git show 69cf598:src/ses/apply.ts > "$probe/src/ses/apply.ts"
(cd "$probe" && bun test test/session-units.test.ts)
```

Baseline: 2 pass / 2 fail, three repeats. Candidate: 4 pass / 0 fail, three repeats.
The explicit session resolution and legacy document fallback checks pass on both.
The second repaired check confirms public file facts take precedence over stale hidden facts.

Render the geometry illustration (Python standard library and rsvg-convert):

```sh
python3 docs/pr-assets/agent-fab-router-fix-session-units/render.py
```

The illustration shows numeric regression geometry, not a native board render or thermal fix.
