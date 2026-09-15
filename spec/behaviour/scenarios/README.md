# Outcome-only routing scenarios

Each file here states, for named boards under `spec/acceptance/boards/`, an outcome that
`route()` must reach and the observation on both baseline routers that backs it. The
scenarios say *what* must be true of the Layout and the `RouteReport` afterwards — never how a
router should get there. They complement the declarative cases under `spec/acceptance/cases/`
(which pin single numbers) by naming nets, item classes and monotone relations that a generic
metric cannot express.

| File | Outcome |
|---|---|
| `novia-routable-nets.md` | With `viasAllowed: false`, the listed nets per board must end complete (each connection on one Sheet); no Barrel is added. |
| `held-items.md` | Pads, held file wiring, Pours, Fences and the Rim are untouched by routing — counts per board and profile. |
| `optimizer-monotonicity.md` | The optimiser may only shorten, straighten and remove Barrels; the reference numbers with the optimiser on and off. Records the one reference whose post-pass does not satisfy this and the ruling. |
| `fanout.md` | With `fanoutEnabled: true`, at least N SMD Pads per board gain a Barrel escape. |
| `detailed-routing.md` | The completion the detailed router must reach on each dense board (the generous-budget reference best), with R-1/R-2/K-18 held; hard where a reference reaches it clean, advisory where completion needs attach-to-Prior-copper. |
| `shove.md` | With in-search shoving enabled, the named connections that complete where they did not without it; no held/locked/Prior item moves; zero added Violations. Includes the J802 locked-channel outcome. |

Conventions: board names are the file names under `spec/acceptance/boards/`; net names are the
names from the board's `network` section, verbatim (back-ticked, `|` escaped). "Baseline A" and
"baseline B" are two established routers used as measurement baselines. Every table row was
produced by running a baseline on the board with the settings stated in the file's header line;
where the two baselines disagree, both observations are given and the ruling is stated with its
reason.

How an implementer uses these: write one test per file that loads each listed board, runs
`route()` with the stated settings, and asserts the outcome column; the tests belong to the fast
tier when every listed board is fast in `MANIFEST.json`, otherwise to the slow tier.
