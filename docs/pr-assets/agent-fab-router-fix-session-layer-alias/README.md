The minimized fixture is in `test/session-layer-alias.test.ts`. It has three layers
named `top`, `inner`, and `bottom`, one net, and four session paths using `Top`
and `Bottom`. The image illustrates the imported geometry by layer; dashed paths
on the left mark missing copper, not inserted tracks. It is not a native board render.

Run from the repository root:

```sh
bun test test/session-layer-alias.test.ts
python3 docs/pr-assets/agent-fab-router-fix-session-layer-alias/render.py
bun run typecheck && bun run check:layers && bun run test
```

Against main 69cf598 the first regression fails (0 of 4 tracks imported); both
control tests pass. With the fix all three pass and all four tracks import on
the intended sheets. The same test file was run three times against each source
version on the same machine, with identical results each time.
