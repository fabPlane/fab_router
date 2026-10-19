#!/usr/bin/python3
"""Repeat component controls and an intentionally aggregate-only mutation."""
import argparse
import subprocess
from pathlib import Path
HERE = Path(__file__).resolve().parent
MUTATION = '''
import unittest
import test_components as tests
from corridor import rectangle
original = tests.inspect_components
def aggregate(copper, strip, local_box):
    result = original(copper, strip, local_box)
    outside = copper.CloneDropTriangulation()
    outside.BooleanSubtract(rectangle(*local_box))
    result['remote_covering_components'] = [0] if result['union_strip_covered'] and outside.Area() > 0 else []
    return result
tests.inspect_components = aggregate
result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromModule(tests))
raise SystemExit(not result.wasSuccessful())
'''
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', required=True, type=Path)
    out = parser.parse_args().out.resolve()
    out.mkdir(parents=True, exist_ok=False)
    for i in range(1,4):
        for label,args,expected in [('components',['test_components.py'],0),('aggregate-mutation',['-c',MUTATION],1)]:
            result = subprocess.run(['/usr/bin/python3','-B',*args],cwd=HERE,capture_output=True,text=True,timeout=30)
            (out/f'{i}-{label}.log').write_text(result.stdout+result.stderr)
            assert result.returncode == expected, (label,result.returncode)
            if label == 'aggregate-mutation':
                assert 'FAILED (failures=2)' in result.stderr
            print(i,label,result.returncode)
