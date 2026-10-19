#!/usr/bin/python3
"""Reject forged connectivity summaries against retained native boards."""
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile

here = Path(__file__).resolve().parent
source = Path(sys.argv[1]).resolve()
verifier = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else here / 'verify-geometry.py'
original = json.loads((source / 'summary.json').read_text())
controls = []
for repeat in range(3):
    for mutation in ('unchanged', 'empty-partitions', 'singleton-partitions'):
        summary = copy.deepcopy(original)
        for row in summary['rows']:
            if mutation == 'empty-partitions':
                row['groups'] = {}
            elif mutation == 'singleton-partitions':
                row['groups'] = {uid: [uid] for uid in row['groups']}
        with tempfile.TemporaryDirectory(prefix='thermal-partition-control-') as directory:
            out = Path(directory)
            for artifact in source.iterdir():
                if artifact.name != 'summary.json':
                    (out / artifact.name).symlink_to(artifact)
            (out / 'summary.json').write_text(json.dumps(summary))
            result = subprocess.run(['/usr/bin/python3', str(verifier), str(out)],
                                    capture_output=True, text=True, timeout=180)
            accepted = result.returncode == 0
            controls.append(dict(repeat=repeat+1, mutation=mutation, accepted=accepted))
            if accepted != (mutation == 'unchanged'):
                print(json.dumps(controls, indent=2))
                raise AssertionError((mutation, result.stdout, result.stderr))
            if not accepted:
                assert 'terminal groups differ from native board' in result.stderr, result.stderr
print(json.dumps(controls, indent=2))
