from copy import deepcopy
import gzip,json
from pathlib import Path
from verify import check,source_check
records=json.loads(gzip.decompress((Path(__file__).parent/'records.json.gz').read_bytes()))
check(records)
for name,mutate in [
 ('session',lambda r:r.update(ses=r['ses']+'x')),
 ('stats',lambda r:r['result']['stats'].update(remaining=-1)),
 ('visits',lambda r:r['census'].update(visits=r['census']['visits']+1)),
 ('hits',lambda r:r['census'].update(results=r['census']['results']+1)),
 ('queries',lambda r:r['census'].update(queries=r['census']['queries']+1)),
]:
    bad=deepcopy(records)
    for record in bad: mutate(record)
    try: check(bad)
    except AssertionError: print(name+': rejected')
    else: raise AssertionError(name+' accepted')
bad=deepcopy(records);bad[1]['census']['cells']+=1
try:check(bad)
except AssertionError:print('repeat drift: rejected')
else:raise AssertionError('repeat drift accepted')

audit=json.loads((Path(__file__).parent/'source-audit.json').read_text())
observer=gzip.decompress((Path(__file__).parent/'grid-observer.ts.gz').read_bytes())
source_check(audit,observer)
bad=deepcopy(audit);bad['src/lattice/grid.ts']['original']='0'*64
for name,a,b in [('source hash',bad,observer),('observer bytes',audit,observer+b'x')]:
    try:source_check(a,b)
    except AssertionError:print(name+': rejected')
    else:raise AssertionError(name+' accepted')
