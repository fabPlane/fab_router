from pathlib import Path
import hashlib,json,shutil,subprocess,tarfile
r=Path(__file__).resolve().parent;repo=Path('/home/hyper/bench/wt/fr-bugs');a=repo/'docs/pr-assets/agent-fab-router-native-drc-gate/c208-connectivity-detours'
for n in ['README.md','verify.py','reproduce.py','reproduce-recheck.py','probe.py','recheck.py','render.py','package.py','probe.log','recheck.log','checks.log','focused.log','focused-final.log','static-final.log','replay-original.log','render.log','load-control.py','load-control.json','load-control.log','minimal-load.py','minimal-load.log','load-minimal.kicad_pcb','load-minimal-saved.kicad_pcb']:
 shutil.copyfile(r/n,a/n)
for d in ['results','recheck']:shutil.copyfile(r/d/'summary.json',a/(d+'-summary.json'))
shutil.copyfile(repo/'test/fixtures/native-aquarius-thermal/LICENSE',a/'LICENSE')
hashes={str(p.relative_to(repo)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted([*repo.glob('src/**/*.ts'),*repo.glob('tools/native-*'),repo/'tools/kicad-board-rules.ts',repo/'test/native-aquarius-connectivity.test.ts',*repo.glob('test/fixtures/native-aquarius-thermal/*')]) if p.is_file()}
(a/'source-hashes.json').write_text(json.dumps(hashes,indent=2)+'\n')
with tarfile.open(a/'native-evidence.tar.xz','w:xz') as t:
 for n in ['results','recheck','runtime','verify.py','reproduce.py','reproduce-recheck.py','load-control.py','load-control.json','load-control.log','save-only.kicad_pcb','minimal-load.py','minimal-load.log','load-minimal.kicad_pcb','load-minimal-saved.kicad_pcb']:
  t.add(r/n,arcname=n,filter=lambda m:None if '__pycache__' in m.name else m)
 t.add(a/'LICENSE',arcname='LICENSE')
(a/'provenance.json').write_text(json.dumps(dict(cycle=208,machine='hyper-ms-lin',cores='20-25',native_version='10.0.6',parent_commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip(),case='kitspace-aquarius-j4',retained_router_commit='8fa7ead0c45b0e7ca33737ff418f6309d51d762c',scored_router_rerun=False,production_fix=False,sweep_checks=20,repeated_checks=9,all_native_attempts_retained=True,native_failed_or_stopped_attempts=0,ownership_changes_in_sweep=5,unsafe_zero_error_detours=3,gate_rejects_fixture_due_to_open_budget=True,limits=['Diagnostic/regression only; no safe repair or scored gain.','Source/routed pair and report counts alone fail to identify unsafe reassignment.','Submitted files reconstructed from exact fixture/helper; native-saved files actually captured.','Current gate does not compare submitted candidate against native-saved ownership.','Historical full scores not rerun; no integration pin bump.']),indent=2)+'\n')
manifest={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(a.iterdir()) if p.is_file() and p.name!='manifest.json'}
(a/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print('manifest members',len(manifest),'archive bytes',(a/'native-evidence.tar.xz').stat().st_size)
