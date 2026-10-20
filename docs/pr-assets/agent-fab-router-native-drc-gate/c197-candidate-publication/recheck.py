"""Repeat native checks/publication on the self-contained captured sources."""
import argparse,base64,hashlib,json,pathlib,subprocess
p=argparse.ArgumentParser();p.add_argument('captured',type=pathlib.Path);p.add_argument('output',type=pathlib.Path);p.add_argument('--source',type=pathlib.Path,required=True);p.add_argument('--before-tool',type=pathlib.Path,required=True);x=p.parse_args();x.output.mkdir(parents=True,exist_ok=False)
def run(source,candidate,d,expected,old=False):
 d.mkdir(parents=True,exist_ok=False)
 command=['bun',str(x.before_tool if old else x.source/'tools/native-candidate-bundle.ts'),str(source),str(candidate),str(d/('report.json' if old else 'bundle.json'))]
 r=subprocess.run(['timeout','270',*command],capture_output=True,text=True,timeout=280)
 (d/'process.log').write_text(r.stdout+r.stderr)
 assert r.returncode==(0 if expected['accepted'] else 1),(r.returncode,r.stderr)
 data=json.loads((d/'report.json').read_text() if old else r.stdout)
 assert data['accepted']==expected['accepted']
 assert len(data['newErrors'])==expected['new_errors'] and data['opensAfter']==expected['opens']
 if not old:
  (d/'report.json').write_text(json.dumps(data,indent=2)+'\n')
  assert (d/'bundle.json').exists()==data['published']==data['accepted']
  if data['published']:
   b=json.loads((d/'bundle.json').read_text())
   assert b['validation']=={k:v for k,v in data.items() if k!='published'}
   for role,path in [('input',source),('candidate',candidate)]:
    for f in b[role]:
     raw=base64.b64decode(f['base64'],validate=True)
     assert hashlib.sha256(raw).hexdigest()==f['sha256']
     assert raw==path.with_suffix(pathlib.Path(f['name']).suffix).read_bytes()
 return data
rows=json.loads((x.captured/'native/results.json').read_text())
for i,row in enumerate(rows):
 d=x.captured/'native'/row['directory'];inp=d/'input/board.kicad_pcb';candidate=d/'candidate/board.kicad_pcb'
 for phase in ['before','after']:run(inp,candidate,x.output/f'{i:03}'/phase,row,old=phase=='before')
 print(i+1,row['case'],row['seed'],row['accepted'],flush=True)
assert len(rows)==78
for repeat in range(3):
 d=x.captured/'repairs'/str(repeat)
 for role in ['unsafe','repaired']:
  expected=dict(accepted=role=='repaired',new_errors=2 if role=='unsafe' else 0,opens=0)
  run(d/'input/board.kicad_pcb',d/role/'board.kicad_pcb',x.output/'repairs'/str(repeat)/role,expected)
print('PASS: 78 paired decisions and six repair/publication controls; 324 native checks; no routing rerun')
