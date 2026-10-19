"""Summarize completed evidence only; no implicit missing/failed row exclusions."""
import gzip,json,sys
from pathlib import Path
from statistics import median
folder=Path(sys.argv[1]);dest=Path(sys.argv[2]);assert not dest.exists()
read=lambda p:json.loads(gzip.decompress(p.read_bytes()))if p.suffix=='.gz'else json.loads(p.read_text())
rows=read(folder/'synthetic.json.gz')['rows'];assert len(rows)==36
lines=['# Disposable pour attachment experiment','','Recovery-only synthetic trials, three repeats per cell. Values are incomplete connections per trial; zero exact violations in every trial. No native score is inferred.','','| Fixture | Current | Vertex average | First vertex |','| --- | ---: | ---: | ---: |']
for name in ('solid','hole','concave','keepout'):
 values=[]
 for mode in ('baseline','centroid','vertex'):
  rs=[r for r in rows if r['mode']==mode and r['name']==name];assert len(rs)==3
  assert len({r['ses']for r in rs})==1 and all(r['violations']==0 for r in rs)
  assert len({r['incomplete']for r in rs})==1
  values.append(str(rs[0]['incomplete']))
 lines.append('| '+name+' | '+' | '.join(values)+' |')
native=read(folder/'native-comparison.json');assert len(native['attempts'])==78
lines+=['','Fresh full frozen suite on the same host and cores 12–19: 26 cases × 3 repeats per source; both use public recovery enabled. Known native errors remain unresolved. Timing is observed on a shared host with concurrent unit tests.','','| Metric | Current recovery | Disposable first vertex |','| --- | ---: | ---: |']
for key in native['summary']['before']:
 a=native['summary']['before'][key];b=native['summary']['after'][key]
 fmt=lambda x:str(x)if isinstance(x,int)else f'{x:.6f}'
 lines.append(f'| {key} | {fmt(a)} | {fmt(b)} |')
lines += ['',f"Identical sessions: {native['same_sessions']}/78. Regression records: {len(native['regressions'])}.",'','| Case | Current median / p95 s | Probe median / p95 s | Opens current / probe (3 runs) |','| --- | ---: | ---: | ---: |']
for case in sorted({r['case']for r in native['attempts']}):
 rs=[r for r in native['attempts']if r['case']==case];assert len(rs)==3
 timings=[]
 for mode in ('before','after'):
  ts=sorted(r[mode]['seconds']for r in rs);timings.append(f'{median(ts):.6f} / {ts[-1]:.6f}')
 opens=[sum(r[m]['opens']for r in rs)for m in ('before','after')]
 lines.append(f'| {case} | {timings[0]} | {timings[1]} | {opens[0]} / {opens[1]} |')
large=read(folder/'large.json.gz')['rows'];assert len(large)==6
lines+=['','Larger supplied DSNs: one exploratory pair/input, not a repeated timing study or native DRC score.','','| Input | Incomplete current / probe | Seconds current / probe | Vias current / probe | Length mm current / probe | Pours current / probe | Same session |','| --- | ---: | ---: | ---: | ---: | ---: | --- |']
for file in sorted({r['file']for r in large}):
 pair=[next(r for r in large if r['file']==file and r['mode']==m)for m in ('before','after')]
 assert pair[0]['settings']==pair[1]['settings'] and pair[0]['inputSha256']==pair[1]['inputSha256']
 assert all(r['report']['violationsAdded']==0 and r['stats']['violations']['total']==0 and not r['report']['timedOut'] for r in pair)
 value=lambda f:' / '.join(str(f(r))for r in pair)
 lines.append('| '+Path(file).name+' | '+value(lambda r:r['report']['incompleteAfter'])+' | '+value(lambda r:round(r['seconds'],6))+' | '+value(lambda r:r['stats']['barrels']['total'])+' | '+value(lambda r:round(r['stats']['tracks']['totalLengthMm'],6))+' | '+value(lambda r:r['stats']['items']['pours'])+' | '+str(pair[0]['sesSha256']==pair[1]['sesSha256'])+' |')
dense=read(folder/'dense-comparison.json')
lines+=['','Prepared Dense6 native case: three repeats/source, separate from supplied DSN.','','| Metric | Current | Probe |','| --- | --- | --- |']
for key in dense['summary']['before']:
 lines.append(f"| {key} | {dense['summary']['before'][key]} | {dense['summary']['after'][key]} |")
lines+=['',f"Dense native regression records: {len(dense['regressions'])}."]
dest.write_text('\n'.join(lines)+'\n')
