"""Repeat the saved complete-board P0 search; keep every attempt and process status."""
import argparse,json,pathlib,subprocess,time
p=argparse.ArgumentParser();p.add_argument('--repo',type=pathlib.Path,required=True);p.add_argument('--fixtures',type=pathlib.Path,required=True);p.add_argument('--out',type=pathlib.Path,required=True);p.add_argument('--repeats',type=int,default=3);x=p.parse_args()
assert 1<=x.repeats<=3
x.out.mkdir(exist_ok=False,parents=True)
for repeat in range(x.repeats):
 cmd=['taskset','-c','20-25','nice','-n','10','timeout','2400','bun','tools/native-thermal-search.ts',str(x.fixtures.resolve()/'source.kicad_pcb'),str(x.fixtures.resolve()/'routed.kicad_pcb'),str(x.out.resolve()/f'accepted-{repeat}.json'),str(x.out.resolve()/f'search-{repeat}')]
 start=time.monotonic();run=subprocess.run(cmd,cwd=x.repo,capture_output=True,text=True,timeout=2410)
 (x.out/f'search-{repeat}.log').write_text(run.stdout+run.stderr)
 (x.out/f'status-{repeat}.json').write_text(json.dumps(dict(command=cmd,exit_code=run.returncode,seconds=time.monotonic()-start),indent=2)+'\n')
 assert run.returncode in [0,1],(run.returncode,run.stderr)
 result=json.loads(run.stdout);assert result['published']==(run.returncode==0)
 print(json.dumps(dict(repeat=repeat,published=result['published'],stages=result['stages'],attempts=len(result['attempts']),errors=len(result['validation']['newErrors']))),flush=True)
