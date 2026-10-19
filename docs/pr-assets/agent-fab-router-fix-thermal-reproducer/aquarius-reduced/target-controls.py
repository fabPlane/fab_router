#!/usr/bin/python3
"""Reject forged target claims while accepting retained native evidence unchanged."""
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile

here = Path(__file__).resolve().parent
source = Path(sys.argv[1]).resolve()
original = json.loads((source / 'summary.json').read_text())
controls = []
for repeat in range(3):
    for mutation in ('unchanged', 'omitted-target', 'invented-target', 'wrong-pad'):
        summary = copy.deepcopy(original)
        if mutation == 'omitted-target':
            summary['rows'][0]['target'] = []
        elif mutation == 'invented-target':
            summary['rows'][0]['target'].append(copy.deepcopy(summary['rows'][0]['target'][0]))
        elif mutation == 'wrong-pad':
            summary['pad_uuid'] = '00000000-0000-0000-0000-000000000000'
        with tempfile.TemporaryDirectory(prefix='thermal-target-control-') as directory:
            out = Path(directory)
            for artifact in source.iterdir():
                if artifact.name != 'summary.json':
                    (out / artifact.name).symlink_to(artifact)
            (out / 'summary.json').write_text(json.dumps(summary))
            result = subprocess.run([sys.executable, str(here / 'verify-geometry.py'), str(out)],
                                    capture_output=True, text=True, timeout=60)
            accepted = result.returncode == 0
            assert accepted == (mutation == 'unchanged'), (mutation, result.stdout, result.stderr)
            if not accepted:
                assert 'target findings differ from native report' in result.stderr
            controls.append(dict(repeat=repeat+1, mutation=mutation, accepted=accepted))
print(json.dumps(controls, indent=2))
