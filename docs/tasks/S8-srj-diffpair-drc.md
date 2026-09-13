# Task S8 — how the reference gets violationsBefore=0 and attachment completion on J802

Role: spec-curator. Write set: `spec/formats/srj.md`, `spec/rules/{clearance,drc,connectivity}.md`,
`spec/acceptance/cases/srj-*.json`, `spec/acceptance/reference/*.srj.*.json`.

Question Q69 (`src/QUESTIONS.md`): the J802 boards carry pre-existing net-owned copper — differential
pairs and an I2C bus — coupled below the board's declared default clearance. The current adapter
models that copper as net-carrying Fences: R-1 holds and required connections are 15, but the copper
is not electrically connective, so completion stays 15 instead of the reference's 3 / 6, and if it
were modelled as ordinary Tracks the board would report ~20 pre-existing spacing violations, breaking
the reference's `violationsBefore = 0`.

Determine, by running reference B (and reference A where useful) as sealed programs on the four
J802 SRJ boards:

1. **How the reference reports `violationsBefore = 0`** despite coupled copper below the default
   clearance. Candidates to distinguish by observation: a differential-pair / coupled-trace
   clearance rule; a same-net-plus-paired-net exemption; a per-pair `traceGap` rule from the SRJ
   `differentialPairs` entry; or simply not checking pre-existing wiring. Record which, with the
   numbers that prove it.
2. **How the reference completes to 3 / 6 incomplete** — i.e. that pre-existing net copper is
   *connective* (the router attaches to it) while still being an obstacle to other nets and not an
   independent terminal.
3. Turn this into spec: the SRJ clearance/DRC treatment of pre-existing coupled copper
   (`spec/rules/clearance.md` and/or `drc.md`, and the SRJ section of `spec/formats/srj.md`), and
   the connectivity treatment (`connectivity.md`), each as observable behaviour with the J802
   numbers. Propose (in `spec/formats/srj.md`, for the orchestrator to apply) any
   `spec/types/layout.ts` primitive the implementation needs — e.g. an "attachable, DRC-among-
   pre-existing-silent, non-terminal-until-attached" copper class, described behaviourally.
4. Update the four `srj-*` cases: keep `violations.maxAdded: 0` hard, set `violationsBefore`
   (0 where observed) hard, and set the `incomplete` bounds to the reference's values, marking them
   reachable-with-vias if the router cannot yet attach.

Run `bun run spec:lint`; commit with spec-curator trailers; report the ruling.
