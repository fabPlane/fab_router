"""Profile three native-setting routes per version after timing runs complete."""
import argparse
import json
from collections import Counter
from pathlib import Path
import subprocess
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--run', type=Path, required=True)
parser.add_argument('--out', type=Path, required=True)
parser.add_argument('--baseline-source', type=Path, required=True)
parser.add_argument('--candidate-source', type=Path, required=True)
args = parser.parse_args()
case = args.run.resolve() / 'before/paperino-hw-paperino-shield-j4'
first = json.loads((case / 'results.json').read_text())[0]
work = case / first['evidence'] / 'work'
summary = {}
for version, source in [('before', args.baseline_source), ('after', args.candidate_source)]:
    out = args.out.resolve() / version
    out.mkdir(parents=True, exist_ok=False)
    with (out / 'route.log').open('w') as log:
        subprocess.run(['timeout', '600', 'bun', '--cpu-prof',
                        str(Path(__file__).with_name('profile-route.ts').resolve()),
                        str(source.resolve()), str(work), '3'], cwd=out, stdout=log,
                       stderr=subprocess.STDOUT, check=True)
    profile, = out.glob('*.cpuprofile')
    data = json.loads(profile.read_text())
    nodes = {n['id']: n['callFrame'] for n in data['nodes']}
    counts = Counter(nodes[s]['functionName'] for s in data['samples'])
    summary[version] = {'total_samples': len(data['samples']),
                        'self_samples': dict(counts.most_common()),
                        'routes': [json.loads(line) for line in (out / 'route.log').read_text().splitlines() if line.startswith('{')]}
assert [r['ses_sha256'] for r in summary['before']['routes']] == [r['ses_sha256'] for r in summary['after']['routes']]
(args.out / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps({v:{k:d[k] for k in ['total_samples','self_samples']} for v,d in summary.items()}, indent=2))
