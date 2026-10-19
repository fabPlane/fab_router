#!/usr/bin/python3
"""Reject two retained-evidence substitutions without touching the real evidence."""
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--source',required=True,type=Path);p.add_argument('--results',required=True,type=Path)
a=p.parse_args()
for mutation,marker in (('opens',"assert row['opens']==len(report['unconnected_items'])"),('rules','assert not drift')):
    with tempfile.TemporaryDirectory() as tmp:
        root=Path(tmp);summary=json.loads((a.results/'summary.json').read_text())
        if mutation=='opens':summary['rows'][0]['baseline']['opens']+=1
        (root/'summary.json').write_text(json.dumps(summary))
        for repeat in range(1,4):
            folder=root/f'repeat-{repeat}';folder.mkdir()
            for entry in (a.results/f'repeat-{repeat}').iterdir():
                if mutation=='rules' and repeat==1 and entry.name=='baseline':
                    shutil.copytree(entry,folder/entry.name)
                    rules=folder/entry.name/'board.kicad_dru';rules.write_bytes(rules.read_bytes()+b'\n')
                else:(folder/entry.name).symlink_to(entry.resolve(),target_is_directory=entry.is_dir())
        run=subprocess.run([sys.executable,'-B',str(Path(__file__).with_name('verify-auto-links.py')),
            '--source',str(a.source),'--results',str(root)],capture_output=True,text=True,timeout=120)
        assert run.returncode==1 and 'AssertionError' in run.stderr and marker in run.stderr,run.stderr
        print(f'PASS: altered {mutation} rejected at the intended check')
