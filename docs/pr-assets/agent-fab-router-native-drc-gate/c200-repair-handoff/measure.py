import pathlib,json,subprocess,shutil,hashlib,base64
root=pathlib.Path('/home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c200');repo=pathlib.Path('/home/hyper/bench/wt/fr-bugs');out=root/'native';out.mkdir(exist_ok=False)
prior=pathlib.Path('/home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c198/native')
old=root/'before-tool';old.mkdir()
for name in ['native-drc-gate.ts','native-candidate-bundle.ts','kicad-board-rules.ts','native-terminal-groups.py']:
 (old/name).write_bytes(subprocess.check_output(['git','show','80f1fb7f:tools/'+name],cwd=repo))
rows=[]
def invoke(d,phase,source,routed,repaired):
 cmd=['bun',str(old/'native-candidate-bundle.ts'),str(source),str(repaired),str(d/(phase+'.bundle.json'))] if phase=='before' else ['bun','tools/native-repair-bundle.ts',str(source),str(routed),str(repaired),str(d/(phase+'.bundle.json'))]
 p=subprocess.run(['taskset','-c','20-25','nice','-n','10','timeout','400',*cmd],cwd=repo,capture_output=True,text=True,timeout=410)
 (d/(phase+'.log')).write_text(p.stdout+p.stderr);assert p.returncode in (0,1),(d,p.stderr)
 data=json.loads(p.stdout);assert data['published']==(p.returncode==0)
 (d/(phase+'.json')).write_text(json.dumps(data,indent=2)+'\n')
 if data['published']:
  bundle=json.loads((d/(phase+'.bundle.json')).read_text())
  for role in ['input','candidate']+(['routed'] if phase=='after' else []):
   src={'input':source,'candidate':repaired,'routed':routed}[role]
   for f in bundle[role]:
    b=base64.b64decode(f['base64'],validate=True);assert hashlib.sha256(b).hexdigest()==f['sha256'];assert b==src.with_suffix(pathlib.Path(f['name']).suffix).read_bytes()
 return data
for i,row in enumerate(json.loads((prior/'results.json').read_text())):
 d=out/f'{i:03}';d.mkdir();oldcase=prior/row['directory']
 for role in ['input','candidate']:shutil.copytree(oldcase/role,d/role)
 source=d/'input/board.kicad_pcb';routed=d/'candidate/board.kicad_pcb'
 a=invoke(d,'before',source,routed,routed);b=invoke(d,'after',source,routed,routed)
 for key in ['accepted','newErrors','opensBefore','opensAfter','lostTerminalPairs','inputSha256','candidateSha256']:assert a[key]==b[key],(i,key)
 assert b['repair']['accepted'] and b['repair']['lostTerminalPairs']==0
 rows.append(dict(case=row['case'],seed=row['seed'],published=b['published'],new_errors=len(b['newErrors']),opens=b['opensAfter'],lost_terminal_pairs=b['lostTerminalPairs'],directory=d.name))
 (out/'results.json').write_text(json.dumps(rows,indent=2)+'\n');print(len(rows),row['case'],flush=True)
(out/'summary.json').write_text(json.dumps(dict(cases=26,runs=78,native_checks=390,published=sum(r['published'] for r in rows),opens=sum(r['opens'] for r in rows),new_errors=sum(r['new_errors'] for r in rows),router_rerun=False,all_paired_decisions_equal=True),indent=2)+'\n')
