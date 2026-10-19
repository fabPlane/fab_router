"""Check isolated candidate parity against an independent archived control."""
from pathlib import Path
import ast,copy,gzip,hashlib,importlib.util,json,statistics,sys
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('prior',HERE.parent/'quilt-census/report.py');prior=importlib.util.module_from_spec(spec);spec.loader.exec_module(prior)
def check(records):
 assert len(records)==6
 for r in records:
  prior.parity.module.verify(r['result'],prior.parity.REFERENCE,r['ses'].encode(),prior.parity.DSN)
  assert prior.parity.logs(r['result']['logs'])==prior.parity.logs(prior.parity.CONTROL['logs'])
 assert [r['label'] for r in records]==['original','candidate']*3
 return {label:[r['result']['seconds'] for r in records if r['label']==label] for label in ('original','candidate')}
def source_check(audit,data):
 prior.source_check(audit,data)
 tree=ast.parse((HERE/'prepare.py').read_text())
 replacements=next(ast.literal_eval(n.value) for n in tree.body if isinstance(n,ast.Assign) and any(getattr(t,'id','')=='replacements' for t in n.targets))
 text=data.decode()
 for old,new in reversed(replacements):
  assert text.count(new)==1;text=text.replace(new,old)
 assert hashlib.sha256(text.encode()).hexdigest()==audit['src/route/quilt.ts']['original']
def emit(records,out):
 times=check(records);med={k:statistics.median(v) for k,v in times.items()}
 summary={'scope':'single complete-board alternating engine replay; no fresh native score','times':times,'median':med,'medianChangePercent':100*(med['candidate']/med['original']-1),'parity':True}
 (out/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
 (out/'table.md').write_text('| Replay | Original seconds | Candidate seconds | Change |\n|---|---:|---:|---:|\n'+''.join(f'| {i+1} | {a:.6f} | {b:.6f} | {100*(b/a-1):+.2f}% |\n' for i,(a,b) in enumerate(zip(times['original'],times['candidate'])))+f"| Median | {med['original']:.6f} | {med['candidate']:.6f} | {summary['medianChangePercent']:+.2f}% |\n")
 svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="440"><rect width="1200" height="440" fill="white"/><g font-family="sans-serif" fill="#172536"><text x="30" y="35" font-size="25">Bounded quilt front cache: complete-board timing</text><text x="30" y="65" font-size="17">Three alternating pairs; identical output; no fresh native DRC or suite score</text>']
 scale=800/max(v for vs in times.values() for v in vs)
 for i,(label,values) in enumerate(times.items()):
  for j,v in enumerate(values):
   y=95+j*100+i*36;w=v*scale
   svg.append(f'<text x="30" y="{y+23}">{label} {j+1}</text><rect x="150" y="{y}" width="{w:.3f}" height="28" fill="{("#327b9e" if i==0 else "#bb7642")}"/><text x="{160+w:.3f}" y="{y+22}">{v:.3f}s</text>')
 (out/'chart.svg').write_text('\n'.join(svg+['</g></svg>'])+'\n')
 return summary
if __name__=='__main__':
 work=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(exist_ok=True)
 records=[{'label':label,'result':json.loads((work/f'{label}{i}/result.json').read_text()),'ses':(work/f'{label}{i}/board.ses').read_text()} for i in (1,2,3) for label in ('original','candidate')]
 for field,value in [('ses','bad')]:
  bad=copy.deepcopy(records);bad[1][field]=value
  try:check(bad)
  except (AssertionError,ValueError):pass
  else:raise AssertionError('corrupt session accepted')
 controls=[]
 for name,mutate in [('statistics',lambda r:r[1]['result']['stats'].update(unrouted=-1)),('settings',lambda r:r[1]['result']['settings'].update(localRecovery=False)),('report',lambda r:r[1]['result']['report'].update(bad=True)),('recovery',lambda r:r[1]['result']['logs'].append('bad')),('order',lambda r:r.reverse())]:
  bad=copy.deepcopy(records);mutate(bad)
  try:check(bad)
  except (AssertionError,ValueError):controls.append(name)
  else:raise AssertionError(name)
 (out/'additional-controls.json').write_text(json.dumps({'rejected':controls},indent=2)+'\n')
 audit=json.loads((work/'work/source-audit.json').read_text());data=gzip.decompress((work/'work/quilt-candidate.ts.gz').read_bytes());source_check(audit,data)
 for bad in [data+b'\n',data.replace(b'return cached;',b'return "free";')]:
  altered=copy.deepcopy(audit);altered['src/route/quilt.ts']['observer']=hashlib.sha256(bad).hexdigest()
  try:source_check(altered,bad)
  except AssertionError:pass
  else:raise AssertionError('corrupt source accepted')
 emit(records,out)
 (out/'records.json.gz').write_bytes(gzip.compress(json.dumps(records).encode(),mtime=0))
 for name in ('source-audit.json','quilt-candidate.ts.gz'):(out/name).write_bytes((work/'work'/name).read_bytes())
 print((out/'table.md').read_text())
