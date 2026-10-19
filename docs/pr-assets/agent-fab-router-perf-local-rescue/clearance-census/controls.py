"""Reject independent replay, counter, and source corruption."""
import copy,gzip,json
from pathlib import Path
from verify import check,source_check
HERE=Path(__file__).resolve().parent
records=json.loads(gzip.decompress((HERE/'records.json.gz').read_bytes()))
audit=json.loads((HERE/'source-audit.json').read_text())
observer=gzip.decompress((HERE/'clear-observer.ts.gz').read_bytes())
check(records);source_check(audit,observer)
controls=[
 lambda r:r[0].__setitem__('ses',r[0]['ses']+'x'),
 lambda r:r[0]['result']['stats'].__setitem__('unrouted',-1),
 lambda r:r[0]['census']['calls'].__setitem__('pad',-1),
 lambda r:r[0]['census']['blocked'].__setitem__('unknown',1),
 lambda r:r[0]['census']['pairs'].__setitem__('unknown:disk:disk:spacing',1),
 lambda r:r[1]['census']['calls'].__setitem__('pad',r[1]['census']['calls']['pad']+1),
]
for mutate in controls:
 r=copy.deepcopy(records);mutate(r)
 try:check(r)
 except (AssertionError,KeyError):pass
 else:raise AssertionError('corruption accepted')
for kind in range(3):
 a=copy.deepcopy(audit);o=observer
 if kind==0:a['src/route/clear.ts']['original']='0'*64
 elif kind==1:a.pop(next(iter(a)))
 else:o+=b'\n'
 try:source_check(a,o)
 except (AssertionError,KeyError):pass
 else:raise AssertionError('source corruption accepted')
print(json.dumps({'replay_corruptions_rejected':len(controls),'source_corruptions_rejected':3}))
