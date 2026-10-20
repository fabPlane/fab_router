import gzip,json
from pathlib import Path
from report import report
p=Path(__file__).resolve().parent
reference=json.loads(gzip.decompress((p/'../deferred-kind-spacing/results.json.gz').read_bytes()))['before']
for mode in ['missing','conflict','work','session']:
 data=json.loads(gzip.decompress((p/'results.json.gz').read_bytes()))
 for run in data:
  a=run['rows'][0]['attempts'][0]
  if mode=='missing':a['trace'].pop()
  if mode=='conflict':
   key=a['trace'][0]['key'];matches=[e for e in a['trace'] if e['key']==key]
   assert len(matches)>1
   matches[-1]['result']='{"ok":false,"observerCorruption":true}'
  if mode=='work':a['result']['work']+=1
  if mode=='session':run['rows'][0]['finalSesSha256']='corrupt'
 try:report(data,reference)
 except AssertionError:print(mode+': rejected')
 else:raise AssertionError(mode+' accepted')
