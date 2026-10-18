# Search endpoint bounds regression

Source fix: `43bc0c4`. Synthetic fixture has six checks repeated three times: baseline 1 pass / 5 fail each, candidate 6 pass / 0 fail each. The SVG and PNG illustrate the false-success coordinate alias.

`benchmark-summary.json` compares the complete cycle-1 main sweep with cycle-3 candidate sweep, 26 cases × 3 repeats, same machine and cores 20–25. All frozen input, config, harness and runtime hashes match. Candidate source hashes match source commit 43bc0c4. Harness recorded main HEAD before commit creation; no source edits occurred during the candidate sweep.

All 78 outcome/via/length records match; 39/78 pass, 13/26 valid 3/3, 120 opens, 27 new native errors. Median route time: 1.172079 → 1.203290 seconds (+2.7%), shared host with tests overlapping part of candidate sweep; no isolated timing conclusion. Native thermal errors and open-net failures remain unresolved.

Required checks passed: typecheck; layers (65 files, zero violations); 865 tests, zero failures, 398471 expectations (223.84 seconds). Exact reproduction commands are in the PR description. Full evidence remains in the agent scratch directories c1-before-full and c3-after-full; this artifact contains per-case summaries and tested source hashes.
