# Full-context coordinated via control

This cycle adds a diagnostic regression, not an automatic repair. The source is the retained frozen Aquarius input and the complete retained 466-item generated route. Neither input nor checker is edited. The existing strict gate still rejects the candidate.

On hyper-ms-lin, cores 20–25: move the upper generated TCK via from (162.9939,50.8553) to (162.8939,50.9553) mm and its attached endpoints. Move both adjacent LED4 vias from x=162.3543 to x=162.2343 mm with their incident endpoints. Exactly eight generated items change (three vias/five tracks). All other copper, nets, widths, drills and source/rules remain.

Seven discovery/save/refill probes are all retained. TCK alone produces three clearances. LED4 shifts −0.08 mm retains two; shifts −0.12/−0.16/−0.20/−0.25 mm have no added clearance. These sampled points are not a continuous legal interval proof. The −0.12 mm candidate is separately checked three times against both original and routed boards. Both phases retain six thermals. Lost source pairs 348→292, opens 15→14, no lost current routed pairs; all ownership checks true. Exactly 56 restored source pairs involve U1.53. Strict final acceptance remains false 3/3. The full scored router was not rerun because src/tools/adapter behavior is unchanged; last optional full suite remains 45/78 passes,15/26 valid,120 opens,18 thermal errors (cycle211); default39/78,13/26,120,27. No score/speed gain claimed.

Reproduce from this engine checkout:

```sh
S=/tmp/c214-reproduction
mkdir -p "$S"
tar -xJf docs/pr-assets/agent-fab-router-native-drc-gate/c214-joint-vias/evidence.tar.xz -C "$S"
python3 "$S/verify.py" "$S"
taskset -c 20-25 nice -n 10 timeout 600 bun "$S/recheck.ts" "$S/fresh-strict"
taskset -c 20-25 nice -n 10 timeout 300 bun test test/native-aquarius-connectivity.test.ts --test-name-pattern 'coordinated generated'
taskset -c 20-25 nice -n 10 timeout 2400 sh -c 'bun run typecheck && bun run check:layers && bun run test'
```

Archive includes original inputs/rules, all seven discovery native boards/reports/partitions, six independent strict decisions with native reports, scripts, inventory verification and logs. Existing fixture licensing is retained. `verify.py` independently compares exact Decimal physical copper and semantic ownership, reconstructs every modified inventory, recomputes source-pair losses, verifies strict counts and requires all six final rejections. Initial verification compared numeric strings rather than numeric values and failed on equivalent six-place formatting; final verifier normalizes numeric atoms exactly with Decimal. No native acceptance tolerance changed. No native/checker attempt omitted. The test is an empirical full-context regression, not a fail-first production fix.
