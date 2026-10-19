"""Reject the previously transitivity-dependent child-first selection."""
from pathlib import Path
import json, subprocess, sys
p=Path(__file__).resolve().parent
out=Path(sys.argv[1]);out.mkdir(exist_ok=True,parents=True)
s=(p/'verify.ts').read_text()
a=s.index('        // Preserve left-versus-parent')
b=s.index('        f[i] = mf;',a)
old=(p.parent/'heap-sift/verify.ts').read_text()
c=old.index('        const m = r < last')
d=old.index('        f[i] = mf;',c)
s=s[:a]+old[c:d]+s[b:]
trial=out/'child-first.ts';trial.write_text(s)
with (out/'mutation.log').open('w') as log:
    code=subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','60','bun',str(trial),str(out/'mutation-result.json')],stdout=log,stderr=subprocess.STDOUT).returncode
assert code==1,code
assert 'mismatch' in (out/'mutation.log').read_text()
(out/'mutation.json').write_text(json.dumps(dict(childFirstRejected=True,exit=code),indent=2)+'\n')
