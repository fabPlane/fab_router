"""Recompute reported aggregate counts from the complete raw result archives."""
import gzip,json,hashlib,math
from pathlib import Path
from statistics import median
asset=Path(__file__).parent
load=lambda p:json.loads(gzip.decompress(p.read_bytes())if p.suffix=='.gz'else p.read_bytes())
d=load(asset/'native-comparison.json')
for mode in ['before','after']:
 rows=load(asset/f'native-{mode}-results.json.gz');controls=load(asset/f'native-{mode}-controls.json.gz')
 assert len(rows)==78 and len({(r['case'],r['seed'])for r in rows})==78
 assert len({r['case']for r in rows})==26 and {r['seed']for r in rows}=={1,2,3}
 assert controls['complete']and controls['controls_preserved']and not controls['interrupted']and not controls['smoke']
 assert controls['allowed_cpus']==list(range(12,20))
 expected={k:sum(r[k]for r in rows)for k in ['passed','opens','new_errors','vias','length_mm']}
 expected.update(median_s=median(r['seconds']for r in rows),p95_s=sorted(r['seconds']for r in rows)[math.ceil(.95*len(rows))-1],total_s=sum(r['seconds']for r in rows),valid_cases_3of3=sum(all(r['passed']for r in rows if r['case']==case)for case in {r['case']for r in rows}))
 assert expected==d['summary'][mode]
 for r in rows:
  pair=next(p for p in d['attempts']if (p['case'],p['seed'])==(r['case'],r['seed']))
  assert pair[mode]=={k:r[k]for k in pair[mode]}
assert len(d['regressions'])==6 and d['same_sessions']==57
assert d['summary']['after']['opens']>d['summary']['before']['opens']
assert d['summary']['after']['new_errors']>d['summary']['before']['new_errors']
details=load(asset/'rejection-details.json');assert len(details)==18
assert all(r['engine_violations_added']==r['engine_violations_total']==0 for r in details)
print('PASS: complete raw archives agree with all paired counts; candidate rejected')
