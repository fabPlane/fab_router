"""Reject corrupted repeat, shared-budget and rollback evidence."""
import copy,gzip,json,runpy
from pathlib import Path
here=Path(__file__).resolve().parent
saved_report=runpy.run_path(str(here/'report.py'))['saved_report']
data=json.loads(gzip.decompress((here/'saved-results.json.gz').read_bytes()))
saved_report(data)
for label,mutate in [
 ('work',lambda r:r['rows'][0]['attempts'][0]['result'].__setitem__('work',99999)),
 ('rollback',lambda r:r['rows'][0].__setitem__('rewind',False)),
 ('exact',lambda r:r['rows'][0]['attempts'][0].__setitem__('exact',1)),
 ('session',lambda r:r['rows'][0].__setitem__('finalSesSha256','corrupt')),
]:
 candidate=copy.deepcopy(data)
 # Change all six repeats: equality alone must not validate broken invariants.
 for mode in candidate:
  for run in candidate[mode]:mutate(run)
 try:saved_report(candidate)
 except AssertionError:print('PASS rejected',label)
 else:raise AssertionError('Accepted '+label)
