"""Collect raw, complete records; verify against the independent archived control."""
from pathlib import Path
import gzip,json,shutil,sys
from verify import summarize
s=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(exist_ok=True,parents=True)
r=[dict(mode=m,repeat=i,result=json.loads((s/f'{m}{i}/result.json').read_text()),ses=(s/f'{m}{i}/board.ses').read_text()) for i in (1,2,3) for m in ('original','candidate')]
a=json.loads((s/'work/audit.json').read_text());data=gzip.decompress((s/'work/search-candidate.ts.gz').read_bytes())
summary=summarize(r,a,data)
(out/'records.json.gz').write_bytes(gzip.compress(json.dumps(r).encode(),mtime=0))
(out/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
shutil.copyfile(s/'work/audit.json',out/'source-audit.json');shutil.copyfile(s/'work/search-candidate.ts.gz',out/'search-candidate.ts.gz')
for m in ('original','candidate'):
    for suffix in ('1','2','3','-checks'):
        name=m+suffix+'.log';(out/(name+'.gz')).write_bytes(gzip.compress((s/name).read_bytes(),mtime=0))
shutil.copyfile(s/'work/parity.json',out/'result.json')
shutil.copyfile(s/'exits.json',out/'exits.json')
print(json.dumps(summary,indent=2))
