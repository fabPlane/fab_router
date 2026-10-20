"""Reject changes outside the declared single-module experiment."""
from pathlib import Path
import copy,gzip,json,sys
from verify import source_check
p=Path(sys.argv[1]); audit=json.loads((p/'source-audit.json').read_text()); candidate=gzip.decompress((p/'grid-candidate.ts.gz').read_bytes())
source_check(audit,candidate)
rejected=[]
for label in ('baseline','extra-module','candidate'):
 bad=copy.deepcopy(audit); body=candidate
 if label=='baseline':bad['src/lattice/grid.ts']['original']='0'*64
 if label=='extra-module':bad['src/api.ts']['candidate']='0'*64
 if label=='candidate':body+=b'\nwrong'
 try:source_check(bad,body)
 except AssertionError:rejected.append(label)
 else:raise AssertionError('accepted '+label)
print(json.dumps({'rejected':rejected},indent=2))
