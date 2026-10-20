# Width-scaled axial thermal search

Implementation `34f33a19c1121a2594e32147dd1ba2e2d759a78b` appends short, endpoint-preserving axial ramps
scaled to track width after the existing complete proposal prefix. The native
acceptance gate and 304-proposal stage cap remain unchanged. No src/ or routing,
stall/recovery, checker, native rules or frozen case changes are involved.

The same complete-net reduced control retains all nine generated items on the
signal net. One standalone search/version: before exhausts 90 proposals and keeps
one thermal and 109 opens; after publishes after 97 checks with zero errors and 109 opens,
zero lost source/current pairs and unchanged native copper ownership. All 90 old
proposal buffers and manifest entries are byte-identical. Three fresh paired
native checks/version agree. The published candidate is byte-identical to the
paired-control candidate. Independent native saves preserve Decimal copper and
semantic ownership inventories, removing one segment and adding three only.

Standalone searches use a 3600-second outer timeout. The adapter's separate
600-second search cap is unchanged; these local measurements do not establish
an adapter-level repair within that budget. The isolated control still exceeds
the source open budget and is refused. Full Aquarius remains unresolved.

Fresh matched opt-in full suite,26 cases × 3 seeds/version on the same six-core host:
before 45/78 pass,15/26 valid,
120 opens,18 new native errors;
after 45/78 pass,15/26 valid,
120 opens,18 new native errors.
All 78 outcomes/physical copper/DSNs/sessions and six successful repair sequences
and accepted checkpoint geometries match. This is reduced-control search coverage,
not a full-suite score or speed improvement. Default scoring was not rerun.

Required final checks: 925 tests, 0 failures, 398,859 assertions, 940.63 seconds; typecheck and layers
pass. The first full check run had 924 passes, 1 timeout and 1 error when the isolated search
exceeded its old 180-second test budget. It now permits 600 seconds for 12 proposals,
without changing refusal assertions. Two initial benchmark preparation failures
stopped before any scored attempts. All failure logs remain here/in the archive.

`provenance.json` and source hashes record the exact executable versions. The
candidate full-suite controls name parent 124b7bd8 because measurement began before
the implementation commit. All measured tool hashes match the committed sources;
the commit changed no executable bytes during the run. Before uses an isolated
124b7bd8 checkout whose tools are executable-identical to the previous integration
pin 4ae389a2. Integration wrapper sources remain unchanged during both runs.

Extract `evidence.tar.xz` into a fresh directory. Run:

```sh
python3 verify.py EXTRACTED
python3 verify-native.py EXTRACTED
python3 compare.py EXTRACTED
```

`verify.py` audits every search attempt, the exact unchanged prefix and bundle
snapshot. `verify-native.py` independently checks Decimal physical/semantic net
inventories and all six paired reports. `compare.py` checks full-suite controls,
all 78 outcomes and physical output inventories, DSN/session equality and successful
repair sequences/checkpoints. Replays use retained reports; fresh execution uses
`reproduce.ts` and `benchmark-reproduce.py` as documented in the PR. The archive
retains exact native runtime tools and fixtures, all matched full-suite artifacts,
all proposals/reports/rules/boards, independent saved boards and source licenses.
Native-save inventory excludes UUIDs and added manufacturing/display defaults;
this is not a complete native-save fidelity proof.
