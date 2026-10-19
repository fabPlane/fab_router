"""Bind portable replay output to all six native checks and unchanged runtime."""
from pathlib import Path
import json,hashlib,sys
s=Path(sys.argv[1]);sha=lambda b:hashlib.sha256(b).hexdigest()
rows=[]
for i in range(1,4):
 p=s/f'final{i}';r=json.loads((p/'probe.json').read_text())['rows'][0]
 assert len(r['pending'])==1 and not r['remaining'] and r['exact']['violations']==0
 assert [(t['anchor']['from'],t['anchor']['to'],t['result']['status'])for t in r['targets'][0]['trials']]==[(29,46,'exhausted'),(8,19,'kept')]
 assert [t['result']['expansions']for t in r['targets'][0]['trials']]==[14509,4257]
 for m in ['before','after']:
  name=f'photon-sprinkler-sprinkler-j3-{m}.ses'
  data=(p/name).read_bytes()
  assert data==(s/'probe'/name).read_bytes()
  for repeat in range(1,4):assert data==(s/f'native-probe/{m}-{repeat}/board.ses').read_bytes()
  assert sha(data)==r[m+'Sha256']
 rows.append({'seed':i,'before':r['beforeSha256'],'after':r['afterSha256'],'seconds':[t['seconds']for t in r['targets'][0]['trials']]})
assert len({r['after']for r in rows})==1
print(json.dumps({'scope':'Three portable residual replays, bound to six prior fresh native checks; not fresh end-to-end benchmark','rows':rows},indent=2))
