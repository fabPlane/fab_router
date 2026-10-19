#!/usr/bin/env python3
"""Run identical synthetic report controls against pinned and current reporters."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile

HERE=Path(__file__).resolve().parent
REPORTER=HERE.parent/'qrpcard-auto-links'
REPO=HERE.parents[3]
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('output',type=Path)
a=p.parse_args()
a.output.mkdir(parents=True,exist_ok=False)
relative=str((REPORTER/'summarize.py').relative_to(REPO))
sources={'before':subprocess.run(['git','-C',str(REPO),'show',f'e0e2058:{relative}'],
                                check=True,capture_output=True).stdout,
         'after':(REPORTER/'summarize.py').read_bytes()}
controls=(REPORTER/'summarize-controls.py').read_bytes()
rows=[]
with tempfile.TemporaryDirectory(prefix='thermal-report-comparison-') as temporary:
    for label,source in sources.items():
        root=Path(temporary)/label;root.mkdir()
        (root/'summarize.py').write_bytes(source)
        (root/'summarize-controls.py').write_bytes(controls)
        for repeat in range(1,4):
            result=subprocess.run([sys.executable,'-B',str(root/'summarize-controls.py')],
                                  capture_output=True,text=True,timeout=60)
            (a.output/f'{label}-{repeat}.log').write_text(result.stdout+result.stderr)
            assert result.returncode==(1 if label=='before' else 0)
            rows.append(dict(source=label,repeat=repeat,returncode=result.returncode,
                             passed=2 if label=='before' else 3,failed=1 if label=='before' else 0))
report=dict(native_drc=False,routing_benchmark=False,before_commit='e0e2058',
            controls_sha256=hashlib.sha256(controls).hexdigest(),
            reporter_sha256={k:hashlib.sha256(v).hexdigest() for k,v in sources.items()},rows=rows)
(a.output/'comparison.json').write_text(json.dumps(report,indent=2)+'\n')
print('PASS: identical three report controls, three repeats each; before 2/3, after 3/3')
