"""Validate all raw paired session bytes and bind them to the full native comparison."""
import gzip,hashlib,json,sys
from pathlib import Path
here=Path(__file__).resolve().parent
rows=json.loads(gzip.decompress((here/'native-sessions.json.gz').read_bytes()))
comparison=json.loads((here/'native-comparison.json').read_text())
assert len(rows)==len(comparison['attempts'])==78
keys={(r['case'],r['seed'])for r in rows};assert len(keys)==78
assert keys=={(r['case'],r['seed'])for r in comparison['attempts']}
for row in rows:
 assert row['before']==row['after'],'Changed session'
 for mode in ['before','after']:
  assert hashlib.sha256(row[mode].encode()).hexdigest()==row[mode+'Sha256'],'Session digest'
assert comparison['same_sessions']==78
print('PASS: all 78 paired raw sessions are byte-identical')
