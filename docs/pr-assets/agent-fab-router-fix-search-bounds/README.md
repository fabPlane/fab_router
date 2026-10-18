# Search endpoint bounds regression

Source fix: `43bc0c4`. Synthetic fixture has six checks repeated three times: baseline 1 pass / 5 fail each, candidate 6 pass / 0 fail each. The SVG and PNG illustrate the false-success coordinate alias.

`benchmark-summary.json` compares the complete cycle-1 main sweep with cycle-3 candidate sweep, 26 cases × 3 repeats, same machine and cores 20–25. All frozen input, config, harness and runtime hashes match. Candidate source hashes match source commit 43bc0c4. Harness recorded main HEAD before commit creation; no source edits occurred during the candidate sweep.

All 78 outcome/via/length records match; 39/78 pass, 13/26 valid 3/3, 120 opens, 27 new native errors. Median route time: 1.172079 → 1.203290 seconds (+2.7%), shared host with tests overlapping part of candidate sweep; no isolated timing conclusion. Native thermal errors and open-net failures remain unresolved.

Required checks passed: typecheck; layers (65 files, zero violations); 865 tests, zero failures, 398471 expectations (223.84 seconds). Exact reproduction commands are in the PR description. Full evidence remains in the agent scratch directories c1-before-full and c3-after-full; this artifact contains per-case summaries and tested source hashes.

## Layer-index validation follow-up (cycle 5)

Source commit `f79cdf2` extends the same state-alias fix to layered starts. Invalid integer, negative and fractional layer indices previously decoded as other valid cells/layers and could return false success. New tests first failed 3/4 against the previous PR head; now pass 4/4. All ten checks repeated three times: before follow-up 7/10, after 10/10, identically each repeat. Mixed valid/invalid starts retain the valid start.

Full native sweep in cycle5-benchmark-summary.json: all 78 pass/opens/errors/vias/length records match the main baseline. 39/78 passing attempts, 13/26 cases valid 3/3, 120 opens, 27 new errors. Median route path 1.172079 → 1.106020 seconds (-5.6%); descriptive shared-host result, with tests overlapping part of the candidate sweep, no isolated speed claim. All controls match and source hashes match f79cdf2 (harness captured previous PR HEAD before commit creation). Existing board failures remain unresolved.

Checks: typecheck and layers pass; 869 tests pass, zero failures, 398477 expectations (226.58 seconds). New layer-alias.svg/PNG show the packed-state error; render with `rsvg-convert -w 1600 layer-alias.svg -o layer-alias.png`.


## Fractional-coordinate validation follow-up (cycle 6)

Source commit `f128c4e` rejects fractional grid coordinates before state packing. On a three-column grid `(0, 1/3)` encoded as cell 1 and reconstructed as `(1, 0)`; both searches could report success from the wrong start. Five new tests failed first. All fifteen tests repeated three times: previous PR head 10 pass / 5 fail; candidate 15 pass / zero fail, identically each repeat. Fractional single-sheet goals now fail with zero pops too.

Full native sweep in cycle6-benchmark-summary.json: same 26 cases × 3 repeats and machine/cores as the main baseline. All controls match, source hashes match f128c4e, and every case/seed has identical pass/opens/errors/vias/length. Passing attempts 39/78, valid cases 13/26, summed opens 120, summed new errors 27, unchanged. Median route time 1.172079 → 1.121678 seconds (-4.3%); shared host with tests partly overlapping, no isolated speed claim. Thermal errors and open-net failures remain unresolved. The harness recorded the previous PR head before commit creation; source hashes establish tested identity.

Checks pass: typecheck, layer boundaries (65 files / zero violations), 874 tests / zero failures / 398482 expectations (227.87 seconds). Render the new diagram with `rsvg-convert -w 1600 fractional-alias.svg -o fractional-alias.png`. Reproduce the full sweep with the PR command using c6-after-full as the output path. Detailed evidence is in the agent scratch c6 and c6-after-full directories.
