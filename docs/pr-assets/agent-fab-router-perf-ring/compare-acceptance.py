"""Compare two complete slow acceptance reports without discarding failures."""
import argparse
import json
from pathlib import Path
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('before', type=Path)
parser.add_argument('after', type=Path)
parser.add_argument('--out', type=Path, required=True)
args = parser.parse_args()
b, a = [json.loads(p.read_text()) for p in [args.before, args.after]]
bc, ac = [{c['id']:c for c in d['cases']} for d in [b,a]]
assert len(bc) == len(ac) == 63 and bc.keys() == ac.keys()
assert not b['invalidCases'] and not a['invalidCases']
assert not b['acceptStubs'] and not a['acceptStubs']
changes = []
for case in sorted(bc):
    before, after = bc[case], ac[case]
    assert before['expected'] == after['expected']
    measured = [r.get('measured', {}) for r in [before, after]]
    for field in ['violations','incomplete']:
        if field in measured[0]: assert field in measured[1], (case, 'missing counter', field)
    violations = [max(0, m.get('violations',0)-m.get('violationsBefore',0)) for m in measured]
    assert violations[1] <= violations[0], (case, 'increased router violations', violations)
    fields = ['pass','stub']
    row = {'id':case}
    for field in fields:
        if before[field] != after[field]:row[field] = [before[field],after[field]]
    for field in ['incomplete','completed','passes','timedOut','stoppedBy']:
        values = [m.get(field) for m in measured]
        if values[0] != values[1]:row[field] = values
    if len(row) > 1:changes.append(row)
result = {'before':b, 'after':a, 'changes':changes,
          'pass_regressions':sorted(c for c in bc if bc[c]['pass'] and not ac[c]['pass']),
          'incomplete_increases':sorted(c for c in bc if ac[c].get('measured',{}).get('incomplete',0)>bc[c].get('measured',{}).get('incomplete',0))}
args.out.write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:result[k] for k in ['changes','pass_regressions','incomplete_increases']},indent=2))
print('summaries',b['summary'],a['summary'])
