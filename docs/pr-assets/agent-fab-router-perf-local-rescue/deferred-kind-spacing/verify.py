import copy,gzip,json
from pathlib import Path
from report import validate
p=Path(__file__).resolve().parent
d=json.loads(gzip.decompress((p/'results.json.gz').read_bytes()));validate(d)
mutations=[lambda x:x['after'].pop(),lambda x:x['after'][0]['rows'][0].update(after=3),lambda x:x['after'][0]['rows'][0]['attempts'][0].update(exact=1),lambda x:x['after'][0]['rows'][0]['attempts'][0]['result'].update(work=100001),lambda x:x['after'][0]['rows'][0]['attempts'][0]['result']['attempts'][0]['proposals'][0].update(nodes=1)]
for mutation in mutations:
 x=copy.deepcopy(d);mutation(x)
 if len(x['after'])==3:x['after']=[copy.deepcopy(x['after'][0]) for _ in range(3)]
 try:validate(x)
 except AssertionError:pass
 else:raise AssertionError('Corruption accepted')
print('PASS original archive and five corrupted controls')
