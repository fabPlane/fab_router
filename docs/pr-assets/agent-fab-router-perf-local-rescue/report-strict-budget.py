"""Audit fresh S48 captures and plot them alongside the retained first pair."""
import argparse
import hashlib
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

p = argparse.ArgumentParser()
p.add_argument('captures', type=Path)
p.add_argument('out', type=Path)
a = p.parse_args()
root = Path(__file__).resolve().parents[3]
old = json.loads((Path(__file__).parent/'public-checks/slow.json').read_text())['rows']
old = [r for r in old if r['result']['id'] == 'routing-slow-issue555-cnh-strict']
assert len(old) == 2 and {r['mode'] for r in old} == {'normal', 'candidate'}
fresh = [json.loads(f.read_text()) for f in sorted(a.captures.glob('*-1.json'))]
assert len(fresh) == 2 and {r['mode'] for r in fresh} == {'normal', 'candidate'}
normal = next(r for r in fresh if r['mode'] == 'normal')
candidate = next(r for r in fresh if r['mode'] == 'candidate')
assert normal['sourceHashes'] == candidate['sourceHashes']
assert normal['boardSha256'] == candidate['boardSha256']
assert normal['case'] == candidate['case']
assert candidate['settings'] == {**normal['settings'], 'localRecovery': True}
assert normal['settings'] == normal['case']['settings']
prior_hashes = json.loads((Path(__file__).parent/'public-checks/source-hashes.json').read_text())
common = set(prior_hashes) & set(normal['sourceHashes'])
assert common and all(prior_hashes[k] == normal['sourceHashes'][k] for k in common)
assert all(r['result']['expected'] == normal['case']['expect'] for r in old)
for r in fresh:
    assert r['result']['expected'] == r['case']['expect']
    assert r['result']['pass'] and not r['result']['stub']
    m = r['result']['measured']
    assert m['violationsAdded'] == 0 and m['violations'] == m['violationsBefore'] == 16
    assert m['invariant:R-3'] and m['invariant:R-5']
    assert m['timedOut'] and m['stoppedBy'] == 'timeBudget' and not m['aborted']
    for name, digest in r['sourceHashes'].items():
        assert hashlib.sha256((root/name).read_bytes()).hexdigest() == digest, name
    assert hashlib.sha256((root/'spec/acceptance/boards'/r['case']['board']).read_bytes()).hexdigest() == r['boardSha256']

a.out.mkdir(parents=True, exist_ok=True)
summary = {'scope': 'S48 targeted diagnostic, one fresh repeat per mode; no native DRC or new full-suite run',
           'sourceUnchanged': True, 'normalRecoverySkipped': True,
           'priorSourceHashesMatched': len(common),
           'candidateRecoverySkipped': True,
           'skipEvidence': 'runRoute requires !outcome.timedOut before recoverRemaining; both captures report timedOut/timeBudget',
           'prior': old, 'fresh': [{k:r[k] for k in ['mode','startedUtc','finishedUtc','commit','result']} for r in fresh]}
(a.out/'summary.json').write_text(json.dumps(summary, indent=2)+'\n')
rows = [(f"Prior {r['mode']}", r['result']['measured']) for r in old]
rows += [(f"Fresh {r['mode']}", r['result']['measured']) for r in sorted(fresh, key=lambda r:r['mode'], reverse=True)]
fig, axes = plt.subplots(1, 2, figsize=(11, 4.5))
for ax, key, title in zip(axes, ['incomplete','passes'], ['Remaining connections','Completed passes']):
    vals = [m[key] for _, m in rows]
    bars = ax.bar(range(len(rows)), vals, color=['#64748b','#0f766e','#64748b','#0f766e'])
    ax.set_xticks(range(len(rows)), [label.replace(' ', '\n') for label,_ in rows])
    ax.bar_label(bars, padding=3)
    ax.set_ylim(0, max(vals)*1.2)
    ax.set_title(title)
fig.suptitle('S48: original 300 s budget, one sample per mode in each pair\nRecovery skipped; timing-sensitive progress is not a causal comparison', fontsize=11)
fig.tight_layout()
fig.savefig(a.out/'strict-budget.png', dpi=150, metadata={'Software':'strict-budget-report'})
plt.close(fig)
print(json.dumps({'verified':True,'rows':len(rows),'fresh':{r['mode']:r['result']['measured']['incomplete'] for r in fresh}}))
