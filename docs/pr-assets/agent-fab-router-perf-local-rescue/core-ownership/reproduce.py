from pathlib import Path
import subprocess,sys,hashlib,json
p=Path(__file__).parent;source=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir()
expected=json.loads((p/'source-hashes.json').read_text())
tracked=subprocess.check_output(['git','-C',str(source),'ls-files','-z','--','src','spec']).decode().split(chr(0))
actual={f:hashlib.sha256((source/f).read_bytes()).hexdigest() for f in tracked if f}
assert actual==expected,'source differs; use recorded revision'
subprocess.run(['python3',str(p/'prepare.py'),str(source),str(out/'instrumented')],check=True)
assert json.loads((out/'instrumented/source-hashes.json').read_text())==expected,'archive source differs'
for case in ['kitspace-aquarius-j4','photon-sprinkler-sprinkler-j3','paperino-hw-paperino-shield-j4']:
 subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','--kill-after=5','600','bun',str(p/'replay.ts'),str(out/'instrumented'),str(p.parent/'default-slow-profile'/case),str(out/case)],check=True)
subprocess.run(['python3',str(p/'verify.py'),str(out)],check=True)
