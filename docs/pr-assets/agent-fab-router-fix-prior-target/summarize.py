#!/usr/bin/env python3
"""Validate identical native benchmark controls and report all outcomes."""
import argparse,hashlib,json,pathlib,statistics,subprocess
p=argparse.ArgumentParser();p.add_argument('before',type=pathlib.Path);p.add_argument('after',type=pathlib.Path);p.add_argument('--source',default='HEAD');p.add_argument('--out',type=pathlib.Path,required=True);a=p.parse_args()
def read(root,name):return json.loads((root/name).read_text())
controls=[read(root,'controls.json') for root in [a.before,a.after]]
for root in [a.before,a.after]:
 s=read(root,'summary.json');assert s['complete'] and s['controls_preserved'] and s['completed_runs']==78
fields=['inputs_sha256','configs_sha256','harness_sha256','runtime_sha256','runtime_source_sha256','order','seeds','allowed_cpus']
for f in fields:assert controls[0][f]==controls[1][f],f
for c,ref in zip(controls,['69cf598',a.source]):
 for path,digest in c['candidate']['source_sha256'].items():
  data=subprocess.check_output(['git','show',f'{ref}:{path}']);assert hashlib.sha256(data).hexdigest()==digest,(ref,path)
rows=[]
def metrics(rs):
 return {'cases':len(set(r['case'] for r in rs)),'runs':len(rs),'passed':sum(r['passed'] for r in rs),'valid_cases_3of3':sum(all(r['passed'] for r in rs if r['case']==c) for c in set(r['case'] for r in rs)), 'opens':sum(r['opens'] for r in rs),'new_drc_errors':sum(r['new_errors'] for r in rs),'median_route_s':statistics.median(r['seconds'] for r in rs)}
results=[read(root,'results.json') for root in [a.before,a.after]]
assert len(results[0])==len(results[1])==78
for b,c in zip(*results):
 assert (b['case'],b['seed'],b['router'])==(c['case'],c['seed'],c['router'])
 for f in ['passed','opens','new_errors','vias','length_mm']:assert b[f]==c[f],(b['case'],b['seed'],f)
 rows.append({'case':b['case'],'seed':b['seed'],'before':{k:b[k] for k in ['passed','opens','new_errors','vias','length_mm','seconds']},'after':{k:c[k] for k in ['passed','opens','new_errors','vias','length_mm','seconds']}})
out={'baseline':'69cf598','source':a.source,'controls_match':fields,'source_hashes_verified':[len(c['candidate']['source_sha256']) for c in controls],'before':metrics(results[0]),'after':metrics(results[1]),'attempts':rows,'timing_caveat':'Shared host; tests overlap. Descriptive timing only, no speed claim.'}
a.out.write_text(json.dumps(out,indent=2)+'\n');print(json.dumps({k:out[k] for k in ['before','after','source_hashes_verified']},indent=2))
