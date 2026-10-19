#!/usr/bin/python3
"""Run real area checks and deliberately insufficient sampled-area mutation."""
import argparse
import contextlib
import io
import json
from pathlib import Path
import unittest
import pcbnew
import test_corridor


def sampled_coverage(copper, left, top, right, bottom):
    # Deliberately insufficient alternate implementation: matches the old three
    # lines on this x-oriented fixture, assumes coverage from samples alone.
    if left >= right or top >= bottom:
        raise ValueError('degenerate')
    filled = all(copper.Contains(pcbnew.VECTOR2I(x, y))
                 for x in range(left, right+1, 25000)
                 for y in (-127000, 0, 127000))
    return dict(missing_area_nm2=0 if filled else (right-left)*(bottom-top))


def run(out):
    assert pcbnew.Version() == '10.0.6'
    out.mkdir(parents=True, exist_ok=False)
    original = test_corridor.coverage
    rows = []
    for repeat in range(1, 4):
        for label, implementation in [('area', original), ('sampled-mutation', sampled_coverage)]:
            test_corridor.coverage = implementation
            stream = io.StringIO()
            suite = unittest.defaultTestLoader.loadTestsFromTestCase(test_corridor.CorridorTests)
            with contextlib.redirect_stderr(stream):
                result = unittest.TextTestRunner(stream=stream, verbosity=2).run(suite)
            (out/f'{repeat}-{label}.log').write_text(stream.getvalue())
            failed = len(result.failures)+len(result.errors)
            assert result.testsRun == 6
            assert failed == (0 if label == 'area' else 3), stream.getvalue()
            rows.append(dict(repeat=repeat, variant=label, passed=6-failed, failed=failed))
    test_corridor.coverage = original
    (out/'controls.json').write_text(json.dumps(rows, indent=2)+'\n')
    print(json.dumps(rows, indent=2))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, required=True)
    run(parser.parse_args().out.resolve())
