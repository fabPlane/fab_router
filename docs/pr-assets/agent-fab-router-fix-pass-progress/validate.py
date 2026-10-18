"""Check raw geometry, reports and callback evidence from audit.ts."""
import json
from pathlib import Path
p = Path(__file__).resolve().parent
before, after = [json.loads((p / f'{v}.json').read_text())['runs'] for v in ['before', 'after']]
assert len(before) == len(after) == 6
for x, y in zip(before, after):
    assert (x['repeat'], x['hooks']) == (y['repeat'], y['hooks'])
    for key in ['report', 'tracks', 'barrels', 'drc']:
        assert x[key] == y[key], key
    assert x['drc']['counts'] == {'violations': 0, 'incompletes': 1}
    if x['hooks']:
        assert len(x['events']) == len(y['events']) == 6
        assert sum(e['reported'] != e['actual'] for e in x['events']) == 4
        assert all(e['reported'] == e['actual'] for e in y['events'])
    else:
        assert x['events'] == y['events'] == []
for rows in [before, after]:
    for row in rows:
        for key in ['report', 'tracks', 'barrels', 'drc']:
            assert row[key] == rows[0][key], (row['repeat'], row['hooks'], key)
print('PASS: three repeats per version, identical reports/copper/DRC with and without hooks; all candidate events accurate')
