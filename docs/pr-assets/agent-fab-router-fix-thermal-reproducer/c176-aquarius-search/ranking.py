"""Explain bounded discovery on the complete board; do not change ranking or route."""
import argparse,importlib.util,json
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--results',type=Path,required=True);p.add_argument('--out',type=Path,required=True);x=p.parse_args()
root=Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('complete',root/'c175-complete-search/complete.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
z=json.loads((x.results/'native/summary.json').read_text())
def source(role):
 matches=[digest for name,digest in z['source_sha256'].items() if role in name and name.endswith('.kicad_pcb')];assert len(matches)==1
 return m.native.parse((x.results/'native/sources'/matches[0]).read_text())
nodes=source('/source/');ids={m.native.uid(n) for n in source('/input/') if isinstance(n,list)}
tracks={m.native.uid(n):n for n in nodes if isinstance(n,list) and n[0]=='segment'}
zones={m.native.uid(n):m.native.child(n,'layer')[1].strip('"') for n in nodes if isinstance(n,list) and n[0]=='zone'}
pads={m.native.uid(c) for n in nodes if isinstance(n,list) and n[0]=='footprint' for c in n if isinstance(c,list) and c[0]=='pad'}
errors=z['rows'][0]['baseline']['errors']
markers=[dict(pad=i['uuid'],position=i['pos'],layers=sorted({zones[j['uuid']] for j in e['items'] if j['uuid'] in zones})) for e in errors if e['type']=='starved_thermal' for i in e['items'] if i['uuid'] in pads]
ranked=m.single.rank_segments(nodes,ids,errors,8)
rows=[]
for uid in ranked:
 t=tracks[uid];a,b=[tuple(map(float,m.native.child(t,k)[1:])) for k in ('start','end')];dx,dy=b[0]-a[0],b[1]-a[1];l2=dx*dx+dy*dy
 def distance(marker):
  pos=marker['position'];px,py=pos['x']-a[0],pos['y']-a[1];f=max(0,min(1,(px*dx+py*dy)/l2)) if l2 else 0
  return (px-f*dx)**2+(py-f*dy)**2
 nearest=min(markers,key=distance);layer=m.native.child(t,'layer')[1].strip('"')
 rows.append(dict(uuid=uid,layer=layer,nearest_pad=nearest['pad'],distance_mm=distance(nearest)**.5,nearest_marker_layers=nearest['layers'],same_layer=layer in nearest['layers'],proposals=len(list(m.single.proposals(nodes,uid)))))
pairs=m.pair.rank_pairs(nodes,ids,errors,16)
out=dict(markers=markers,ranked_segments=rows,ranked_pairs=pairs,wrong_layer_segments=sum(not r['same_layer'] for r in rows),scope='Discovery diagnostic only; not a production bug fix or routing benchmark')
x.out.write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
