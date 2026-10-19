"""Require the stub API trace to reject three deliberately broken candidates."""
from pathlib import Path
import json,subprocess,sys
here=Path(__file__).resolve().parent;root=here.parents[3];work=Path(sys.argv[1]).resolve();source=work/'work/source'
original=(source/'src/route/quilt.ts').read_text()
mutations={'invalidation':original.replace('    states.fill(0);',''), 'key':original.replace('keys[slot] === key','true'), 'blocked':original.replace('states[slot] === 1 ? "free" : "blocked"','"free"')}
for name,text in mutations.items():
 assert text!=original
 p=source/'src/route'/f'quilt-mutant-{name}.ts';assert not p.exists();p.write_text(text)
 try:
  with (work/f'mutation-{name}.log').open('w') as log:
   result=subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','--kill-after=5','30','bun',str(here/'controls.ts'),str(work/'work/original'),str(source),p.name],stdout=log,stderr=subprocess.STDOUT)
  assert result.returncode==1,(name,result.returncode)
 finally:p.unlink()
 print(name,'REJECTED')
