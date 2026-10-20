"""Validate and summarize read-only graph coverage. Standard library only."""
import json,sys,html
from pathlib import Path
p=json.loads(Path(sys.argv[1]).read_text()); out=Path(sys.argv[2]);out.mkdir(exist_ok=True,parents=True)
r=p['rows'];assert len(r)==72
keys=[(x['case'],x['target']['net'],x['target']['from'],x['target']['to'],x['sheet'],x['margin']) for x in r]
assert len(set(keys))==len(keys)
groups={k[:-1] for k in keys}; assert len(groups)==12
for g in groups:assert sorted(k[-1] for k in keys if k[:-1]==g)==[0,4,8,16,32,64]
for x in r:
 assert 2<=x['nodes']<=512 and 0<=x['exits']<=x['nodes']-2 and 0<=x['entries']<=x['nodes']-2
 assert len(x['dsnSha256'])==len(x['sesSha256'])==len(x['nodeSha256'])==64
 assert set(x['counts'])=={'pad','track','barrel'}
 for c in x['counts'].values():
  assert all(isinstance(v,int) and v>=0 for v in c.values())
  assert c['attempted']==sum(c[k] for k in ['outside','duplicate','retained','excluded'])
 assert x['nodes']==2+sum(c['retained'] for c in x['counts'].values())
 assert not any(c['excluded'] for c in x['counts'].values()) or x['nodes']==512
assert p['skips']==[{'case':'hellscribe-hellscribe-j2-large','nativeOpens':1,'reason':'no engine residual after import'}]
summary={'regionsSheets':len(r),'targets':len({k[:4] for k in keys}),'targetSheets':len(groups),'capped':sum(any(c['excluded'] for c in x['counts'].values()) for x in r),'noExit':sum(x['exits']==0 for x in r),'noEntry':sum(x['entries']==0 for x in r),'direct':sum(x['direct'] for x in r)}
(out/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
lines=['| Case / net / sheet | Margin | Nodes | Excluded unique | Legal exits | Legal entries |','| --- | ---: | ---: | ---: | ---: | ---: |']
for x in r:lines.append(f"| {x['case']} / {x['target']['net']} / {x['sheet']} | {x['margin']} | {x['nodes']} | {sum(c['excluded'] for c in x['counts'].values())} | {x['exits']} | {x['entries']} |")
(out/'cases.md').write_text('\n'.join(lines)+'\n')
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1700" height="660"><rect width="1700" height="660" fill="white"/><g font-family="sans-serif" fill="#172c42"><text x="30" y="35" font-size="24">Candidate coverage at 64-pitch margin (read-only census)</text><text x="30" y="62" font-size="16">Blue: retained corner nodes. Orange: unique corners excluded by the 512-node cap. Two anchors excluded.</text>']
for i,x in enumerate(x for x in r if x['margin']==64):
 y=100+i*43; n=x['nodes']-2;e=sum(c['excluded'] for c in x['counts'].values());label=f"{x['case']} / net {x['target']['net']} / sheet {x['sheet']}"
 svg.extend([f'<text x="25" y="{y+15}" font-size="13">{html.escape(label)}</text>',f'<rect x="630" y="{y}" width="{n*.35}" height="22" fill="#277da8"/>',f'<rect x="{630+n*.35}" y="{y}" width="{e*.35}" height="22" fill="#e69b36"/>',f'<text x="{640+(n+e)*.35}" y="{y+16}" font-size="13">{n} + {e}; exits {x["exits"]}, entries {x["entries"]}</text>'])
svg.append('</g></svg>');(out/'coverage.svg').write_text('\n'.join(svg)+'\n');print(json.dumps(summary))
