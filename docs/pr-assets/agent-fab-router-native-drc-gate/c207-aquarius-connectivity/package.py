from pathlib import Path
import json,tarfile,shutil,hashlib,subprocess
r=Path(__file__).resolve().parent;repo=Path('/home/hyper/bench/wt/fr-bugs');a=repo/'docs/pr-assets/agent-fab-router-native-drc-gate/c207-aquarius-connectivity';a.mkdir(exist_ok=True)
source=Path('/home/hyper/bench/wt/fp-bugs/benchmarks/autorouter/cases/kitspace-aquarius-j4/board.kicad_pcb');routed=r.parent/'c196/full-after/runs/run-20261019T211154.565516Z-004/fab-router/final.kicad_pcb'
for name in ['minimize.py','recheck.py','render.py','verify.py','reproduce-minimize.py','minimize.log','recheck.log','checks.log','render.log','replay-original.log','source-hashes.json','static-final.log','regression.log','package.py']:
 shutil.copyfile(r/name,a/name)
for name in ['summary.json','results.json','selected-copper.json']:shutil.copyfile(r/'minimized'/name,a/name)
shutil.copyfile(r/'recheck/results.json',a/'repeat-results.json')
shutil.copyfile(repo/'test/fixtures/native-aquarius-thermal/LICENSE',a/'LICENSE')
with tarfile.open(a/'native-evidence.tar.xz','w:xz') as t:
 for n in ['minimized','recheck','helpers']:t.add(r/n,arcname=n,filter=lambda member: None if '__pycache__' in member.name else member)
 for b,role in [(source,'source'),(routed,'routed')]:
  for ext in ['.kicad_pcb','.kicad_pro','.kicad_dru']:t.add(b.with_suffix(ext),arcname='original/'+role+'/board'+ext)
 for n in ['verify.py','reproduce-minimize.py']:t.add(r/n,arcname=n,filter=lambda member: None if '__pycache__' in member.name else member)
 t.add(repo/'test/fixtures/native-aquarius-thermal/LICENSE',arcname='LICENSE')
provenance=dict(cycle=207,machine='hyper-ms-lin',cores='20-25',native_version='10.0.6',case='kitspace-aquarius-j4',seed=1,retained_router_commit='8fa7ead0c45b0e7ca33737ff418f6309d51d762c',gate_commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip(),router_rerun=False,production_fix=False,discovery_checks=74,repeat_checks=9,all_attempts_retained=True,source_sha256={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in [source,routed]},limits=['Three-track added-copper one-deletion minimum, not a globally minimal board.','Repeated retained seed-1 output; no new routing seeds or scored gain.','Deletion trials can add unrelated errors/opens; never proposed as repairs.','New regression reproduces existing failure/rejection; no behavioral fix/fail-first claim.','No source/rule/checker/scoring/route/perf/integration changes.','No new complete scored run. Latest optional full run is cycle206; default cycle203.'])
(a/'provenance.json').write_text(json.dumps(provenance,indent=2)+'\n')
(a/'README.md').write_text('''# Three-track ground partition reproducer

Three foreign-net B.Cu signal segments from the retained placement-corrected
Aquarius J4 seed-1 output isolate GNDD U1.39 from its 61 source-connected peers
when the native checker refills zones. All are 0.2032 mm wide. The nets are
`Net-(C1-Pad1)`, `+3V3`, and `Net-(R1-Pad1)`. One track is the earlier horizontal
thermal witness; all three are necessary for this source-connected group split.
Removing any one restores every source pair, even where a thermal error remains.
Thus a thermal error and a ground partition are related but distinct failures.

Same source/rules/machine/native 10.0.6; three fresh repetitions of EACH witness:

| Witness | Added copper | New thermal errors | Opens | Lost source pairs |
|---|---:|---:|---:|---:|
| Source | 0 | 0 | 110 | 0 |
| Before reduction: full output | 466 | 6 | 15 | 348 |
| After reduction: three tracks | 3 | 1 | 114 | 61 |

All three repetitions match. Removing each single track from the reduced witness
restores zero lost source pairs and 112 opens. Thermal counts are 0, 1, 1 for the
three deletions. The independent replay verifies all 74 discovery/refill checks
and 9 repeated checks, including every single deletion. Raw native diagnostics,
boards, partitions, reports, sidecars, original source/output and license are
retained without omission. No native process failed or trial was stopped.

The regression checks loss, offending terminal identity, deletion necessity,
thermal/open counts, unchanged source bytes and an accepted source-only control.
It is new failure coverage, not a newly implemented routing fix. Original source
has duplicate graphical UUIDs; these are retained exactly here. No rules or
acceptance guard were weakened. This cut is not a candidate routing repair.

Latest complete scored summaries are RETAINED, not rerun in this cycle:

| Pipeline | Passing runs | Valid cases (3/3) | Opens | New thermal errors |
|---|---:|---:|---:|---:|
| Default (cycle203) | 39/78 | 13/26 | 120 | 27 |
| Optional before axial fix (cycle206) | 45/78 | 15/26 | 120 | 18 |
| Optional after axial fix (cycle206) | 45/78 | 15/26 | 120 | 18 |

No new scored gain, timing claim, engine fix or pin bump. Next: use this cut to
verify connection-preserving detours and ground-refill behavior before attempting
full-board repair; full Aquarius still has 348 lost pairs and six thermal errors.
The perf agent retains ownership of route/stall/relaxation functions.

![Native ground partition](comparison.png)

Exact commands from the repository root:

```sh
taskset -c 20-25 nice -n 10 bun test test/native-aquarius-connectivity.test.ts --timeout 180000
taskset -c 20-25 nice -n 10 bun run typecheck
taskset -c 20-25 nice -n 10 bun run check:layers
taskset -c 20-25 nice -n 10 bun run test
mkdir /tmp/c207-replay
tar -xJf docs/pr-assets/agent-fab-router-native-drc-gate/c207-aquarius-connectivity/native-evidence.tar.xz -C /tmp/c207-replay
python3 /tmp/c207-replay/verify.py /tmp/c207-replay
# Optional fresh native deletion minimization; output must not already exist:
taskset -c 20-25 nice -n 10 timeout 2400 python3 /tmp/c207-replay/reproduce-minimize.py /tmp/c207-fresh
```

`checks.log` records the required complete checks. `source-hashes.json` records
all engine source/native helpers and the new regression; production files were
unchanged. The archived helper replays independently of the local worktree.
''')
manifest={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(a.iterdir()) if p.is_file() and p.name!='manifest.json'}
(a/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print('assets',len(manifest),'archive bytes',(a/'native-evidence.tar.xz').stat().st_size)
