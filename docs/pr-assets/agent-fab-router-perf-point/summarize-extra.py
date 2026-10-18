"""Check complete fixed-pass and profile evidence, retaining adverse timing results."""
from pathlib import Path
import json,hashlib,collections,statistics,argparse
p=argparse.ArgumentParser(description=__doc__);p.add_argument('scratch',type=Path);args=p.parse_args()
a=Path(__file__).resolve().parent
sources=json.loads((a/'source-provenance.json').read_text())
rows=json.loads((a/'ladder.json').read_text());assert len(rows)==12
summary={'ladder':{},'profiles':{}}
for file in ['l1.dsn','l2.dsn']:
 rs=[r for r in rows if r['file']==file];assert len(rs)==6
 assert len({r['ses_sha256'] for r in rs})==1
 assert {r['input_sha256'] for r in rs}=={hashlib.sha256((a/file).read_bytes()).hexdigest()}
 assert all(not r['report']['timedOut'] and not r['report']['aborted'] for r in rs)
 summary['ladder'][file]={v:{'median_seconds':statistics.median(r['seconds'] for r in rs if r['version']==v),'incomplete':sorted({r['report']['incompleteAfter'] for r in rs if r['version']==v}),'violations_added':sorted({r['report']['violationsAdded'] for r in rs if r['version']==v})} for v in ['before','after']}
sessions=[];inputs=[];settings=[]
for v in ['before','after']:
 records=[];counts=collections.Counter();total=0;raw=[]
 for repeat in range(1,4):
  log=args.scratch/f'cycle13-profile-{v}-{repeat}.log'
  rs=[json.loads(s) for s in log.read_text().splitlines() if s.startswith('{')];assert len(rs)==1
  row=rs[0];records.append(row);sessions.append(row['ses_sha256']);inputs.append(row['input_sha256']);settings.append(row['settings'])
  assert row['clear_sha256']==sources[v]['sha256']['src/route/clear.ts']
  assert row['distance_sha256']==sources[v]['sha256']['src/geom/distance.ts']
  assert not row['report']['timedOut'] and not row['report']['aborted']
  files=list((args.scratch/f'cycle13-profile-{v}-{repeat}').glob('*.cpuprofile'));assert len(files)==1
  profile=json.loads(files[0].read_text());sample=collections.Counter(profile['samples']);total+=len(profile['samples'])
  for node in profile['nodes']:
   frame=node['callFrame'];counts[(frame['functionName'],frame.get('url',''))]+=sample[node['id']]
  raw.append({'file':files[0].name,'sha256':hashlib.sha256(files[0].read_bytes()).hexdigest()})
 summary['profiles'][v]={'median_seconds':statistics.median(r['seconds'] for r in records),'rows':records,'profiles':raw,'samples':total,'geometry_self':{name:sum(n for (function,url),n in counts.items() if function==name) for name in ['coreOf','closerConvex','dist2Pts','dist2SegSeg','dist2PtSeg','dist2PtPt']},'top_self':[{'function':k[0],'url':k[1],'samples':n} for k,n in counts.most_common(40)]}
assert len(set(sessions))==len(set(inputs))==1 and all(s==settings[0] for s in settings)
native=json.loads((a/'native-measurements.json').read_text())['attempts']
paperino={r['ses_sha256'] for r in native if r['case']=='paperino-hw-paperino-shield-j4'}
assert set(sessions)<=paperino,'profile sessions differ from native Paperino sessions'
(a/'extra-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({k:{v:({x:y for x,y in d.items() if x in ['median_seconds','samples']} if k=='profiles' else d) for v,d in val.items()} for k,val in summary.items()},indent=2))
