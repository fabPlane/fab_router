#!/usr/bin/python3
"""Exercise a native-validated, in-memory transaction on the compact witness.

Diagnostic only: the candidate is the previously measured fixed displacement;
this is neither a router integration nor a general thermal repair algorithm.
"""
import argparse
from collections import Counter
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import native

HERE = Path(__file__).resolve().parent

def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, HERE / filename)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result

reducer = module('reducer', 'reduce-repair.py')
terminals = module('terminals', 'terminal-partitions.py')

def errors(row):
    return Counter(json.dumps(error, sort_keys=True) for error in row['errors'])

def transact(original, candidate, baseline, check):
    """Return original bytes on rejection or checker exception; publish only validated bytes."""
    try:
        row = check(candidate)
        accepted = (errors(row) < errors(baseline)
                    and row['groups'].keys() == baseline['groups'].keys()
                    and not terminals.lost_pairs(baseline['groups'], row['groups'])
                    and row['opens'] <= baseline['opens'])
        return (candidate if accepted else original), accepted, row, None
    except Exception as exc:
        return original, False, None, type(exc).__name__

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source', type=Path, required=True)
    p.add_argument('--out', type=Path, required=True)
    a = p.parse_args()
    a.out.mkdir(parents=True, exist_ok=False)
    assert native.pcbnew.Version() == '10.0.6'
    native.SRC, native.D, native.TARGET = a.source, a.out, reducer.TARGET
    sha = lambda data: hashlib.sha256(data).hexdigest()
    sources = {str(a.source.with_suffix(ext)): sha(a.source.with_suffix(ext).read_bytes())
               for ext in ('.kicad_pcb', '.kicad_pro', '.kicad_dru')}
    original = a.source.read_bytes()
    nodes = native.parse(original.decode())
    def check(data, name):
        row = native.check(native.parse(data.decode()), name)
        row['groups'] = terminals.partition(native.pcbnew.LoadBoard(str(a.out/name/'board.kicad_pcb')))
        return row
    baseline = check(original, 'baseline')
    assert len(baseline['errors']) == len(baseline['target']) == 1
    repaired = (native.dump(reducer.repair(nodes))+'\n').encode()
    # Move a connected terminal away from its group without changing its UUID.
    disconnected = reducer.repair(nodes)
    connected = next(key for key, group in baseline['groups'].items() if len(group) > 1)
    pad = next(c for n in disconnected if isinstance(n, list) and n[0] == 'footprint'
               for c in n if isinstance(c, list) and c[0] == 'pad' and native.uid(c) == connected)
    native.child(pad, 'at')[1:3] = ['1000', '1000']
    missing_pad = copy.deepcopy(reducer.repair(nodes))
    footprint = next(n for n in missing_pad if isinstance(n, list) and n[0] == 'footprint'
                     and any(isinstance(c, list) and c[0] == 'pad' and native.uid(c) == connected for c in n))
    footprint.remove(next(c for c in footprint if isinstance(c, list) and c[0] == 'pad'
                              and native.uid(c) == connected))
    candidates = [('repair', repaired), ('unchanged', original),
                  ('disconnected', (native.dump(disconnected)+'\n').encode()),
                  ('missing-pad', (native.dump(missing_pad)+'\n').encode())]
    rows = []
    for repeat in range(1, 4):
        for label, candidate in candidates:
            name = f'{label}-{repeat}'
            output, accepted, row, exception = transact(original, candidate, baseline,
                                                       lambda data: check(data, name))
            assert accepted == (label == 'repair'), name
            assert output == (candidate if accepted else original)
            (a.out/f'{name}.kicad_pcb').write_bytes(output)
            rows.append(dict(name=name, accepted=accepted, byte_rollback=not accepted and output == original,
                             output_sha256=sha(output), candidate_sha256=sha(candidate), row=row, exception=exception))
        for label, failure in [('timeout', TimeoutError), ('checker-error', RuntimeError)]:
            def fail(data):
                raise failure('injected checker failure')
            output, accepted, row, exception = transact(original, repaired, baseline, fail)
            assert output == original and not accepted and exception == failure.__name__
            rows.append(dict(name=f'{label}-{repeat}', accepted=False, byte_rollback=True, exception=exception))
    assert sources == {name: sha(Path(name).read_bytes()) for name in sources}
    (a.out/'summary.json').write_text(json.dumps(dict(production_fix=False, routing_benchmark=False,
        input_sha256=sources, baseline=baseline, rows=rows), indent=2)+'\n')
    print('PASS: repair accepted 3/3; 15 rejected transactions preserve exact input bytes')

if __name__ == '__main__':
    main()
