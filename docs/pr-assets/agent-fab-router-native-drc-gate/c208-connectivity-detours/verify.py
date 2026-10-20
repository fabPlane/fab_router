"""Independent replay of retained native reports/partitions, not new DRC."""
import collections, copy, gzip, importlib.util, json, pathlib, sys
r=pathlib.Path(sys.argv[1]);spec=importlib.util.spec_from_file_location('sx',r/'runtime/tools/native-thermal-proposals.py');sx=importlib.util.module_from_spec(spec);sys.modules['sx']=sx;spec.loader.exec_module(sx)
f=r/'runtime/test/fixtures/native-aquarius-thermal';source=sx.parse(gzip.decompress((f/'input.kicad_pcb.gz').read_bytes()).decode());tracks=[sx.parse(s) for s in (f/'connectivity-added.sexpr').read_text().splitlines()]
def groups(d):
 gs=json.loads((d/'groups.json').read_text());m={v:i for i,g in enumerate(gs) for v in g};assert len(m)==sum(map(len,gs));return gs,m
def inventory(nodes):
 return collections.Counter(sx.segment_geometry(n) for n in nodes if isinstance(n,list) and n[0]=='segment')
def lost(reference,m):return sum(m[a]!=m[b] for g in reference for i,a in enumerate(g) for b in g[i+1:])
for name,count in [('results',20),('recheck',9)]:
 out=r/name;rows=json.loads((out/'summary.json').read_text());assert len(rows)==count
 base,_=groups(out/rows[0]['name']);routed,_=groups(out/rows[1]['name'])
 for row in rows:
  d=out/row['name'];gs,m=groups(d);report=json.loads((d/'drc.json').read_text());assert set(m)=={v for g in base for v in g}
  assert row['opens']==len(report['unconnected_items'])
  assert row['errors']==[v['type'] for v in report['violations'] if v['severity']=='error']
  assert row['lost_source_pairs']==lost(base,m)
  assert row['lost_routed_pairs']==(lost(routed,m) if row is not rows[0] else 0)
  label=row['name']
  if label.startswith('source'):nodes=source
  elif label.startswith('reduced'):nodes=source+tracks
  else:
   ti,pi=map(int,(label.split('-')[1],label.split('-')[3])) if label.startswith('track') else (0,0)
   nodes=sx.parse(list(sx.proposals(source+tracks,sx.uid(tracks[ti])))[pi].decode())
  # Native refill reassigns the three detour segments on exactly these
  # cases. Audit the ownership change explicitly; never normalize it away.
  submitted=copy.deepcopy(nodes)
  changed=(name=='recheck' and label.startswith('detour')) or label in ['track-0-path-0','track-0-path-2','track-0-path-4','track-1-path-2','track-1-path-4']
  if changed:
   detour_ids={sx.uid(n) for n in nodes if isinstance(n,list) and n[0]=='segment'}-{sx.uid(n) for n in source+tracks if isinstance(n,list) and n[0]=='segment'}
   assert len(detour_ids)==3
   for n in nodes:
    if isinstance(n,list) and n[0]=='segment' and sx.uid(n) in detour_ids:sx.child(n,'net')[1] = '\"Net-(R1-Pad1)\"'
  actual=sx.parse((d/'board.kicad_pcb').read_text());assert inventory(actual)==inventory(nodes),label
  assert sum((inventory(actual)-inventory(submitted)).values())==(3 if changed else 0)
  (d/'submitted-reconstructed.kicad_pcb').write_text(sx.dump(submitted)+'\n')
  for ext in ('.kicad_pro','.kicad_dru'):assert (d/('board'+ext)).read_bytes()==(f/('board'+ext)).read_bytes()
  if name=='recheck':
   expect={'source':(110,[],0),'reduced':(114,['starved_thermal'],61),'detour':(112,[],0)}[label.split('-')[0]]
   assert (row['opens'],row['errors'],row['lost_source_pairs'])==expect
   assert row['lost_routed_pairs']==0
 if name=='results':
  clean=[x['name'] for x in rows[2:] if not x['errors'] and not x['lost_source_pairs']]
  assert clean==['track-0-path-0','track-0-path-2','track-0-path-4']
  assert all(x['opens']>110 for x in rows[2:]);assert all(not x['lost_routed_pairs'] for x in rows[2:])
 print(name,count,'reports, exact geometry, EXPLICIT native net reassignments, rules and pairs: PASS')
print('No detour meets source open budget; no routing/scored gain claimed: PASS')

control=json.loads((r/'load-control.json').read_text())
ids={sx.uid(n) for n in sx.parse(next(sx.proposals(source+tracks,sx.uid(tracks[0]))).decode()) if isinstance(n,list) and n[0]=='segment'}-{sx.uid(n) for n in source+tracks if isinstance(n,list) and n[0]=='segment'}
assert len(ids)==3
assert [x['stage'] for x in control]==['load','connectivity-build','save']
for stage in control:
 assert [x['net'] for x in stage['tracks'] if x['uuid'] in ids]==['Net-(R1-Pad1)']*3
print('load-only control: reassignment precedes explicit build/refill/DRC/save: PASS')
