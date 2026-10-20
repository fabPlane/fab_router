from pathlib import Path
import base64,gzip,hashlib,json,sys
w=Path(sys.argv[1]).resolve();out=Path(sys.argv[2]).resolve()
def packed(name,obj):(out/name).write_bytes(gzip.compress(json.dumps(obj,separators=(',',':')).encode(),mtime=0))
d=w/'dense';rows=json.loads((d/'results.json').read_text());assert len(rows)==6
files={}
for r in rows:
 folder=d/'runs'/r['record']['attempt']/'fab-router';data={}
 for name in ['check.json','record.json','work/board.dsn','work/board.ses','work/dsn-manifest.json','work/router-summary.json']:
  raw=(folder/name).read_bytes();data[name]={'base64':base64.b64encode(raw).decode(),'sha256':hashlib.sha256(raw).hexdigest()}
 files[r['record']['attempt']]=data
fixture=Path('/home/hyper/bench/boards/dense/fab_pcb-case-dense6-bga324-j1')
fixture_files={}
for name in ['board.kicad_pcb','board.kicad_pro','board.kicad_dru','job.json','LICENSE','baseline-drc.json']:
 p=fixture/name
 if p.is_file():
  raw=p.read_bytes();fixture_files[p.name]={'sha256':hashlib.sha256(raw).hexdigest(),'base64':base64.b64encode(raw).decode()}
packed('dense-raw.json.gz',{'rows':rows,'controls':json.loads((d/'controls.json').read_text()),'files':files,'fixtureFiles':fixture_files})
(out/'dense-comparison.json').write_bytes((w/'dense-comparison.json').read_bytes())
ladder=[]
for case in ['l2','l3-cycle18']:
 pair={}
 for mode in ['original','candidate']:
  p=w/f'{case}-{mode}';pair[mode]={'ses':(p/'board.ses').read_text(),'result':json.loads((p/'result.json').read_text())}
 assert pair['original']['ses']==pair['candidate']['ses']
 for field in ['settings','stats']:assert pair['original']['result'][field]==pair['candidate']['result'][field]
 for mode in ['original','candidate']:
  r=pair[mode]['result']['report'];assert not r['timedOut']and not r['aborted']
  assert r['violationsAdded']==0
 inp=Path(f'/home/hyper/bench/boards/ladder/{case}.dsn').read_bytes()
 ladder.append({'case':case,'inputDsn':inp.decode(),'inputSha256':hashlib.sha256(inp).hexdigest(),'pair':pair})
packed('ladder-records.json.gz',ladder)
slow=json.loads((w/'slow.json').read_text());assert slow['complete']and slow['total']==63
packed('slow.json.gz',slow)
(out/'slow-comparison.json').write_bytes((w/'slow-comparison.json').read_bytes())
for name in ['stress-exits.json','dense.log','slow.log']:(out/(name+'.gz')).write_bytes(gzip.compress((w/name).read_bytes(),mtime=0))
assert not json.loads((w/'dense-comparison.json').read_text())['regressions']
assert [r['id']for r in json.loads((w/'slow-comparison.json').read_text())['adverse']]==['routing-slow-issue555-cnh-strict']
assert not json.loads((w/'target-summary.json').read_text())['adverse_pairs']
print('PASS packed dense3pairs, ladder2pairs and fresh63-case enabled slow sweep')
