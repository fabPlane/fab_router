"""Verify archived predicate and complete-engine controls; emit observational timing."""
from pathlib import Path
import json,gzip,statistics,copy,hashlib
A=Path(__file__).resolve().parent

def structural(value):
 if isinstance(value,dict):return {k:structural(v) for k,v in value.items() if k!='seconds'}
 if isinstance(value,list):return [structural(v) for v in value]
 return value

def logs(rows):
 return [structural(json.loads(s[s.index('{'):])) if '{' in s else s for s in rows]

def verify(probe,replays,reference):
 assert probe['vertices']==92 and probe['checked']==630816
 assert len(probe['rows'])==12 and len({r['checksum'] for r in probe['rows']})==1
 rows=replays['rows'];assert len(rows)==6
 assert {(x['mode'],x['repeat']) for x in rows}=={(m,i) for m in ['original','candidate'] for i in range(3)}
 for x in rows:
  for f in ['inputSha256','settings','sesSha256','stats']:assert x[f]==reference[f],f
  report=x['report'].copy();report.pop('wallClockMs',None)
  expected=reference['report'].copy();expected.pop('wallClockMs',None)
  assert report==expected,'report'
  assert logs(x['logs'])==logs(rows[0]['logs']),'logs'
 assert probe['inputSha256']==reference['inputSha256']
 def times(data):
  return {m:{'median':statistics.median(t:=[x['seconds'] for x in data if x['mode']==m]),'max':max(t),'repeats':len(t)} for m in ['original','candidate']}
 return {'predicate':times([x for x in probe['rows'] if x['repeat']>=0]),'engine':times(rows),'parity':'all six match archived production control; native not rerun'}

if __name__=='__main__':
 probe=json.loads((A/'results.json').read_text());replays=json.loads(gzip.decompress((A/'replays.json.gz').read_bytes()));ref=json.loads(gzip.decompress((A/'../native-profile/replay.json.gz').read_bytes()))
 summary=verify(probe,replays,ref)
 session=gzip.decompress((A/'board.ses.gz').read_bytes())
 assert hashlib.sha256(session).hexdigest()==ref['sesSha256']
 audit=json.loads(gzip.decompress((A/'source-audit.json.gz').read_bytes()))
 assert audit['original'].keys()==audit['candidate'].keys()
 assert [p for p in audit['original'] if audit['original'][p]!=audit['candidate'][p]]==['src/geom/predicates.ts']
 for name,digest in audit['original'].items():assert hashlib.sha256((A.parents[3]/name).read_bytes()).hexdigest()==digest,name
 source=(A.parents[3]/'src/geom/predicates.ts').read_text()
 needle='    const a = pts[j]!, b = pts[i]!;\n    if (onSeg(p, a, b))'
 assert source.count(needle)==1
 candidate=source.replace(needle,'    const a = pts[j]!, b = pts[i]!;\n    if (p.y < Math.min(a.y, b.y) || p.y > Math.max(a.y, b.y)) continue;\n    if (onSeg(p, a, b))')
 assert hashlib.sha256(candidate.encode()).hexdigest()==audit['candidate']['src/geom/predicates.ts']
 # Cross-check independent historical control, then test every gate with one corrupted repeat.
 for field in ['sesSha256','stats','settings','report','logs']:
  bad=copy.deepcopy(replays)
  if field=='report':bad['rows'][1][field]['corrupt']=True
  elif field=='logs':bad['rows'][1][field].append('corrupt')
  else:bad['rows'][1][field]=None
  try:verify(probe,bad,ref)
  except AssertionError:pass
  else:raise AssertionError('corruption accepted: '+field)
 print(json.dumps(summary,indent=2))
