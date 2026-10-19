import pathlib,shutil,subprocess,json,hashlib,base64
s=pathlib.Path('/home/hyper/bench/agents/codex-fabpcb-bugs/scratch');root=s/'c197';out=root/'repairs';out.mkdir(exist_ok=False)
rows=[]
for repeat in range(3):
 d=out/str(repeat);d.mkdir()
 for role in ['input','unsafe','repaired']:
  t=d/role;t.mkdir()
  source=s/'c175/inputs/original-input/board.kicad_pcb' if role=='input' else s/'c175/inputs/original-segment/board.kicad_pcb' if role=='unsafe' else s/f'c175/native/selected-{repeat}.kicad_pcb'
  shutil.copyfile(source,t/'board.kicad_pcb')
  for ext in ['.kicad_pro','.kicad_dru']:shutil.copyfile(s/('c175/inputs/original-input/board'+ext),t/('board'+ext))
 for role in ['unsafe','repaired']:
  output=d/(role+'.bundle.json')
  command=['taskset','-c','20-25','nice','-n','10','timeout','270','bun','tools/native-candidate-bundle.ts',str(d/'input/board.kicad_pcb'),str(d/role/'board.kicad_pcb'),str(output)]
  run=subprocess.run(command,capture_output=True,text=True,timeout=280)
  (d/(role+'.log')).write_text(run.stdout+run.stderr)
  assert run.returncode==(1 if role=='unsafe' else 0),(repeat,role,run.returncode,run.stderr)
  data=json.loads(run.stdout);(d/(role+'.json')).write_text(json.dumps(data,indent=2)+'\n')
  assert data['published']==(role=='repaired')==output.exists()
  assert len(data['newErrors'])==(2 if role=='unsafe' else 0);assert data['opensAfter']==0
  if output.exists():
   bundle=json.loads(output.read_text())
   for group in ['input','candidate']:
    for f in bundle[group]:
     b=base64.b64decode(f['base64'],validate=True);assert hashlib.sha256(b).hexdigest()==f['sha256'];assert b==(d/('input' if group=='input' else role)/f['name']).read_bytes()
  row=dict(repeat=repeat,role=role,published=data['published'],new_errors=len(data['newErrors']),opens=data['opensAfter']);rows.append(row);print(row,flush=True)
(out/'results.json').write_text(json.dumps(rows,indent=2)+'\n')
