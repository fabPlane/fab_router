#!/usr/bin/python3
"""Replay two published proposals sequentially; diagnostic only, no routing claim."""
import argparse
import gzip
import hashlib
import json
from pathlib import Path
import native
import transaction

generated = transaction.module('generated', 'generated-transaction.py')
HERE = Path(__file__).resolve().parent


def read(path):
    return path.read_bytes() if path.exists() else gzip.decompress(Path(str(path)+'.gz').read_bytes())


def advance(current, baseline, candidate, check):
    output, accepted, row, exception = transaction.transact(current, candidate, baseline, check)
    return output, row if accepted else baseline, accepted, exception


def controls():
    error = lambda x: dict(type=x)
    initial = dict(errors=[error('a'), error('b')], groups={'p': ['p']}, opens=1)
    improved = dict(errors=[error('b')], groups={'p': ['p']}, opens=1)
    state, row, ok, _ = advance(b'original', initial, b'first', lambda _: improved)
    assert ok and state == b'first' and row == improved
    state2, row2, ok, _ = advance(state, row, b'stale', lambda _: initial)
    assert not ok and state2 == state and row2 == row
    def fail(_):
        raise TimeoutError()
    state2, row2, ok, exception = advance(state, row, b'candidate', fail)
    assert not ok and state2 == state and row2 == row and exception == 'TimeoutError'
    print('PASS: accepted baseline advances; rejection and timeout preserve latest accepted state')


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--out', type=Path)
    p.add_argument('--controls', action='store_true')
    a = p.parse_args()
    if a.controls:
        controls()
        return
    assert a.out
    a.out.mkdir(parents=True, exist_ok=False)
    native.SRC, native.D, native.TARGET = HERE/'rank8-target-results/source.kicad_pcb', a.out, ''
    original = read(native.SRC)
    assert original == read(HERE/'full-generated-results/source.kicad_pcb')
    witnesses = []
    for directory in ('full-generated-results', 'rank8-target-results'):
        summary = json.loads(read(HERE/directory/'summary.json'))
        row = next(r for r in summary['rows'] if r['accepted'])
        attempt = row['attempts'][-1]
        witnesses.append((row, attempt, row['nearby'][attempt.get('track_rank', 1)-1]))
    sha = lambda data: hashlib.sha256(data).hexdigest()
    def check(data, name):
        row = native.check(native.parse(data.decode()), name)
        row['groups'] = transaction.terminals.partition(native.pcbnew.LoadBoard(str(a.out/name/'board.kicad_pcb')))
        return row
    results = []
    for repeat in range(1, 4):
        baseline = check(original, f'baseline-{repeat}')
        current, live = original, baseline
        steps = []
        for index, (witness, attempt, info) in enumerate(witnesses):
            candidate = next(data for scale, delta, data in generated.proposals(
                native.parse(current.decode()), info, witness['stored_gap_nm']) if scale == attempt['scale'])
            before = current
            current, live, accepted, exception = advance(current, live, candidate,
                lambda data: check(data, f'candidate-{repeat}-{index}'))
            assert accepted and exception is None
            assert transaction.errors(live) < transaction.errors(baseline)
            assert not transaction.terminals.lost_pairs(baseline['groups'], live['groups'])
            assert live['groups'].keys() == baseline['groups'].keys()
            steps.append(dict(pad_uuid=witness['pad_uuid'], track_uuid=info['uuid'], scale=attempt['scale'],
                before_sha256=sha(before), selected_sha256=sha(current), row=live))
        replay = check(current, f'replay-{repeat}')
        assert transaction.errors(replay) == transaction.errors(live)
        assert replay['groups'] == live['groups'] and replay['opens'] == live['opens']
        (a.out/f'selected-{repeat}.kicad_pcb').write_bytes(current)
        results.append(dict(repeat=repeat, baseline=baseline, steps=steps, selected_sha256=sha(current), replay=replay))
    assert len({r['selected_sha256'] for r in results}) == 1
    (a.out/'summary.json').write_text(json.dumps(dict(production_fix=False, routing_benchmark=False,
        source_sha256=sha(original), rows=results), indent=2)+'\n')
    print('PASS: both proposals compose in all three repeats; independent native replay agrees')


if __name__ == '__main__':
    main()
