"""Compare all attempts and exact native terminal positions; no board mutations."""
import argparse,json,pathlib,pcbnew,hashlib,collections
p=argparse.ArgumentParser();p.add_argument('before',type=pathlib.Path);p.add_argument('after',type=pathlib.Path);p.add_argument('output',type=pathlib.Path);a=p.parse_args()
def positions(path):
 b=pcbnew.LoadBoard(str(path));return {f.GetReference():[f.GetPosition().x,f.GetPosition().y] for f in b.GetFootprints()}
def pads(path):
 b=pcbnew.LoadBoard(str(path));return {p.m_Uuid.AsString():[p.GetPosition().x,p.GetPosition().y] for f in b.GetFootprints() for p in f.Pads()}
def inventory(root):
 control=json.loads((root/'controls.json').read_text());assert control['complete'] and control['controls_preserved'];rows=json.loads((root/'results.json').read_text());assert len(rows)==78;return {(r['case'],r['seed']):r for r in rows}
bc=json.loads((a.before/'controls.json').read_text()); ac=json.loads((a.after/'controls.json').read_text());
x,y=inventory(a.before),inventory(a.after);assert x.keys()==y.keys();out=[]
for key,old in x.items():
 new=y[key];b=a.before/old['evidence'];c=a.after/new['evidence'];source=positions(b/'work/board.kicad_pcb');assert source==positions(c/'work/board.kicad_pcb')
 assert (b/'work/board.dsn').read_bytes()==(c/'work/board.dsn').read_bytes()
 def route(path):return (path/'work/board.ses').read_text().split('(routes',1)[1]
 sp=pads(b/'work/board.kicad_pcb'); assert sp==pads(c/'work/board.kicad_pcb'); bpad=pads(b/'final.kicad_pcb'); cpad=pads(c/'final.kicad_pcb')
 same=route(b)==route(c); bp=positions(b/'final.kicad_pcb'); cp=positions(c/'final.kicad_pcb')
 out.append(dict(case=key[0],seed=key[1],before_drift=sum(v!=bp.get(k) for k,v in source.items()),after_drift=sum(v!=cp.get(k) for k,v in source.items()),before_moved_pads=sum(v!=bpad.get(k) for k,v in sp.items()),after_moved_pads=sum(v!=cpad.get(k) for k,v in sp.items()),routes_identical=same,before_passed=old['passed'],after_passed=new['passed'],before_opens=old['opens'],after_opens=new['opens'],before_errors=old['new_errors'],after_errors=new['new_errors']))
summary={phase:dict(runs=78,passed=sum(r[phase+'_passed'] for r in out),opens=sum(r[phase+'_opens'] for r in out),new_errors=sum(r[phase+'_errors'] for r in out),runs_with_drift=sum(r[phase+'_drift']>0 for r in out),moved_footprints=sum(r[phase+'_drift'] for r in out),moved_pads=sum(r[phase+'_moved_pads'] for r in out)) for phase in ['before','after']};summary['identical_route_scopes']=sum(r['routes_identical'] for r in out);summary['all_outcomes_identical']=all(all(r['before_'+k]==r['after_'+k] for k in ['passed','opens','errors']) for r in out)
summary['source_hash_differences']=[p for p,h in bc['candidate']['source_sha256'].items() if ac['candidate']['source_sha256'].get(p)!=h]
a.output.write_text(json.dumps(dict(summary=summary,rows=out),indent=2)+'\n');print(json.dumps(summary,indent=2))
