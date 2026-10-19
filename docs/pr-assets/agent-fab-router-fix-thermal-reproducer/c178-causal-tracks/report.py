#!/usr/bin/python3
"""Summarize measured error reduction separately from terminal preservation."""
import argparse,json
from pathlib import Path
import ablate as m
p=argparse.ArgumentParser();p.add_argument('--results',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--vias',type=Path,required=True);x=p.parse_args()
z=json.loads((x.results/'summary.json').read_text());r=z['rows'][0]
data=(x.results/'sources'/next(v for k,v in z['source_sha256'].items() if '/source/' in k and k.endswith('.kicad_pcb'))).read_bytes()
inp=(x.results/'sources'/next(v for k,v in z['source_sha256'].items() if '/input/' in k and k.endswith('.kicad_pcb'))).read_bytes()
nodes=m.native.parse(data.decode());ids={m.native.uid(n) for n in m.native.parse(inp.decode()) if isinstance(n,list)}
global_ranks=m.search.rank_segments(nodes,ids,r['baseline']['errors'],8)
items={m.native.uid(n):n for n in nodes if isinstance(n,list) and n[0] in ('segment','via')}
vz=json.loads((x.vias/'summary.json').read_text());assert vz['source_sha256']==z['source_sha256']
attempts=r['attempts']+vz['rows'][0]['attempts']
findings=[]
for marker in r['markers']:
 causal=[]
 for a in attempts:
  removed=[json.loads(e) for e in a['removed_errors']]
  if any(any(i['uuid']==marker['pad'] for i in e['items']) for e in removed):
   uid=a.get('track',a.get('via'));t=items[uid]
   causal.append(dict(item=uid,kind=t[0],net=m.native.child(t,'net')[1],
    geometry={k:m.native.child(t,k)[1:] for k in ('start','end','width','at','size','drill','layers') if m.native.child(t,k)},
    rank_for_marker=marker['tracks'].index(uid)+1 if uid in marker['tracks'] else None,
    global_top8=uid in global_ranks,errors=len(a['row']['errors']),opens=a['row']['opens'],
    lost_pairs=len(a['lost_pairs']),added_errors=len(a['added_errors']),
    native_policy_accepts=bool(m.transaction.errors(a['row'])<m.transaction.errors(r['baseline'])
     and not a['lost_pairs'] and a['row']['opens']<=r['baseline']['opens'])))
 findings.append(dict(pad=marker['pad'],label=marker['label'],causes=causal))
result=dict(scope='Single generated-copper ablations on complete Aquarius board; not production routing',
 repeats=3,track_candidates_per_repeat=len(r['attempts']),via_candidates_per_repeat=len(vz['rows'][0]['attempts']),global_top8=global_ranks,findings=findings,
 native_checks=sum(1+len(r['attempts']) for r in z['rows']+vz['rows']),
 aggregate_errors=sum(len(r['baseline']['errors'])+sum(len(a['row']['errors']) for a in r['attempts']) for r in z['rows']+vz['rows']),
 aggregate_opens=sum(r['baseline']['opens']+sum(a['row']['opens'] for a in r['attempts']) for r in z['rows']+vz['rows']))
x.out.write_text(json.dumps(result,indent=2)+'\n')
for f in findings:print(f['label'],json.dumps(f['causes']))
