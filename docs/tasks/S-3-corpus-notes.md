# S3 curator notes — corpus, reference numbers, routing / DRC / session cases

Companion to `docs/tasks/S3-corpus-and-reference.md` (the task). Everything below describes what
was measured and how the numbers in `spec/acceptance/` were produced; nothing about how either
reference is built.

## Corpus

214 files in `spec/acceptance/boards/`: 149 DSN (148 issue/benchmark boards plus the CM5
carrier), 38 sessions, 10 rules files, 13 JSON reports/renderings, 4 SRJ user boards. Nested
files are flattened with their directory path joined by `-`
(`Issue508-DAC2020-DAC2020_bm07-FRv2.1.0-DAC2020_bm07.ses`). Four DSN names and three DRC-report
names carried a wall-banned word; they were neutralised (`…-router.dsn`,
`…FromRouterBugTest…`, `…-refA_drc.json`). `MANIFEST.json` `sha256` is the only link to the
originals. 38 DSN files are byte-identical copies of another file (the benchmark boards appear
up to five times); their reference files are clones with a note saying so.

Tiers follow the letter of the rule (file over 1 MB, or either reference's default run over
10 s or timed out → slow): 147 slow, 67 fast. Sessions, rules and reports inherit their board's
tier.

## Reference profiles

Every profile ran both references as sealed programs with the profile's settings from
`spec/acceptance/README.md`. Whatever the profile does not name is each reference's own
default, stated in every file's `notes`:

- reference A: single-threaded; fanout pre-pass off unless the profile enables it;
  copper-to-edge and hole clearance overrides unset so the file's own rules apply; a settings
  block in the file is honoured (three boards carry one).
- reference B: rip-up and in-search shoving on, optimiser on, file settings ignored.
- `strict` has no meaning for reference B (its numbers are default-mode numbers); `p1` for
  reference B is one pass plus its optimiser, without its post-pass completion stage.

`incomplete` and `violations` in every file are measured on the reference's resulting Layout
under `rules/connectivity.md` K-01..K-03 (the pour ruling) and `rules/drc.md` DR-02; each
reference's own counts are kept in `notes` where they differ. Trace length is converted through
the board's own unit and resolution (reference A's own millimetre figure is ten times too large
on every board and is not used). Session references (`<session>.applied-ses.json`) remove the
board's free/held file wiring before applying the session (`ses.md` F-S61) and record the import
summary. Median of three runs where the first run took under 10 s, one run otherwise.

Outcomes: default 149 boards (A 65 budget timeouts, B 72; the one non-DSN file errors in
both), novia 149, p1 12, fanout 6, strict 3, applied-ses 38.

## Cases

Routing cases carry every routing assertion of both suites in the settings vocabulary of
`spec/api/settings.md`; a suite bound looser than the measurement is kept with a note. DRC-load
expectations are the spec's numbers from `rules/drc.md`. Session cases pin reference B's
numbers after F-S61 and record any disagreement with reference A.

## Open questions

1. `maxItems`: both references cap *routed connections*; `settings.md` caps inserted Tracks plus
   Barrels. The suites' item-capped completion bounds are recorded as advisory expectations.
2. No metric names "Tracks on a plane Sheet", "SMD Pads escaped" or "Tracks on an inner Sheet";
   the fanout-only case uses `addedBarrels`, the plane-Sheet and inner-Sheet assertions are
   notes only.
3. Reference A adds no Track on `Issue229-display-8-digit-hc595.dsn` under the default profile
   (8 incomplete before and after) while reference B completes it; the case keeps suite A's
   bound of 20.
4. The applied-session numbers for the two `Issue555-BBD_Mars-64-*.ses` files come from
   sessions that do not match the board (103 import errors in both references); the cases pin
   what the references produce, but the sessions may belong to another board revision.
5. The `strict`, `p1` and `fanout` profile files for reference B are its default-mode
   behaviour where the profile's setting has no counterpart; `maxRatioToReference` cases name
   `referenceSide` explicitly.
