"""Independent arithmetic replay of every archived deletion trial (no native calls)."""
import argparse,collections,json,pathlib
p=argparse.ArgumentParser(description=__doc__);p.add_argument('archive',type=pathlib.Path);x=p.parse_args();root=x.archive/'minimized'
if not root.exists():root=x.archive
rows=json.loads((root/'results.json').read_text());s=json.loads((root/'summary.json').read_text());source=json.loads((root/'source/groups.json').read_text());checks={}
choose=lambda n:n*(n-1)//2
for row in rows:
 d=root/row['name'];groups=json.loads((d/'groups.json').read_text());membership={v:i for i,g in enumerate(groups) for v in g}
 assert set(membership)=={v for g in source for v in g}
 lost=sum(choose(len(g))-sum(choose(v) for v in collections.Counter(membership[p] for p in g).values()) for g in source)
 report=json.loads((d/'drc.json').read_text());assert report['kicad_version']=='10.0.6'
 assert lost==row['lost_pairs'] and len(report['unconnected_items'])==row['opens']
 assert [v['type'] for v in report['violations'] if v['severity']=='error']==row['errors']
 checks[tuple(row['indices'])]=lost
selected=s['indices'];assert len(selected)==4 and s['one_minimal'] and checks[tuple(selected)]==17
assert all(checks[tuple(i for i in selected if i!=remove)]==0 for remove in selected)
assert all(row['lost_pairs']==17 and row['opens']==16 and row['errors']==[] for row in rows if row['name'].startswith('final-'))
assert len([r for r in rows if r['name'].startswith('final-')])==3
print(f'PASS: {len(rows)} saved native checks; four individually essential tracks; all 17 lost pairs reproduced three times')
