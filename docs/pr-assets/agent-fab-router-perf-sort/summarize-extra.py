"""Validate census, fixed-pass ladder and separate-process CPU profile evidence."""
import argparse,hashlib,json,subprocess
from pathlib import Path
from statistics import median
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('scratch',type=Path)
p.add_argument('--out',type=Path,required=True)
a=p.parse_args(); s=a.scratch; out=a.out
sha=lambda b:hashlib.sha256(b).hexdigest()
native=json.loads((out/'native-measurements.json').read_text())
commits={v:next(iter(native['controls'][v].values()))['commit'] for v in ['before','after']}
repo=Path(__file__).resolve().parents[3]
source={v:{'commit':commit,'files':{}} for v,commit in commits.items()}
for v,commit in commits.items():
 paths=subprocess.check_output(['git','-C',str(repo),'ls-tree','-r','--name-only','-z',commit,'src','spec','tools','test']).decode().split('\0')
 for path in filter(None,paths):
  source[v]['files'][path]=sha(subprocess.check_output(['git','-C',str(repo),'show',f'{commit}:{path}']))
profiles={}
for v in ['before','after']:
 rows=[]; frames={}; ticks={}; total=0
 for n in range(1,4):
  log=s/f'cycle15-profile-{v}-{n}.log'
  row=json.loads(log.read_text().strip()); assert not row['report']['timedOut'] and not row['report']['aborted']
  assert row['grid_sha256']==source[v]['files']['src/lattice/grid.ts']
  matching=[x for x in native['attempts'] if x['case']=='paperino-hw-paperino-shield-j4' and x['version']==v]
  assert all(x['ses_sha256']==row['ses_sha256'] for x in matching)
  work=next((s/'cycle15-paired'/v/'paperino-hw-paperino-shield-j4/runs').glob('*/fab-router/work'))
  assert sha((work/'board.dsn').read_bytes())==row['input_sha256']
  manifest=json.loads((work/'dsn-manifest.json').read_text()); candidate=json.loads((work/'candidate-settings.json').read_text())
  expected={'timeBudgetMs':120000,'maxPasses':100,'seed':2,'copperToEdgeClearanceUm':manifest['native_rules']['min_copper_edge_clearance']*1000,'holeClearanceUm':manifest['native_rules']['min_hole_clearance']*1000,'strictDrc':True,'neckWidthUm':0,'fanoutEnabled':False,'ignoreNetGroups':manifest['ignore_classes'],**candidate['settings']}
  assert row['settings']==expected
  files=list((s/f'cycle15-profile-{v}-{n}').glob('*.cpuprofile')); assert len(files)==1
  raw=files[0].read_bytes(); profile=json.loads(raw); nodes={x['id']:x for x in profile['nodes']}
  total+=len(profile['samples'])
  for sample in profile['samples']:
   frame=nodes[sample]['callFrame']; url=frame['url']; short=url.split('/src/')[-1] if '/src/' in url else url
   key=f"{short}:{frame['lineNumber']+1}:{frame['functionName']}"; frames[key]=frames.get(key,0)+1
  for node in profile['nodes']:
   frame=node['callFrame']; url=frame['url']; short=url.split('/src/')[-1] if '/src/' in url else url
   for tick in node.get('positionTicks',[]):
    key=f"{short}:{tick['line']}"; ticks[key]=ticks.get(key,0)+tick['ticks']
  rows.append({**row,'profile_sha256':sha(raw),'log_sha256':sha(log.read_bytes())})
 profiles[v]={'rows':rows,'median_seconds':median(x['seconds'] for x in rows),'samples':total,'self_frames':dict(sorted(frames.items(),key=lambda x:-x[1])[:50]),'line_ticks':dict(sorted(ticks.items(),key=lambda x:-x[1])[:50])}
ladder=json.loads((out/'ladder.json').read_text()); assert len(ladder)==12
for file in ['l1.dsn','l2.dsn']:
 rows=[x for x in ladder if x['file']==file]; assert len(rows)==6
 assert len({x['ses_sha256'] for x in rows})==1
 for row in rows:
  assert not row['report']['timedOut'] and not row['report']['aborted']
  assert row['grid_sha256']==source[row['version']]['files']['src/lattice/grid.ts']
  assert row['input_sha256']==sha((out/file).read_bytes())
  assert row['settings']=={'timeBudgetMs':600000,'maxPasses':2,'seed':1}
census_lines=(s/'cycle15-census.log').read_text().splitlines(); assert len(census_lines)==2
route=json.loads(census_lines[0]); census=json.loads(census_lines[1])['census']
assert route['ses_sha256']==profiles['before']['rows'][0]['ses_sha256']
assert route['input_sha256']==profiles['before']['rows'][0]['input_sha256']
assert route['settings']==profiles['before']['rows'][0]['settings']
assert not route['report']['timedOut'] and not route['report']['aborted']
assert census['queries']==sum(census['box'])+sum(census['sweep'])+census['missingSheet']
census_source=json.loads((s/'cycle15-census-source/census-source.json').read_text())
assert census_source['instrumented_grid_sha256']==route['grid_sha256']
assert census_source['generator_sha256']==sha((Path(__file__).parent/'query-census.py').read_bytes())
assert census_source['archive_sha256']==sha(subprocess.check_output(['git','-C',str(repo),'archive','69cf598','src','spec']))
trivial=sum(census[k][0]+census[k][1] for k in ['box','sweep'])
result={'profiles':profiles,'census':census,'census_source':census_source,'census_route':route,'trivial_sorts':trivial,'trivial_sort_fraction_excluding_missing_sheets':trivial/(census['queries']-census['missingSheet']),'caveat':'Census is instrumented diagnostic only. CPU samples/line ticks move with inlining. No heap/GC measurements. Last histogram bin means 33 or more.'}
(out/'source-provenance.json').write_text(json.dumps(source,indent=2)+'\n')
(out/'extra-summary.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({v:{k:profiles[v][k] for k in ['median_seconds','samples']} for v in profiles},indent=2))
print('census',census['queries'],'queries;',trivial,'trivial sorts;',result['trivial_sort_fraction_excluding_missing_sheets'])
