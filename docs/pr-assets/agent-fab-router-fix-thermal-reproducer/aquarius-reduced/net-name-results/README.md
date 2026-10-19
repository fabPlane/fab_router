# Preserve native net names in offline thermal proposals

Both offline searches previously constructed a quoted net atom by concatenating quotation marks around the native name. An embedded quote can invalidate the tree or split the name into several atoms; a backslash can change the decoded name. Encode the name with `json.dumps(..., ensure_ascii=False)` in both entrypoints and both independent replay tools. Existing simple-name proposals remain byte-identical.

The regression invokes each real command entrypoint on a generated native board with a back-copper pad and zone. It covers a simple name, quote, backslash, combined backslash/quote, and Unicode. The input and every generated proposal are loaded by the native reader; every added segment must retain the exact original net name. Native DRC and transaction acceptance are mocked to isolate metadata generation; this test makes no safety or routing claim. Each passing case executes all three search repeats and verifies deterministic candidate bytes.

Same host, native version 10.0.6, cores 20–25, ten cases repeated three times:

| Entrypoint regression | Repeats | Passing cases per repeat | Failing cases per repeat |
|---|---:|---:|---:|
| Before, pinned c3137ff | 3 | 4/10 | 6/10 |
| After escaping | 3 | 10/10 | 0/10 |

Before reports five assertion failures and one parse error in each run. The comparison harness checks that failure signature, as well as successful after exits. These are regression measurements, not router benchmark runs. No new native DRC results or history row are implied. Production engine and adapter sources are unchanged. The historical full-suite reference remains 39/78 passing runs, 13/26 valid cases, 120 opens, and 27 new thermal errors; it was not rerun for this diagnostic correction.

From the repository root:

```bash
A=docs/pr-assets/agent-fab-router-fix-thermal-reproducer/aquarius-reduced
taskset -c 20-25 timeout 120 /usr/bin/python3 -B "$A/measure-net-names.py" --before-ref c3137ff --out /tmp/thermal-net-name-comparison
/usr/bin/python3 -B "$A/plane-layer-controls.py"
/usr/bin/python3 -B "$A/link-controls.py"
/usr/bin/python3 -B "$A/dogleg-controls.py"
bun run typecheck && bun run check:layers && bun run test
```

The saved 39-check bent-link evidence is also replayed using the updated verifier (see its README for exact source extraction and replay commands). This checks retained evidence and unchanged simple-name proposal bytes; it does not execute fresh DRC.

Required checks pass: typecheck, 65 layer-checked files with zero violations, 859 tests, zero failures and 398454 assertions (210.07 seconds).
