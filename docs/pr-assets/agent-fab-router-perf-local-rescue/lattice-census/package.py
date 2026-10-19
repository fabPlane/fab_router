from pathlib import Path
import gzip,json,sys
from verify import check
work=Path(sys.argv[1]);out=Path(sys.argv[2]);assert not out.exists(), 'unused output'
records=[]
for i in range(1,4):
    d=work/f'replay{i}'
    records.append({'result':json.loads((d/'result.json').read_text()),'ses':(d/'board.ses').read_text(),'census':json.loads((d/'census.json').read_text())})
summary=check(records)
out.write_bytes(gzip.compress((json.dumps(records,indent=2)+'\n').encode(),mtime=0))
print(json.dumps(summary,indent=2))
