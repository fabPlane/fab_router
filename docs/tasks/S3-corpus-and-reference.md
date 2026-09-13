# Task S3 — corpus, manifest, reference numbers, routing and DRC cases

Role: spec-curator. Write set: `spec/acceptance/boards/`, `spec/acceptance/reference/`,
`spec/acceptance/cases/routing-*.json`, `spec/acceptance/cases/drc-*.json`,
`spec/acceptance/cases/ses-apply-*.json`.

## Deliverables

1. **Corpus** — copy (never symlink) every `.dsn`, `.ses`, `.rules`, and `.json` board/report
   file from the reference corpus into `spec/acceptance/boards/`, flattened, keeping file names
   (prefix sub-directory benchmark files so names stay unique), plus the five user boards (the CM5
   carrier DSN and the four J802 SRJ files). Write `MANIFEST.json`: `[{ "file", "sha256",
   "bytes", "provenance": "issue corpus" | "user board" | "benchmark", "tier": "fast" | "slow",
   "layers": n, "nets": n }]`. Tier: slow if a reference's default run takes > 10 s or the file
   is > 1 MB.
2. **Reference numbers** — `spec/acceptance/reference/<board>.<profile>.json` per
   `spec/acceptance/schema/reference.schema.json`, for profiles `default` and `novia` on every
   DSN board, and `p1` / `fanout` / `strict` on the boards named by the routing cases you write.
   Run both references as sealed programs with identical settings (write the harnesses in the
   private workspace, never in this repo). Median of 3 runs where a run takes < 10 s, else one
   run. Record `status` honestly (`timeout`, `error`). `notes` records any disagreement and the
   ruling (see `spec/rules/connectivity.md` for the pour ruling — apply it when computing
   `connections`/`incomplete` for reference A, and say so).
3. **`applied-ses` references** — for every board with a reference `.ses`: apply it and record
   `incomplete`, `vias`, `violations`, `tracks` (profile `applied-ses`).
4. **Routing cases** — translate every routing assertion of both reference test suites into
   `cases/routing-fast-*.json` / `cases/routing-slow-*.json` per `schema/case.schema.json`:
   board, settings (only the vocabulary in `spec/api/settings.md`), expectations (`incomplete`
   exact/max, `violations.maxAdded: 0` always, `passes.max`, wall clock as advisory, via and
   length ratios where sensible), `origin` (`refA-suite`, `refB-suite`, or `both` for the ones
   both suites carry). Include the per-board completion floors, the two benchmark boards that
   must complete, the pass-limited and item-limited cases, the strict-DRC case with its
   pre-existing violation count, the multilayer boards, the plane-layer boards, the inactive-layer
   board, the cancellation case (small `timeoutSeconds`, expects `stoppedBy: timeBudget` and
   `violations.maxAdded: 0`), and the CM5 carrier (74 connections, slow tier).
5. **DRC cases** — `cases/drc-*.json` (kind `drc-load`) for every board with a CAD-tool DRC
   report, and for the boards the suites check at load.
6. **`ses-apply` cases** — one per reference `.ses`.

## Rules of writing
Cases carry no prose about how a reference works — only board, settings, numbers. Expectation
numbers come from the suites' assertions or from the reference runs; when a suite's bound is
looser than the measured reference, keep the suite's bound and add `note`. `bun run spec:lint`
must be clean. Commit with spec-curator trailers; commit the corpus separately from the numbers.
