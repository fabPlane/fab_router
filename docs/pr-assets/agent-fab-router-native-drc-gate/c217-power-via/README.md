# Complete power-net thermal recovery and rejected full-board transfer

This evidence adds a native regression for the benchmark's Aquarius U1.55
thermal failure. It changes tests and fixtures only. No production router,
proposal generator, adapter, frozen input, scoring or checker changes occur.

Starting from cycle 216's complete generated power net after its U1.53 detour,
move the generated power via from (164.1045, 50.6008) to
(163.8045, 50.9008) mm together with its three incident track endpoints.
All 65 generated copper items remain, with exactly four changed identities;
all source copper, net ownership, widths, layers, via dimensions, pads, zones,
rules and source/current terminal pairs remain. This opens a second ground
thermal spoke without deleting routes. The pure horizontal and vertical moves
up to 0.3 mm do not solve the thermal; diagonal 0.3/0.4/0.5 mm moves do.

The same move is unsafe in the complete board: it creates three clearance
findings against the lower signal via and loses 57 current terminal pairs.
Those 57 pairs all involve U1.53: the full-board GNDD partition changes from
58+3+1 to 57+3+1+1. U1.55 remains connected in the 57-pad group and its thermal
clears; U1.53 becomes a singleton. In the complete power-net control, the
62-pad GNDD group remains intact before and after.
Five of seven additional coordinated lower-signal-via moves remove clearances
but all seven still lose those 57 pairs. Full-board repair remains unresolved.
The native gate rejects every unsafe full-board candidate. No manual candidate
is substituted into the scored benchmark.

| Native control, same host and rules | Before | After | Repeats per version |
| --- | --- | --- | --- |
| Complete power net: new thermal errors | 1 | 0 | 3 |
| Complete power net: opens / lost source / lost current pairs | 95 / 0 / 0 | 95 / 0 / 0 | 3 |
| Complete power net: strict acceptance | 0/3 | 3/3 | 3 |
| Complete board: new thermal / clearance errors | 6 / 0 | 5 / 3 | 3 |
| Complete board: opens / lost source / lost current pairs | 13 / 235 / 0 | 14 / 292 / 57 | 3 |
| Complete board: strict / relative acceptance | 0/3 / 3/3 | 0/3 / 0/3 | 3 |

All native measurements use host hyper-ms-lin, CPU affinity 20–25 and the
unchanged native 10.0.6 checker/rules. Twelve strict three-board decisions
contain 36 native checks. Discovery contains 31 additional fresh refill checks:
12 power-via, 12 full-board power-via and seven coordinated signal-via controls.
No failed attempt was dropped. Reports, submitted and saved boards, terminal
partitions and exact source/rules/licenses are retained in the native archive.

The new regression is a manual recovery witness, not a fail-first production
bug fix. The automatic search still does not move vias, and its source/current
connectivity guards remain unchanged. No speed improvement is claimed; test
and benchmark jobs share the six assigned cores.

## Reproduce

From the engine checkout, with the native checker and Python board bindings:

```bash
taskset -c 20-25 nice -n 10 bun test test/native-aquarius-power-via.test.ts
taskset -c 20-25 nice -n 10 bash -c 'bun run typecheck && bun run check:layers && bun run test'
```

Extract both archives into the same fresh directory. `verify.py` independently
recomputes all captured native counts and lost terminal pairs; it checks exact
four-item changes, all source copper, hashes, physical inventories and semantic
net ownership. `compare.py` compares all benchmark cases and input controls.

```bash
mkdir /tmp/c217-evidence
tar -xJf native-evidence.tar.xz -C /tmp/c217-evidence
tar -xJf benchmark-evidence.tar.xz -C /tmp/c217-evidence
python3 /tmp/c217-evidence/verify.py /tmp/c217-evidence
python3 /tmp/c217-evidence/compare.py /tmp/c217-evidence
mkdir /tmp/c217-fresh
cp -a /tmp/c217-evidence/power /tmp/c217-evidence/full /tmp/c217-fresh/
taskset -c 20-25 nice -n 10 timeout 600 bun /tmp/c217-evidence/recheck.ts /tmp/c217-fresh
```

Run the unmodified standalone single-engine benchmark from the integration
checkout. The before run is the retained cycle 216 default control, not a new
before run this cycle. Both runs cover the same 26 cases × three seeds; the
recorded source, inputs, settings, runtime, machine and CPU controls are compared.

```bash
cd /home/hyper/bench/wt/fp-bugs
taskset -c 20-25 nice -n 10 timeout 2400 python3 benchmarks/autorouter/benchmark.py --router fab-router --fab-router-source /home/hyper/bench/wt/fr-bugs --out /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c217/full-router
```

The exact command requires a fresh output directory when repeated. To replay
only the native scripts against retained boards, run `recheck.ts` from the engine
root as above. The archived `prepare.py` records discovery provenance and reads
prior-cycle scratch inputs; it is not needed by either portable verifier.

Verification development initially sorted equivalent Decimal endpoint spellings
by representation, producing a false inventory mismatch. Normalizing exact
Decimals before sorting fixes that diagnostic, without numeric tolerance or any
change to native checks. Initial failure logs are retained.

## Default benchmark verification

The retained cycle 216 control and fresh cycle 217 default run both complete
all 78 checked attempts: 39 passing runs, 13 valid cases, 120 total opens and
27 new thermal errors. Aquarius remains 15 opens and six new thermal errors
per seed. All 78 status, pass, open, error, fidelity, warning, physical copper,
DSN and session comparisons match. The before median is 2.072766107 seconds and the
after median is 1.670251426 seconds; concurrent work prevents any speed claim.

The execution session collection unexpectedly returned 143 after the final
complete report was written. Captured controls report complete=true,
interrupted=false and controls_preserved=true; every attempt is checked.
No process exit 0 or cause of that collection status is claimed. The complete
raw run and this anomaly are retained in job-status.json and the archives.

Required validation completed with exit 0: typecheck, the layer check across 65 files with zero
violations, 932 tests / zero failures / 398979 assertions in 1038.82 seconds.
The new regression passes all 18 assertions in the focused and complete runs.
All 73 measured source/tool/test/fixture hashes remain unchanged.
