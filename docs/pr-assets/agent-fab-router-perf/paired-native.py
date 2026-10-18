"""Alternate baseline/candidate order per case; retain all three native-checked repeats."""
import argparse
import json
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--benchmark-checkout', type=Path, required=True)
parser.add_argument('--baseline-source', type=Path, required=True)
parser.add_argument('--candidate-source', type=Path, required=True)
parser.add_argument('--out', type=Path, required=True)
args = parser.parse_args()
bench = args.benchmark_checkout.resolve()
root = args.out.resolve()
suite = json.loads((bench / 'benchmarks/autorouter/suite.json').read_text())
cases = sorted(c['id'] for c in suite['cases'])
for index, case in enumerate(cases):
    for version in (['before', 'after'] if index % 2 == 0 else ['after', 'before']):
        source = args.baseline_source if version == 'before' else args.candidate_source
        out = root / version / case
        # Completed case directories can be resumed without replacing any evidence.
        summary = out / 'summary.json'
        if summary.exists() and json.loads(summary.read_text()).get('complete'):
            continue
        print(version, case, flush=True)
        command = ['python3', 'benchmarks/autorouter/benchmark.py', '--router', 'fab-router',
                   '--case', case, '--fab-router-source', str(source.resolve()), '--out', str(out)]
        # The frozen harness applies its own 3600-second safety stop per attempt.
        subprocess.run(command, cwd=bench, check=True)
for version in ['before', 'after']:
    rows = []
    for case in cases:
        case_rows = json.loads((root / version / case / 'results.json').read_text())
        for row in case_rows:
            row['evidence'] = str(Path(case) / row['evidence'])
        rows.extend(case_rows)
    (root / version / 'results.json').write_text(json.dumps(rows, indent=2) + '\n')
