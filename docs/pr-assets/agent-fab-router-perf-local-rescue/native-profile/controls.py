"""Ensure each parity gate rejects a separately corrupted replay."""
import copy, json
from verify import read, verify

replay, reference = [json.loads(read(n)) for n in ['replay.json', 'reference.json']]
session, dsn = read('board.ses'), read('board.dsn')
verify(replay, reference, session, dsn)
for field in ['inputSha256', 'sesSha256', 'settings', 'stats', 'report']:
    bad = copy.deepcopy(replay)
    if field in ['inputSha256', 'sesSha256']:
        bad[field] = 'corrupt'
    elif field == 'settings':
        bad[field]['localRecovery'] = False
    elif field == 'stats':
        bad[field]['corruption'] = True
    else:
        bad[field]['incompleteAfter'] += 1
    try:
        verify(bad, reference, session, dsn)
    except AssertionError:
        continue
    raise AssertionError('accepted ' + field)
print('PASS: original parity and five independent corruptions rejected')
