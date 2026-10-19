#!/usr/bin/python3
"""Three repeats with an explicit no-erosion mutation; no engine comparison."""
import argparse
import subprocess
from pathlib import Path
HERE = Path(__file__).resolve().parent
MUTATION = '''
import unittest
import test_necks as tests
original = tests.remote_after_erosion
def unshrunk(copper, anchor, box, radius, error):
    result = original(copper, anchor, box, radius, error)
    return original(copper, anchor, box, 0, error)
tests.remote_after_erosion = unshrunk
result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromModule(tests))
raise SystemExit(not result.wasSuccessful())
'''
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out',required=True,type=Path)
    out = parser.parse_args().out.resolve()
    out.mkdir(parents=True,exist_ok=False)
    for repeat in range(1,4):
        for name,args,expected in [('erosion',['test_necks.py'],0),('no-erosion-mutation',['-c',MUTATION],1)]:
            result = subprocess.run(['/usr/bin/python3','-B',*args],cwd=HERE,capture_output=True,text=True,timeout=30)
            (out/f'{repeat}-{name}.log').write_text(result.stdout+result.stderr)
            assert result.returncode == expected
            if expected:
                assert 'FAILED (failures=3)' in result.stderr
            print(repeat,name,result.returncode)
