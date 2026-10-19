#!/usr/bin/python3
"""Reject unexplained recorded guard exceptions after rebinding manifest hashes."""
import argparse
import copy
import gzip
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--results', type=Path, required=True)
    p.add_argument('--source', type=Path, required=True)
    p.add_argument('--out', type=Path, required=True)
    a = p.parse_args()
    a.out.mkdir(parents=True, exist_ok=False)
    summary_path = a.results/'summary.json'
    summary = json.loads(summary_path.read_bytes() if summary_path.exists() else gzip.decompress(
        summary_path.with_suffix('.json.gz').read_bytes()))
    results = []
    for label in ('unexplained-guard', 'wrong-exception'):
        changed = copy.deepcopy(summary)
        # The first candidate has an unchanged saved design and native rules.
        attempt = changed['rows'][0]['attempts'][0]
        assert attempt['exception'] is None and attempt['accepted'] is False
        attempt.update(exception='ValueError' if label == 'unexplained-guard' else 'RuntimeError', row=None)
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for path in a.results.iterdir():
                if path.name not in ('summary.json', 'summary.json.gz', 'manifest.json'):
                    (root/path.name).symlink_to(path.resolve(), target_is_directory=path.is_dir())
            (root/'summary.json').write_text(json.dumps(changed)+'\n')
            manifest = json.loads((a.results/'manifest.json').read_text())
            manifest.pop('summary.json.gz', None)
            manifest['summary.json'] = hashlib.sha256((root/'summary.json').read_bytes()).hexdigest()
            (root/'manifest.json').write_text(json.dumps(manifest)+'\n')
            cmd = [sys.executable, str(Path(__file__).with_name('verify-generated-transaction.py')),
                   str(root), '--source', str(a.source)]
            run = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
        (a.out/(label+'.log')).write_text(run.stdout+run.stderr)
        assert run.returncode != 0 and 'AssertionError' in run.stderr
        if label == 'unexplained-guard':
            assert 'unexplained native design rejection' in run.stderr
        results.append(dict(name=label, rejected=True, exit_code=run.returncode))
    (a.out/'summary.json').write_text(json.dumps(results, indent=2)+'\n')
    print('PASS: unexplained guard rejection and wrong exception rejected despite rebound manifests')


if __name__ == '__main__':
    main()
