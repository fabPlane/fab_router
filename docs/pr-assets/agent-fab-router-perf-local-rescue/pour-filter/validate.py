"""Reconstruct the measurement and reject deliberate record/source corruption."""
from pathlib import Path
import copy,gzip,json,sys
from verify import verify,source_check,controls
p=Path(__file__).resolve().parent
r=json.loads(gzip.decompress((p/'records.json.gz').read_bytes()))
a=json.loads((p/'source-audit.json').read_text())
g=gzip.decompress((p/'grid-candidate.ts.gz').read_bytes());c=gzip.decompress((p/'clear-candidate.ts.gz').read_bytes())
source_check(a,g,c)
rejected=controls(r)
for name in ('grid-bytes','clear-bytes','original-hash','unexpected-source'):
    bad=copy.deepcopy(a);bg=g;bc=c
    if name=='grid-bytes':bg+=b'changed'
    if name=='clear-bytes':bc+=b'changed'
    if name=='original-hash':bad['src/lattice/grid.ts']['original']='0'*64
    if name=='unexpected-source':bad['src/api.ts']['candidate']='0'*64
    try:source_check(bad,bg,bc)
    except AssertionError:rejected.append(name)
    else:raise AssertionError('accepted '+name)
result={'rejected_controls':rejected,'parity':True,'timings':verify(r)}
Path(sys.argv[1]).write_text(json.dumps(result,indent=2)+'\n')
