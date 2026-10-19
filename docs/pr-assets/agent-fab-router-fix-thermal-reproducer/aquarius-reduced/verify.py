#!/usr/bin/python3
"""Fresh native refill and three repeats of the failure plus every track deletion."""
import argparse,collections,hashlib,json
from pathlib import Path
import native

def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--out',required=True,type=Path);args=parser.parse_args()
 assert not args.out.exists();args.out.mkdir(parents=True)
 native.D=args.out
 source=native.SRC
 inputs={p.name:digest(p) for p in [source,source.with_suffix('.kicad_pro'),source.with_suffix('.kicad_dru')]}
 nodes=native.parse(source.read_text());assert native.parse(native.dump(nodes))==nodes
 pads=[p for n in nodes if isinstance(n,list) and n[0]=='footprint' for p in n if isinstance(p,list) and p[0]=='pad']
 tracks=[n for n in nodes if isinstance(n,list) and n[0]=='segment']
 assert len(pads)==1 and native.uid(pads[0])==native.TARGET
 assert len(tracks)==3
 assert sum(isinstance(n,list) and n[0]=='zone' for n in nodes)==1
 assert not any(isinstance(n,list) and n[0]=='via' for n in nodes)
 rows=[]
 for repeat in range(1,4):
  for name,drop in [('all',None)]+[(f'without-track-{i+1}',native.uid(n)) for i,n in enumerate(tracks)]+[('without-all-tracks','all')]:
   subset=[n for n in nodes if not(isinstance(n,list) and n[0]=='segment' and (drop=='all' or native.uid(n)==drop))]
   row=native.check(subset,f'{name}-{repeat}')
   expected=1 if name=='all' else 0
   assert len(row['target'])==expected and len(row['errors'])==expected and row['opens']==0
   if expected:assert 'zone min spoke count 2; actual 1' in row['target'][0]['description']
   directory=args.out/row['name']
   row['sha256']={p.name:digest(p) for p in directory.iterdir() if p.is_file() and p.suffix != '.kicad_prl'}
   rows.append(row)
 assert inputs=={name:digest(source.parent/name) for name in inputs}
 summary=dict(routing_benchmark=False,production_fix=False,native_version=native.pcbnew.Version(),repeats=3,input_sha256=inputs,rows=rows)
 assert summary['native_version']=='10.0.6'
 (args.out/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
if __name__=='__main__':main()
