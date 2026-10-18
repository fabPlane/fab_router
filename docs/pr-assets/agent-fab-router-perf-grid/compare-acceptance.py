"""Compare complete slow acceptance reports, retaining failures and measured counters."""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('before', type=Path)
parser.add_argument('after', type=Path)
parser.add_argument('--out', type=Path, required=True)
args = parser.parse_args()
before, after = (json.loads(p.read_text()) for p in [args.before, args.after])
assert not before['invalidCases'] and not after['invalidCases']
b, a = ({c['id']: c for c in report['cases']} for report in [before, after])
assert b.keys() == a.keys() and len(b) == 63
regressions, changes = [], []
for key in sorted(b):
    old, new = b[key], a[key]
    assert old['kind'] == new['kind'] and not old['stub'] and not new['stub']
    if old['pass'] and not new['pass']:
        regressions.append({'id': key, 'field': 'pass'})
    for field in ['incomplete', 'violationsAdded', 'violations']:
        x, y = old['measured'].get(field), new['measured'].get(field)
        if isinstance(x, (int, float)) and isinstance(y, (int, float)) and y > x:
            regressions.append({'id': key, 'field': field, 'before': x, 'after': y})
    for field, value in old['measured'].items():
        if (field == 'ok' or field.startswith('invariant:')) and value is True and new['measured'].get(field) is not True:
            regressions.append({'id': key, 'field': field, 'before': value, 'after': new['measured'].get(field)})
    old_counters, new_counters = ({k: v for k, v in c['measured'].items() if k != 'wallClockMs'}
                                  for c in [old, new])
    if old_counters != new_counters:
        changes.append({'id': key, 'before': old['measured'], 'after': new['measured']})
result = {'before': before, 'after': after, 'regressions': regressions, 'measured_changes': changes,
          'caveat': 'Time-limited counters can differ. Router violations are not native DRC results.'}
args.out.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'before': before['summary'], 'after': after['summary'],
                  'regressions': regressions, 'changed_cases': [r['id'] for r in changes]}, indent=2))
if regressions:
    raise SystemExit(1)
