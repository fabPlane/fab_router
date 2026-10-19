"""Summarize completed, retained evidence. Incomplete inputs fail closed."""
import gzip,json,sys
from pathlib import Path
from statistics import median
folder,dest=map(Path,sys.argv[1:]);assert not dest.exists()
def read(name):
 p=folder/name
 return json.loads(gzip.decompress(p.read_bytes()))if p.suffix=='.gz'else json.loads(p.read_text())
rows=read('synthetic-v2.json.gz')['rows'];assert len(rows)==81
v1=read('synthetic-v1.json.gz')['rows'];assert len(v1)==81
assert {(r['mode'],r['name'],r['repeat']):r['ses']for r in rows}=={(r['mode'],r['name'],r['repeat']):r['ses']for r in v1}
lines=['# Multiple-witness experiment results','','Production pour recovery remains unsupported; default off. No engine or consumer pin change. No speed claim.','','## Synthetic recovery-only trials','','Nine fixtures × three repeats/source, same host and cores. Each cell is opens per trial, identical on all three repeats. All 81 v2-matrix trials have zero exact violations, deterministic sessions and preserved pads/pours/keepouts. Every failed closure rolls back exactly. V1 produces identical synthetic sessions. This is not a native score.','','| Fixture | Current | Nearest only | Multiple witnesses |','| --- | ---: | ---: | ---: |']
for name in dict.fromkeys(r['name']for r in rows):
 values=[]
 for mode in ('baseline','nearest','witness'):
  rs=[r for r in rows if r['name']==name and r['mode']==mode];assert len(rs)==3
  assert len({r['ses']for r in rs})==1 and all(r['violations']==0 for r in rs)
  assert len({r['incomplete']for r in rs})==1;values.append(str(rs[0]['incomplete']))
 lines.append('| '+name+' | '+' | '.join(values)+' |')
lines+=['','Current closes 0/27, nearest-only 18/27, multiple-witness 21/27. Six intentionally blocked/disjoint-sheet trials remain open. The earlier completed seven-fixture baseline/witness batch contains 42 further fresh trials; all overlap sessions match. The intermediate nine-fixture batches contain 81 trials/source and use an absent-layer diagnostic in place of the final physical two-layer disjoint-sheet control. All overlapping sessions match. Total completed synthetic evaluations: 42 + 81 + 81 + 81 + 81 = 366. A prior invalid-fixture batch was stopped and is not a completed benchmark.','','## Full frozen native suite','','26 cases × three repeats/source, all recovery enabled. Same machine, cores 12–19, case order, real rules, runtime and checker; order current → v1 → v2. Heavy tests/stress jobs overlap; times are observations, not attributed speed differences. The 27 known native thermal errors remain unresolved.','','| Metric | Current | V1 | V2 |','| --- | ---: | ---: | ---: |']
n1,n2=read('native-v1-comparison.json'),read('native-v2-comparison.json');assert len(n1['attempts'])==len(n2['attempts'])==78
assert n1['summary']['before']==n2['summary']['before']
summaries=[n1['summary']['before'],n1['summary']['after'],n2['summary']['after']]
for key in summaries[0]:
 fmt=lambda x:str(x)if isinstance(x,int)else f'{x:.6f}'
 lines.append('| '+key+' | '+' | '.join(fmt(s[key])for s in summaries)+' |')
valid=[]
for mode,n in [('before',n1),('after',n1),('after',n2)]:
 valid.append(sum(all(r[mode]['passed']for r in n['attempts']if r['case']==case)for case in {r['case']for r in n['attempts']}))
lines.append('| valid_cases_3of3 | '+' | '.join(map(str,valid))+' |')
for label,n in [('V1',n1),('V2',n2)]:
 lines.append(f"\n{label}: identical sessions {n['same_sessions']}/78; per-attempt regression records {len(n['regressions'])}. All regression records, including any negative result, are retained in the comparison JSON.")
lines+=['','Per-case p95 is the maximum of three samples. Opens/errors are sums over three attempts.','','| Case | Current median / p95 s | V1 median / p95 s | V2 median / p95 s | Opens current / v1 / v2 | Errors current / v1 / v2 |','| --- | ---: | ---: | ---: | ---: | ---: |']
for case in sorted({r['case']for r in n1['attempts']}):
 groups=[[r['before']for r in n1['attempts']if r['case']==case],[r['after']for r in n1['attempts']if r['case']==case],[r['after']for r in n2['attempts']if r['case']==case]]
 assert all(len(g)==3 for g in groups)
 timing=lambda g:f"{median(r['seconds']for r in g):.6f} / {max(r['seconds']for r in g):.6f}"
 total=lambda key:' / '.join(str(sum(r[key]for r in g))for g in groups)
 lines.append('| '+case+' | '+' | '.join(timing(g)for g in groups)+' | '+total('opens')+' | '+total('new_errors')+' |')
lines+=['','## Supplied larger inputs','','One exploratory pair per input/prototype, fixed two-pass/600-second budgets, strict DRC, optimiser/fanout disabled, no necking. Not native scores or three-repeat timing studies.','','| Source | Input | Opens current / probe | Seconds current / probe | Vias current / probe | Length mm current / probe | Pours | Same session |','| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |']
for label,name in [('V1','large-v1.json.gz'),('V2','large-v2.json.gz')]:
 large=read(name)['rows'];assert len(large)==6
 for file in dict.fromkeys(r['file']for r in large):
  a,b=[next(r for r in large if r['file']==file and r['mode']==m)for m in ('before','after')]
  assert a['inputSha256']==b['inputSha256']and a['settings']==b['settings']
  assert all(r['report']['violationsAdded']==r['stats']['violations']['total']==0 and not r['report']['timedOut']for r in (a,b))
  pair=lambda f:' / '.join(str(f(r))for r in (a,b))
  lines.append('| '+label+' | '+Path(file).name+' | '+pair(lambda r:r['report']['incompleteAfter'])+' | '+pair(lambda r:round(r['seconds'],6))+' | '+pair(lambda r:r['stats']['barrels']['total'])+' | '+pair(lambda r:round(r['stats']['tracks']['totalLengthMm'],6))+' | '+pair(lambda r:r['stats']['items']['pours'])+' | '+str(a['sesSha256']==b['sesSha256'])+' |')
trace=read('trace-comparison.json');assert trace['all_v2_targets_match']and trace['same_v2_ses']
lines+=['','L2 trace repeat: current 21 opens, v1 22, v2 21; all exact violations zero. V1 skips original zero-margin work and closes net 7 within its 100000-unit limit, changing later routability. V2 restores every one of the original 16 target traces (including expansions, trials and proposals) and the exact session. This rejects v1 and explains why ordinary point-anchor work is preserved.','','## Prepared Dense6 native case','','Three repeats/source, current versus v2, same fixed two-pass/600-second settings. Separate export from the supplied DSN above.','','| Metric | Current | V2 |','| --- | ---: | ---: |']
dense=read('dense-comparison.json')
for key in dense['summary']['before']:lines.append(f"| {key} | {dense['summary']['before'][key]} | {dense['summary']['after'][key]} |")
lines.append(f"\nNative Dense6 regression records: {len(dense['regressions'])}.")
dest.write_text('\n'.join(lines)+'\n')
