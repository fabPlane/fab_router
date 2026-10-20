"""Replay captured decisions and native multisets independently, without native execution."""
import collections,json,pathlib,sys,hashlib
root=pathlib.Path(sys.argv[1]);rows=json.loads((root/'native-run/results.json').read_text())
assert len(rows)==78 and len({(r['case'],r['seed']) for r in rows})==78
witnesses=json.loads((root/'pad-differences.json').read_text())
assert {(r['case'],r['seed']) for r in witnesses}=={(r['case'],r['seed']) for r in rows if r['preflightError']}
def key(v):
 return json.dumps([v['type'],v['severity'],sorted([[i['pos']['x'],i['pos']['y'],i['description']] for i in v['items']],key=lambda i:json.dumps(i))],sort_keys=True)
for index,r in enumerate(rows):
 for path,digest in r['source_hashes'].items():
  if pathlib.Path(path).exists():assert hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()==digest
 if r['preflightError']:
  assert r['preflightError']=='Error: Candidate source pads differ from input' and not r['accepted'] and r['nativeChecks']==0
  continue
 d=json.loads((root/f'native-run/{index}.json').read_text());b=d['inputReport'];a=d['candidateReport']
 assert b['kicad_version']==a['kicad_version'] and b['coordinate_units']==a['coordinate_units']=='mm'
 assert sorted(b['included_severities'])==sorted(a['included_severities']) and 'error' in a['included_severities']
 assert b['ignored_checks']==a['ignored_checks']
 counts=collections.Counter(key(v) for v in b['violations'] if v['severity']=='error');new=[]
 for v in a['violations']:
  if v['severity']!='error':continue
  k=key(v)
  if counts[k]:counts[k]-=1
  else:new.append(v)
 assert collections.Counter(map(key,new))==collections.Counter(map(key,d['newErrors']))
 assert len(new)==r['new_errors'] and len(a['unconnected_items'])==r['opens_after']
 assert (not new and len(a['unconnected_items'])<=len(b['unconnected_items']))==r['accepted']==r['before_accepted']
for label,accepted in [('before',True),('after',False)]:
 controls=json.loads((root/f'controls-{label}/results.json').read_text());assert len(controls)==3
 assert all(c['accepted']==accepted for c in controls)
 if label=='before':
  for c in controls:
   d=json.loads((root/f"controls-before/report-{c['repeat']}.json").read_text())
   assert d['accepted'] and not d['newErrors'] and d['opensAfter']==0
   assert all(not [v for v in d[k]['violations'] if v['severity']=='error'] for k in ['inputReport','candidateReport'])
print('PASS: 78 decisions, exact drift witness membership, native report multisets, controls and available source hashes')
