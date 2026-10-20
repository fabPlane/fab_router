"""Replay report and terminal partitions without rerunning native DRC."""
import json,pathlib,sys,hashlib
root=pathlib.Path(sys.argv[1]);before=json.loads((root/'source/groups.json').read_text());routed=json.loads((root/'before/groups.json').read_text())
def lost(original,groups):
 members={v:i for i,g in enumerate(groups) for v in g}
 assert set(members)=={v for g in original for v in g}
 return sum(members[a]!=members[b] for g in original for i,a in enumerate(g) for b in g[i+1:])
rows=[]
for directory in sorted(root.iterdir()):
 if not directory.is_dir() or not (directory/'groups.json').exists():continue
 groups=json.loads((directory/'groups.json').read_text());report=json.loads((directory/'drc.json').read_text())
 rows.append(dict(name=directory.name,opens=len(report['unconnected_items']),errors=[v['type'] for v in report['violations'] if v['severity']=='error'],lostSource=lost(before,groups),lostRouted=lost(routed,groups)))
assert len(rows)==32,len(rows)
byname={r['name']:r for r in rows}
assert byname['before']['lostSource']==61 and byname['before']['opens']==94
for d in ['via-pair-0.1','via-pair-0.2','via-pair-0.3','via-pair-0.5','upper-via-0.1','upper-via-0.15']:
 assert byname[d]['lostSource']==0 and byname[d]['lostRouted']==0 and byname[d]['opens']==93
 assert byname[d]['errors']==['starved_thermal']*2
checks=json.loads((root/'recheck-normalized-results.json').read_text());assert len(checks)==6
for row in checks:
 assert row['ownership']==[True]*3 and row['lostRouted']==0 and not row['accepted'] and row['repairAccepted']
 assert row['errors']==['starved_thermal']*2
 assert row['lostSource']==(61 if row['name']=='routed' else 0)
 assert row['opens']==(94 if row['name']=='routed' else 93)
initial=json.loads((root/'recheck-results.json').read_text());assert len(initial)==6
for row in initial:
 assert row['ownership']==([True]*3 if row['name']=='routed' else [True,False,True])
full=json.loads((root/'full-recheck/recheck-normalized-results.json').read_text());assert len(full)==6
for row in full:
 assert row['ownership']==[True]*3 and row['lostRouted']==0 and not row['accepted']
 assert row['repairAccepted']==(row['name']=='routed')
 assert row['errors']==['starved_thermal']*6+([] if row['name']=='routed' else ['clearance']*3)
 assert row['lostSource']==(348 if row['name']=='routed' else 292)
 assert row['opens']==(15 if row['name']=='routed' else 14)
up=json.loads((root/'upper-up/recheck-normalized-results.json').read_text());assert len(up)==2
for row in up:
 assert row['ownership']==[True]*3 and row['lostRouted']==0 and row['lostSource']==348 and row['opens']==15
 assert row['errors']==['starved_thermal']*6 and not row['accepted'] and row['repairAccepted']
replay=json.loads((root/'fresh-reproduction/recheck-normalized-results.json').read_text());assert replay==checks
print(json.dumps(dict(targetedUpwardDecisions=up,fullBoardDecisions=full,discovery=rows,pairedDecisions=checks,initialFloatingPointCandidatesRejected=True,productionFix=False,routerRerun=False),indent=2))
