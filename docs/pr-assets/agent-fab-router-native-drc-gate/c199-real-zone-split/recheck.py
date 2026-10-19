"""Fresh matched native checks: full/reduced generated copper, three repeats each."""
import argparse,gzip,hashlib,json,pathlib,shutil,subprocess
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--source',type=pathlib.Path,required=True);p.add_argument('--out',type=pathlib.Path,required=True);x=p.parse_args()
x.source=x.source.resolve();x.out=x.out.resolve();x.out.mkdir(parents=True,exist_ok=False)
f=x.source/'test/fixtures/native-real-zone-split';source=gzip.decompress((f/'input.kicad_pcb.gz').read_bytes()).decode();end=source.rindex(')');rows=[]
for repeat in range(3):
 for name in ['full','reduced']:
  d=x.out/f'{name}-{repeat}';d.mkdir()
  for role in ['input','candidate']:
   b=d/role;b.mkdir();added='' if role=='input' else gzip.decompress((f/'full-added.sexpr.gz').read_bytes()).decode() if name=='full' else (f/'reduced-added.sexpr').read_text()
   (b/'board.kicad_pcb').write_text(source[:end]+'\n'+added+'\n'+source[end:])
   for ext in ['.kicad_pro','.kicad_dru']:shutil.copyfile(f/('board'+ext),b/('board'+ext))
  result=d/'result.json';command=['timeout','300','bun',str(x.source/'tools/native-drc-gate.ts'),str(d/'input/board.kicad_pcb'),str(d/'candidate/board.kicad_pcb'),str(result)]
  proc=subprocess.run(command,capture_output=True,text=True,cwd=x.source,timeout=310);(d/'gate.log').write_text(proc.stdout+proc.stderr)
  assert proc.returncode==1,(name,proc.returncode,proc.stderr)
  r=json.loads(result.read_text());assert not r['accepted'] and not r['newErrors'] and r['lostTerminalPairs']==17 and r['opensBefore']==14 and r['opensAfter']==(1 if name=='full' else 16)
  rows.append(dict(name=name,repeat=repeat,new_errors=0,opens=r['opensAfter'],lost_pairs=r['lostTerminalPairs'],accepted=r['accepted'],source_sha256=r['inputSha256'],candidate_sha256=r['candidateSha256']))
  (x.out/'results.json').write_text(json.dumps(rows,indent=2)+'\n');print(rows[-1],flush=True)
assert len(rows)==6
