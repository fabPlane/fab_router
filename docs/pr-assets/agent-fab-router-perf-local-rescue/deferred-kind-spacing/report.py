"""Validate paired traces, original attempt prefixes and shared work accounting."""
import gzip,json,statistics,sys
from pathlib import Path

def stable(x):
 if isinstance(x,dict):return {k:stable(v) for k,v in x.items() if k!='seconds'}
 if isinstance(x,list):return [stable(v) for v in x]
 return x

def validate(d):
 assert set(d)=={'before','after'}
 for mode in d:
  assert len(d[mode])==3
  assert all(stable(x)==stable(d[mode][0]) for x in d[mode])
 for old,new in zip(d['before'],d['after']):
  assert len(old['rows'])==len(new['rows'])==1
  a,b=old['rows'][0],new['rows'][0]
  for k in ['case','dsnSha256','inputSesSha256','copperBefore','copperAfter','before','after','changed','finalSesSha256','rewind']:assert a[k]==b[k],k
  assert a['before']==a['after']==4 and not a['changed'] and a['rewind']
  assert len(a['attempts'])==len(b['attempts'])==4
  for i,(x,y) in enumerate(zip(a['attempts'],b['attempts'])):
   assert x['target']==y['target'] and x['sessionSha256']==y['sessionSha256']
   for v in [x,y]:
    assert v['exact']==0 and v['remainingBefore']==v['remainingAfter']==4
    r=v['result'];assert r['work']==r['enumeration']+sum(t['result']['expansions'] for t in r['attempts'])<=100000
   p,q=x['result'],y['result'];assert p['status']=='exhausted'
   assert q['status']==('exhausted' if i==0 else 'budget')
   assert p['enumeration']==q['enumeration']
   assert q['attempts'][:len(p['attempts'])]==p['attempts']
   assert len(q['attempts'])>len(p['attempts'])
 assert [x['result']['work'] for x in d['before'][0]['rows'][0]['attempts']]==[17747,83159,90626,88414]
 assert [x['result']['work'] for x in d['after'][0]['rows'][0]['attempts']]==[35520,100000,100000,100000]
 return True

if __name__=='__main__':
 d=json.loads(gzip.decompress(Path(sys.argv[1]).read_bytes()));validate(d)
 out=Path(sys.argv[2]);out.mkdir(exist_ok=True,parents=True)
 summary={}
 for m,runs in d.items():
  times=[sum(t['result']['seconds'] for t in r['rows'][0]['attempts']) for r in runs]
  summary[m]={'work':sum(t['result']['work'] for t in runs[0]['rows'][0]['attempts']),'engineResidual':4,'medianSeconds':statistics.median(times),'p95Seconds':max(times)}
 (out/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
 lines=['| Target net | Original work | Deferred work | Original / deferred status |','|---|---:|---:|---|']
 for a,b in zip(d['before'][0]['rows'][0]['attempts'],d['after'][0]['rows'][0]['attempts']):
  lines.append(f"| {a['target']['net']} | {a['result']['work']} | {b['result']['work']} | {a['result']['status']} / {b['result']['status']} |")
 (out/'cases.md').write_text('\n'.join(lines)+'\n')
 svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="300"><rect width="1000" height="300" fill="white"/><text x="30" y="35" font-size="24">Rejected deferred search: four residuals remain</text>']
 for i,m in enumerate(['before','after']):
  y=90+i*90;w=summary[m]['work']/500
  svg.append(f'<text x="30" y="{y+20}" font-size="20">{m}</text><rect x="130" y="{y}" width="{w}" height="35" fill="{["#3574a5","#b65c38"][i]}"/><text x="{140+w}" y="{y+24}" font-size="20">{summary[m]["work"]}</text>')
 svg.append('<text x="30" y="280" font-size="18">Charged work, four saved targets; not native benchmark scores</text></svg>')
 (out/'work.svg').write_text('\n'.join(svg)+'\n')
 print(json.dumps(summary))
