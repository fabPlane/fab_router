import sys
"""Audit paired residual experiment, including warning geometry/multiplicity."""
from pathlib import Path
from collections import Counter
import json,hashlib
s=Path(sys.argv[1]).resolve()
initial=json.loads((s/'probe/probe.json').read_text());final=json.loads((s/'probe-final/probe.json').read_text())
assert all(r['settings']['holeClearanceUm']==250 and r['settings']['copperToEdgeClearanceUm']==500 for r in final['rows'])
for mode in ['before','after']:
 for repeat in range(1,4):assert (s/f'probe/{mode}-{repeat}.ses').read_bytes()==(s/f'probe-final/{mode}-{repeat}.ses').read_bytes()
rows=json.loads((s/'native-probe/results.json').read_text());assert len(rows)==6
def canonical(v):
 if isinstance(v,dict):return {k:canonical(x)for k,x in v.items()if k!='uuid'}
 if isinstance(v,list):return [canonical(x)for x in v]
 return v
finger=lambda v:json.dumps(canonical(v),sort_keys=True)
summary=[]
for repeat in range(1,4):
 b,a=[next(r['check']for r in rows if r['mode']==m and r['repeat']==repeat)for m in ['before','after']]
 assert b['opens']==a['opens']==15 and b['new_errors']==a['new_errors']==6
 assert Counter(map(finger,b['new_error_details']))==Counter(map(finger,a['new_error_details']))
 assert all(b['fidelity'].values()) and a['fidelity']==b['fidelity']
 assert a['vias']==b['vias']+1 and a['length_mm']==b['length_mm']
 bw,aw=[Counter(map(finger,r['new_warning_details']))for r in [b,a]]
 assert not aw-bw,'Introduced native warning'
 removed=[json.loads(v)for v,n in (bw-aw).items()for _ in range(n)]
 assert removed and all(v['type']=='isolated_copper'for v in removed)
 summary.append({'repeat':repeat,'before':{k:b[k]for k in ['opens','new_errors','vias','length_mm','new_warnings','ground_connected']},'after':{k:a[k]for k in ['opens','new_errors','vias','length_mm','new_warnings','ground_connected']},'removed_isolation_warnings':len(removed),'engine_incomplete':[final['rows'][repeat-1]['beforeExact']['incompletes'],final['rows'][repeat-1]['afterExact']['incompletes']]})
(s/'probe-summary.json').write_text(json.dumps({'scope':'Residual import/refill diagnostics only; unchanged native opens; no manufacturing-clean or production routing gain','rows':summary,'initial_final_ses_identical':True,'final_profile_rule_overrides_verified':True},indent=2)+'\n')
print(json.dumps(summary,indent=2))
