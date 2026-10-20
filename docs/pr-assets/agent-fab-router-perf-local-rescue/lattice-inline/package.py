from pathlib import Path
import gzip,json,sys
from verify import verify,source_check
work=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(exist_ok=True)
records=json.loads((work/'records.json').read_text());verify(records)
source_check(json.loads((work/'source-audit.json').read_text()),gzip.decompress((work/'grid-candidate.ts.gz').read_bytes()))
(out/'records.json.gz').write_bytes(gzip.compress(json.dumps(records,indent=2).encode()+b'\n',mtime=0))
for name in ('source-audit.json','grid-candidate.ts.gz'):(out/name).write_bytes((work/name).read_bytes())
for mode in ('original','candidate'):
    for repeat in range(1,4):
        name=f'{mode}-{repeat}.log';(out/(name+'.gz')).write_bytes(gzip.compress((work/name).read_bytes(),mtime=0))
