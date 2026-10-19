#!/usr/bin/python3
"""Reject forged reduced-witness groups, errors and accepted-deletion records."""
import argparse
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('results', type=Path)
p.add_argument('--out', type=Path, required=True)
a = p.parse_args()
a.out.mkdir(exist_ok=False, parents=True)
base = json.loads((a.results/'summary.json').read_text())
rows = []
for repeat in range(1,4):
    for label in ('unchanged','groups','errors','accepted'):
        s = copy.deepcopy(base)
        if label == 'groups':
            row = s['rows'][-1]['rows'][1]
            key = next(iter(row['groups']))
            del row['groups'][key]
        elif label == 'errors':
            s['rows'][-1]['rows'][0]['errors'] = []
        elif label == 'accepted':
            s['rows'][0]['accepted'] = False
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for f in a.results.iterdir():
                if f.is_dir(): (root/f.name).symlink_to(f.resolve(),target_is_directory=True)
            (root/'summary.json').write_text(json.dumps(s))
            r = subprocess.run([sys.executable,str(Path(__file__).with_name('verify-repair-reduction.py')),str(root)],capture_output=True,text=True,timeout=120)
            (a.out/f'{label}-{repeat}.log').write_text(r.stdout+r.stderr)
            assert (r.returncode == 0) == (label == 'unchanged')
            rows.append(dict(repeat=repeat, mutation=label, accepted=r.returncode==0))
(a.out/'summary.json').write_text(json.dumps(rows,indent=2)+'\n')
print('PASS: unchanged accepted 3/3; forged summaries rejected 9/9')
