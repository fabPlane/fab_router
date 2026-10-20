"""Validate a complete engine replay and summarize its sampled CPU profile."""
from pathlib import Path
from collections import Counter
import gzip, hashlib, json, sys

HERE = Path(__file__).resolve().parent

def read(name):
    return gzip.decompress((HERE / (name + '.gz')).read_bytes())

def verify(replay, reference, session, dsn):
    assert replay['inputSha256'] == hashlib.sha256(dsn).hexdigest(), 'input'
    assert replay['sesSha256'] == hashlib.sha256(session).hexdigest(), 'session hash'
    assert session.decode() == reference['result']['ses'], 'reference session'
    assert replay['settings'] == reference['result']['report']['effectiveSettings'], 'settings'
    assert replay['stats'] == reference['result']['statsAfter'], 'stats'
    actual = {k: v for k, v in replay['report'].items() if k != 'wallClockMs'}
    expected = {k: v for k, v in reference['result']['report'].items() if k != 'wallClockMs'}
    assert actual == expected, 'report excluding elapsed time'

if __name__ == '__main__':
    replay, reference = [json.loads(read(n)) for n in ['replay.json', 'reference.json']]
    verify(replay, reference, read('board.ses'), read('board.dsn'))
    profile = json.loads(read('production.cpuprofile'))
    assert len(profile['samples']) == len(profile['timeDeltas'])
    nodes = {n['id']: n for n in profile['nodes']}
    parents = {child: n['id'] for n in profile['nodes'] for child in n.get('children', [])}
    totals = Counter()
    ring_phases = Counter()
    ring_callers = Counter()
    for node, delta in zip(profile['samples'], profile['timeDeltas']):
        frame = nodes[node]['callFrame']
        key = (frame['functionName'], frame['url'].split('/fr-perf/')[-1], frame['lineNumber'] + 1)
        totals[key] += delta
        if frame['functionName'] == 'pointInRing':
            names = []
            current = node
            while current in nodes:
                names.append(nodes[current]['callFrame']['functionName'])
                current = parents.get(current)
            ring_phases['recovery' if 'recoverRemaining' in names else 'outside_recovery'] += delta
            ring_callers[names[1] if len(names) > 1 else '(root)'] += delta
    result = {'parity': True, 'samples': len(profile['samples']),
              'sampled_ms': sum(profile['timeDeltas']) / 1000,
              'pointInRing_phase_self_ms': {k: v / 1000 for k, v in sorted(ring_phases.items())},
              'pointInRing_caller_self_ms': {k: v / 1000 for k, v in sorted(ring_callers.items())},
              'top_self': [{'function': k[0], 'file': k[1], 'line': k[2], 'ms': v / 1000}
                           for k, v in totals.most_common(15)]}
    Path(sys.argv[1]).write_text(json.dumps(result, indent=2) + '\n')
