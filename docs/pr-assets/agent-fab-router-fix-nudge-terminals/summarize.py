import json, hashlib, statistics, sys
from pathlib import Path
root=Path(__file__).resolve().parents[3]
a=Path(sys.argv[1])
b=Path(sys.argv[2])
A=json.loads((a/'results.json').read_text()); B=json.loads((b/'results.json').read_text())
summary=json.loads((b/'summary.json').read_text())
assert summary['complete'] and summary['controls_preserved'] and len(A)==len(B)==78
ac=json.loads((a/'controls.json').read_text());bc=json.loads((b/'controls.json').read_text())
keys=['inputs_sha256','configs_sha256','harness_sha256','runtime_sha256','runtime_source_sha256','order','seeds','allowed_cpus']
for k in keys: assert ac[k]==bc[k],k
hashes=bc['candidate']['source_sha256']
for p,h in hashes.items(): assert hashlib.sha256((root/p).read_bytes()).hexdigest()==h,p
fields=['passed','opens','new_errors','vias','length_mm']
x={(r['case'],r['seed']):r for r in A}; y={(r['case'],r['seed']):r for r in B}
assert x.keys()==y.keys()
changes=[{'case':key[0],'seed':key[1],'before':{f:x[key][f] for f in fields},'after':{f:y[key][f] for f in fields}} for key in sorted(x) if any(x[key][f]!=y[key][f] for f in fields)]
for key in x:
 assert y[key]['opens']<=x[key]['opens'],key
 assert y[key]['new_errors']<=x[key]['new_errors'],key
 assert not x[key]['passed'] or y[key]['passed'],key
def totals(rows):
 return dict(cases=len({r['case'] for r in rows}),runs=len(rows),passed=sum(r['passed'] for r in rows),valid_cases_3of3=sum(all(r['passed'] for r in rows if r['case']==c) for c in {r['case'] for r in rows}),opens=sum(r['opens'] for r in rows),new_errors=sum(r['new_errors'] for r in rows),median_route_s=statistics.median(r['seconds'] for r in rows))
out={'baseline':'69cf598','candidate_source_commit':'3a556d22b0db665c63156ae64915d0542c99e090','before':totals(A),'after':totals(B),'all_source_hashes_verified':len(hashes),'equal_controls':keys,'candidate_source_sha256':hashes,'changes':changes,'cases':[{'case':k[0],'seed':k[1],'before':{f:x[k][f] for f in fields},'after':{f:y[k][f] for f in fields}} for k in sorted(x)]}
(root/'docs/pr-assets/agent-fab-router-fix-nudge-terminals/benchmark-summary.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({k:v for k,v in out.items() if k in ['before','after','changes','all_source_hashes_verified']},indent=2))
