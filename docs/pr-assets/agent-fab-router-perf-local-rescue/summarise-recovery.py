import json,hashlib,subprocess,statistics,math,sys
from pathlib import Path
s=Path(sys.argv[1]);assets=Path(__file__).resolve().parent
files=['reduced-exact-keep.json','reduced-exact-pull.json','reduced-node-keep.json','reduced-node-pull.json','original.json']
runs={p:json.loads((s/p).read_text()) for p in files}
assert all(len(r['rows'])==3 for r in runs.values())
def length(tracks):return sum(sum(math.hypot(b['x']-a['x'],b['y']-a['y']) for a,b in zip(t['pts'],t['pts'][1:])) for t in tracks)/10000
summary=[]
for file,r in runs.items():
 rows=r['rows'];trials=[t for row in rows for t in row['trials']]
 assert all(not t['aborted'] and not t['deadlineExpired'] and t['violations']==0 for t in trials)
 assert len({row['sesBeforeSha256'] for row in rows})==1 and len({row['sesAfterSha256'] for row in rows})==1
 assert all(row['profile']==rows[0]['profile'] for row in rows)
 if r['context']=='reduced':
  assert all(row['closed'] and len(row['trials'])==1 for row in rows)
 else:assert all(not row['closed'] and len(row['trials'])==16 and row['sesBeforeSha256']==row['sesAfterSha256'] for row in rows)
 summary.append({'file':file,'context':r['context'],'mode':r['mode'],'repeats':3,'closed':sum(row['closed'] for row in rows),'before_opens':3,'after_opens':sum(not row['closed'] for row in rows),'normal_median_s':statistics.median(row['normalSeconds'] for row in rows),'normal_p95_s':max(row['normalSeconds'] for row in rows),'recovery_median_s':statistics.median(row['recoverySeconds'] for row in rows),'recovery_p95_s':max(row['recoverySeconds'] for row in rows),'length_mm':list(map(lambda row:length(row['tracks']),rows)),'vias_added_by_recovery':0,'trials':len(trials)})
# All four ablations use the SAME successful raw path: uniform cost and bounded region.
paths=[runs[f]['rows'][0]['trials'][0]['rawPath'] for f in files[:4]]
assert all(p==paths[0] for p in paths)
assert runs[files[0]]['rows'][0]['trials'][0]['rawWholeLegal']
assert all(not runs[f]['rows'][0]['trials'][0]['wholeLegal'] for f in [files[1],files[3]])
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
enginefiles=subprocess.check_output(['git','ls-files','src','spec/types','tools'],text=True).splitlines()
for p in enginefiles:
 expected=subprocess.check_output(['git','show','69cf598:'+p])
 assert hashlib.sha256(expected).hexdigest()==sha(Path(p)),p
controls={'production_files_identical_to_main_69cf598':len(enginefiles),'production_sha256':{p:sha(Path(p)) for p in enginefiles},'experiment_sha256':{p:sha(assets/p) for p in ['exact-local-recovery.ts','recovery-geometry.ts','plot-recovery.py']},'result_sha256':{p:sha(s/p) for p in files},'same_raw_path_across_ablations':True,'scope':'Engine-only controlled fixture experiment, no adopted recovery, native gain or speedup. Source unchanged; original 60-pad recovery rejected.'}
(s/'recovery-summary.json').write_text(json.dumps(summary,indent=2)+'\n');(s/'recovery-controls.json').write_text(json.dumps(controls,indent=2)+'\n')
print(json.dumps(summary,indent=2))
