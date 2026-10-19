"""Portable complete-board search reproduction using committed regression fixtures."""
import argparse,gzip,json,pathlib,subprocess
p=argparse.ArgumentParser();p.add_argument('--repo',type=pathlib.Path,required=True);p.add_argument('--out',type=pathlib.Path,required=True);p.add_argument('--repeats',type=int,default=3);x=p.parse_args()
assert 1<=x.repeats<=3
repo=x.repo.resolve();out=x.out.resolve();out.mkdir(exist_ok=False)
f=repo/'test/fixtures/native-thermal-search';d=out/'fixtures';d.mkdir()
for role in ['source','routed']:
 (d/(role+'.kicad_pcb')).write_bytes(gzip.decompress((f/(role+'.kicad_pcb.gz')).read_bytes()))
 for ext in ['.kicad_pro','.kicad_dru']:(d/(role+ext)).write_bytes((f/('board'+ext)).read_bytes())
rows=[]
for repeat in range(x.repeats):
 cmd=['taskset','-c','20-25','nice','-n','10','timeout','2400','bun','tools/native-thermal-search.ts',str(d/'source.kicad_pcb'),str(d/'routed.kicad_pcb'),str(out/f'accepted-final-{repeat}.json'),str(out/f'measured-{repeat}')]
 run=subprocess.run(cmd,cwd=repo,capture_output=True,text=True,timeout=2410)
 (out/f'measured-{repeat}.log').write_text(run.stdout+run.stderr)
 assert run.returncode==0,(run.returncode,run.stderr)
 result=json.loads(run.stdout);assert result['published'] and result['repaired'];assert result['validation']['newErrors']==[]
 row=dict(repeat=repeat,before_errors=2,after_errors=0,opens=result['validation']['opensAfter'],lost_source_pairs=result['validation']['lostTerminalPairs'],lost_routed_pairs=result['validation']['repair']['lostTerminalPairs'],stages=result['stages'],attempts=len(result['attempts']),native_checks=3*len(result['attempts'])+9,candidate_sha256=result['validation']['candidateSha256'])
 rows.append(row);(out/'measurement.json').write_text(json.dumps(rows,indent=2)+'\n');print(row,flush=True)
