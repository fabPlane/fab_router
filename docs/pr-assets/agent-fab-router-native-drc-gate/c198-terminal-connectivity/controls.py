import pathlib,shutil,subprocess,json,hashlib,base64
root=pathlib.Path(__file__).resolve().parent;out=root/'controls-final';out.mkdir(exist_ok=False)
repo=pathlib.Path('/home/hyper/bench/wt/fr-bugs');old=root/'before-tool/native-drc-gate.ts';s=root.parent
rows=[]
for repeat in range(3):
 for name,input,candidate in [
 ('rewired',root/'control/input/board.kicad_pcb',root/'control/candidate/board.kicad_pcb'),
 ('unchanged',root/'control/input/board.kicad_pcb',root/'control/input/board.kicad_pcb'),
 ('unsafe-thermal',s/'c175/inputs/original-input/board.kicad_pcb',s/'c175/inputs/original-segment/board.kicad_pcb'),
 ('repaired-thermal',s/'c175/inputs/original-input/board.kicad_pcb',s/f'c175/native/selected-{repeat}.kicad_pcb')]:
  d=out/f'{name}-{repeat}';d.mkdir()
  for role,source in [('input',input),('candidate',candidate)]:
   t=d/role;t.mkdir()
   for ext in ['.kicad_pcb','.kicad_pro','.kicad_dru']:
    f=(input if ext!='.kicad_pcb' else source).with_suffix(ext)
    if f.exists():shutil.copyfile(f,t/('board'+ext))
  result=[]
  for phase in ['before','after']:
   command=['bun',str(old),str(d/'input/board.kicad_pcb'),str(d/'candidate/board.kicad_pcb'),str(d/'before.json')] if phase=='before' else ['bun',str(repo/'tools/native-candidate-bundle.ts'),str(d/'input/board.kicad_pcb'),str(d/'candidate/board.kicad_pcb'),str(d/'bundle.json')]
   p=subprocess.run(['taskset','-c','20-25','nice','-n','10','timeout','400',*command],capture_output=True,text=True,cwd=repo,timeout=410)
   (d/f'{phase}.log').write_text(p.stdout+p.stderr)
   assert p.returncode in [0,1],(name,phase,p.stderr)
   r=json.loads((d/'before.json').read_text() if phase=='before' else p.stdout)
   if phase=='after':(d/'after.json').write_text(json.dumps(r,indent=2)+'\n')
   assert r['accepted']==(name!='unsafe-thermal' and (name!='rewired' or phase=='before'))
   result.append(r)
  a,b=result
  assert a['opensAfter']==b['opensAfter'] and len(a['newErrors'])==len(b['newErrors'])
  assert b['lostTerminalPairs']==(2 if name=='rewired' else 0)
  assert (d/'bundle.json').exists()==b['published']==b['accepted']
  rows.append(dict(name=name,repeat=repeat,before_accepted=a['accepted'],after_accepted=b['accepted'],lost_terminal_pairs=b['lostTerminalPairs'],new_errors=len(b['newErrors']),opens=b['opensAfter'],directory=d.name))
  (out/'results.json').write_text(json.dumps(rows,indent=2)+'\n');print(rows[-1],flush=True)
