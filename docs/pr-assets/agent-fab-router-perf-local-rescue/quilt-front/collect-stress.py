"""Retain bounded stress and full enabled slow evidence without native-score conflation."""
from pathlib import Path
import base64,gzip,hashlib,json,sys
here=Path(__file__).resolve().parent;work=Path(sys.argv[1]).resolve()
def packed(name,obj):
 raw=json.dumps(obj,separators=(',',':')).encode();(here/name).write_bytes(gzip.compress(raw,mtime=0))
dense=work/'dense';rows=json.loads((dense/'results.json').read_text());assert len(rows)==2
files={}
for r in rows:
 folder=dense/'runs'/r['record']['attempt']/'fab-router';data={}
 for name in ('check.json','record.json','work/board.dsn','work/board.ses','work/dsn-manifest.json','work/router-summary.json'):
  raw=(folder/name).read_bytes();data[name]={'base64':base64.b64encode(raw).decode(),'sha256':hashlib.sha256(raw).hexdigest()}
 files[r['record']['attempt']]=data
packed('dense-raw.json.gz',{'rows':rows,'controls':json.loads((dense/'controls.json').read_text()),'files':files})
(here/'dense-comparison.json').write_bytes((work/'dense-comparison.json').read_bytes())
ladder=[]
for case in ('l2','l3-cycle18'):
 pair={}
 for mode in ('original','candidate'):
  folder=work/f'{case}-{mode}';pair[mode]={'ses':(folder/'board.ses').read_text(),'result':json.loads((folder/'result.json').read_text())}
 ladder.append({'case':case,'inputDsn':Path(f'/home/hyper/bench/boards/ladder/{case}.dsn').read_text(),'inputSha256':hashlib.sha256(Path(f'/home/hyper/bench/boards/ladder/{case}.dsn').read_bytes()).hexdigest(),'pair':pair})
packed('ladder-records.json.gz',ladder)
slow=json.loads((work/'slow.json').read_text());assert slow['complete'] and slow['total']==63
packed('slow.json.gz',slow)
(here/'slow-comparison.json').write_bytes((work/'slow-comparison.json').read_bytes())
for name in ('dense.log','slow.log','stress-exits.json'):
 (here/(name+'.gz')).write_bytes(gzip.compress((work/name).read_bytes(),mtime=0))
print('PASS collected dense pair, ladder pairs and complete enabled slow sweep')
