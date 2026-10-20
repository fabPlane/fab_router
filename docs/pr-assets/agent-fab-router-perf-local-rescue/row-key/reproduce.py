from pathlib import Path
import tarfile,json,hashlib,subprocess,sys
p=Path(__file__).resolve().parent;ref=p.parent/'default-slow-profile'
w=Path(sys.argv[1]).resolve();w.mkdir(exist_ok=False)
base=json.loads((ref/'audit.json').read_text())['source_hashes']
for variant in ['control','candidate']:
 s=w/variant;s.mkdir()
 with tarfile.open(ref/'source.tar.gz') as t:t.extractall(s,filter='data')
 for f,h in base.items():assert hashlib.sha256((s/f).read_bytes()).hexdigest()==h,f
subprocess.run([sys.executable,str(p/'prepare.py'),str(w)],check=True)
audit=json.loads((p/'source-audit.json').read_text())
for variant in ['control','candidate']:
 actual={str(f.relative_to(w/variant)):hashlib.sha256(f.read_bytes()).hexdigest() for directory in ['src','spec'] for f in sorted((w/variant/directory).rglob('*')) if f.is_file()}
 assert actual==audit[variant],(variant,'complete reconstructed source/spec identity')

subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','120','bun',str(p/'test-query.ts'),str(w)],check=True)
subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','120','bun',str(p/'test-key.ts')],check=True)
if '--prepare-only' in sys.argv:sys.exit(0)
rows=[]
for case,meta in json.loads((ref/'audit.json').read_text())['inputs'].items():
 for f,h in meta['hashes'].items():assert hashlib.sha256((ref/case/f).read_bytes()).hexdigest()==h,(case,f)
 for repeat in range(3):
  for variant in (['control','candidate'] if repeat%2==0 else ['candidate','control']):
   name=f'{case}-{repeat}-{variant}'
   with (w/(name+'.log')).open('w') as log:
    subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','--kill-after=5','180','bun',str(ref/'replay.ts'),str(w/variant),str(ref/case),str(w/name)],stdout=log,stderr=subprocess.STDOUT,check=True)
   rows.append(dict(case=case,repeat=repeat,variant=variant,seconds=json.loads((w/name/'timing.json').read_text())['seconds']))
   (w/'timings.json').write_text(json.dumps(rows,indent=2)+'\n')
   print(name,rows[-1]['seconds'],flush=True)
