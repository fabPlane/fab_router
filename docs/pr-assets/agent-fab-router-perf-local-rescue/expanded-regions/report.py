"""Validate complete paired residual traces and render their charged work."""
import collections,hashlib,html,json,statistics,sys
from pathlib import Path
raw,out=map(Path,sys.argv[1:]);rows=json.loads(raw.read_text())['rows']
tested=[r for r in rows if 'result'in r]
groups=collections.defaultdict(list)
for r in tested:
 key=(r['case'],r['target']['net'],r['target']['from'],r['target']['to'])
 groups[key].append(r)
 assert r['exact']==0 and r['beforeOpen']==r['afterOpen'] and r['rollbackUnchanged']
 assert r['beforeSha256']==r['afterSha256']
 assert r['result']['expansions']<=100000
for group in groups.values():
 assert collections.Counter((r['mode'],r['repeat'])for r in group)==collections.Counter((m,n)for m in ['before','after']for n in range(1,4))
 assert len({(r['dsnSha256'],r['inputSesSha256'],r['beforeSha256'])for r in group})==1
 for mode in ['before','after']:
  same=[r for r in group if r['mode']==mode]
  assert len({json.dumps((r['result'],r['proposals']),sort_keys=True)for r in same})==1
summary={'scope':'Static residual probes, not new full routes or native checks','rawSha256':hashlib.sha256(raw.read_bytes()).hexdigest(),'targets':len(groups),'cases':len({r['case']for r in tested}),'skipped':[r for r in rows if 'skipped'in r],'modes':{}}
for mode in ['before','after']:
 rs=[r for r in tested if r['mode']==mode];times=sorted(r['seconds']for r in rs)
 summary['modes'][mode]={'runs':len(rs),'closures':sum(r['beforeOpen']-r['afterOpen']for r in rs),'statuses':dict(collections.Counter(r['result']['status']for r in rs)),'exactViolations':sum(r['exact']for r in rs),'unchangedSessions':sum(r['beforeSha256']==r['afterSha256']for r in rs),'medianSeconds':statistics.median(times),'p95Seconds':times[__import__('math').ceil(len(times)*.95)-1],'totalSeconds':sum(times),'totalWork':sum(r['result']['expansions']for r in rs),'largestAttemptedMargin':dict(collections.Counter(str(max(t['margin']for t in r['result']['trials']))for r in rs))}
(out/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
table=['| Case / original target | Original median / p95 s | Extended median / p95 s | Work before / after | Closures before / after |','| --- | ---: | ---: | ---: | ---: |']
for key,rs in groups.items():
 parts=[];work=[]
 for mode in ['before','after']:
  same=[r for r in rs if r['mode']==mode];times=[r['seconds']for r in same]
  parts.append(f'{statistics.median(times):.6f} / {max(times):.6f}');work.append(str(same[0]['result']['expansions']))
 table.append(f'| {key[0]} {key[1]}:{key[2]}→{key[3]} | {parts[0]} | {parts[1]} | {work[0]} / {work[1]} | 0 / 0 |')
(out/'cases.md').write_text('Three repeats per mode and target on the same host/cores; p95 is the maximum of three. Timing is descriptive under shared load. Work and traces are identical across repeats.\n\n'+'\n'.join(table)+'\n')
height=110+len(groups)*34
svg=[f'<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="{height}" viewBox="0 0 1200 {height}"><rect width="1200" height="{height}" fill="white"/><g font-family="sans-serif" fill="#162238"><text x="25" y="28" font-size="20">Larger local regions: no additional closure</text><text x="25" y="53" font-size="14">Charged work per target, identical across 3 repeats; 100,000 shared limit</text><text x="660" y="76" fill="#2563eb">Original regions</text><text x="845" y="76" fill="#c2410c">Extended regions</text>']
for i,(key,rs)in enumerate(groups.items()):
 y=100+i*34;label=f'{key[0]}  {key[1]}:{key[2]}→{key[3]}'
 svg.append(f'<text x="25" y="{y+9}" font-size="11">{html.escape(label)}</text>')
 for mode,offset,color in [('before',0,'#2563eb'),('after',12,'#c2410c')]:
  n=next(r['result']['expansions']for r in rs if r['mode']==mode)
  svg.append(f'<rect x="610" y="{y+offset}" width="{n/200}" height="10" fill="{color}"/>')
svg.append('</g></svg>');(out/'work.svg').write_text(''.join(svg)+'\n')
print(json.dumps(summary,indent=2))
