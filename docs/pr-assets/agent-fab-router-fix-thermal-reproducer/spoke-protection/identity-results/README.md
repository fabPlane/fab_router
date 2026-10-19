The diagnostic now records the exact board, same-stem project and custom-rule bytes and native version before loading metadata, and checks them again after extraction. Missing sidecars are explicit null identities. Identical bundles can be renamed. This is a reproducibility check, not an atomic transaction or an effective thermal-rule resolver. It does not cover external configuration or establish production routing safety.

Nine identity tests pass in each of three repeats. A disposable mutation replacing validate() with a no-op passes only two: stale board, changed/missing project, changed/new rules, a newly appearing project and changed native version each escape detection. This is a mutation comparison, not a historical engine baseline. The test file was written before the helper; its initial run failed at import because the helper was absent, not at a behavioral assertion.

Nine fresh native controls use the existing miniature board. Each snapshot identity validates against the committed files. The project minima 2/3/absent still produce 0/1/0 thermal errors respectively in every repeat, with two opens. No routing benchmark ran, no production source changed, and the frozen 27 thermal errors remain unresolved.

Reproduce from repository root (choose a fresh output directory):

```bash
PYTHONDONTWRITEBYTECODE=1 python3 docs/pr-assets/agent-fab-router-fix-thermal-reproducer/spoke-protection/test_metadata_identity.py
PYTHONDONTWRITEBYTECODE=1 python3 docs/pr-assets/agent-fab-router-fix-thermal-reproducer/spoke-protection/run_identity_controls.py --out /tmp/identity-controls
taskset -c 20-25 nice -n 10 timeout 600 /usr/bin/python3 docs/pr-assets/agent-fab-router-fix-thermal-reproducer/spoke-protection/native-settings.py --out /tmp/native-identity-check
bun run typecheck && bun run check:layers && bun run test
```

The six candidate/mutation logs retain three repeats each. Native inputs, snapshots and raw reports are under native/. SHA-256 manifest covers all evidence except itself. Checks were run on the same host and core set as the prior diagnostic. No speed claim.
