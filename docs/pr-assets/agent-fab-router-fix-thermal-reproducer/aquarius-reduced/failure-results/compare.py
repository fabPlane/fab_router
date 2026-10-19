#!/usr/bin/python3
"""Repeat identical control tests against pinned old and current search drivers."""
from pathlib import Path
import json, shutil, subprocess, tempfile
asset=Path(__file__).resolve().parents[1]
repo=next(p for p in asset.parents if (p/'.git').exists())
rows=[]
with tempfile.TemporaryDirectory(prefix='thermal-budget-') as temp:
    root=Path(temp)
    for source in asset.glob('*.py'):shutil.copy2(source,root/source.name)
    for label in ('before','after'):
        data=(subprocess.check_output(['git','show','39fd091:'+str((asset/'auto-links.py').relative_to(repo))],cwd=repo)
              if label=='before' else (asset/'auto-links.py').read_bytes())
        (root/'auto-links.py').write_bytes(data)
        for repeat in range(1,4):
            run=subprocess.run(['/usr/bin/python3','-B',str(root/'auto-link-controls.py')],capture_output=True,text=True,timeout=30)
            log=run.stdout+run.stderr
            if label=='before':
                assert run.returncode==1 and 'FAILED (failures=1, errors=1)' in log,log
                assert "ValueError not raised" in log,log
                assert "AttributeError: module 'auto_links' has no attribute 'UnsupportedMetadata'" in log,log
            else:assert run.returncode==0 and 'Ran 13 tests' in log and 'OK' in log,log
            rows.append(dict(source=label,repeat=repeat,passed=11 if label=='before' else 13,failed=2 if label=='before' else 0,log=log))
print(json.dumps(dict(routing_benchmark=False,rows=rows),indent=2))
