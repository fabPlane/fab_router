"""Reproduce paired gates on all archived cases and controls without rerouting."""
import argparse,json,pathlib,shutil,subprocess
p=argparse.ArgumentParser();p.add_argument('--archive',type=pathlib.Path,required=True);p.add_argument('--source',type=pathlib.Path,required=True);p.add_argument('--out',type=pathlib.Path,required=True);x=p.parse_args()
x.out.mkdir(parents=True,exist_ok=False);old=x.out/'before-tool';old.mkdir()
for name in ['native-drc-gate.ts','kicad-board-rules.ts']:
 (old/name).write_bytes(subprocess.check_output(['git','-C',str(x.source),'show',f'24aa80ca:tools/{name}']))
for collection in ['native','controls-final']:
 rows=json.loads((x.archive/collection/'results.json').read_text());target=x.out/collection;target.mkdir();results=[]
 for row in rows:
  source=x.archive/collection/row['directory'];d=target/row['directory'];d.mkdir()
  for role in ['input','candidate']:shutil.copytree(source/role,d/role)
  args=[str(d/'input/board.kicad_pcb'),str(d/'candidate/board.kicad_pcb')]
  for phase,command in [('before',['bun',str(old/'native-drc-gate.ts'),*args,str(d/'before.json')]),('after',['bun',str(x.source/'tools/native-candidate-bundle.ts'),*args,str(d/'bundle.json')])]:
   r=subprocess.run(['taskset','-c','20-25','nice','-n','10','timeout','400',*command],capture_output=True,text=True,cwd=x.source,timeout=410)
   (d/f'{phase}.log').write_text(r.stdout+r.stderr);assert r.returncode in [0,1],r.stderr
   if phase=='after':(d/'after.json').write_text(r.stdout)
   expected=json.loads((source/f'{phase}.json').read_text());actual=json.loads((d/f'{phase}.json').read_text())
   for key in ['accepted','opensBefore','opensAfter','inputSha256','candidateSha256']+(['lostTerminalPairs','terminalGroups','published'] if phase=='after' else []):assert actual[key]==expected[key],(collection,row['directory'],phase,key)
  results.append(row);(target/'results.json').write_text(json.dumps(results,indent=2)+'\n');print(collection,len(results),row['directory'],flush=True)
print('PASS: all paired decisions, native terminal groups and input bindings reproduced')
