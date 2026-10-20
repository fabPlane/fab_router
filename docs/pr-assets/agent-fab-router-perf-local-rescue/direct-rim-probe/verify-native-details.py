"""python3 verify-native-details.py EXTRACTED_EVIDENCE_ROOT"""
from pathlib import Path
import json,sys
w=Path(sys.argv[1]).resolve()
rs=[{(r['case'],r['seed']):r for r in json.loads((w/f'native-{m}/results.json').read_text())}for m in ['original','candidate']]
assert len(rs[0])==len(rs[1])==78 and rs[0].keys()==rs[1].keys()
def canon(x):
 if isinstance(x,dict):return {k:canon(v)for k,v in x.items()if k!='uuid'}
 if isinstance(x,list):return sorted((canon(v)for v in x),key=lambda v:json.dumps(v,sort_keys=True))
 return x
for k,a in rs[0].items():
 b=rs[1][k]
 for key in ['passed','opens','new_errors','vias','length_mm','failed_fidelity']:assert a[key]==b[key],(k,key)
 for key in ['new_error_details','new_warning_details']:assert canon(a['check'].get(key,[]))==canon(b['check'].get(key,[])),(k,key)
print('PASS exact all78 paired native quality fields and canonical error/warning geometry')
