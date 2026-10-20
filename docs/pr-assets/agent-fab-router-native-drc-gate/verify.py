"""Independent native-gate result replay; no router or native process invoked."""
import collections,hashlib,json,pathlib,sys
root=pathlib.Path(sys.argv[1]);rows=json.loads((root/'results.json').read_text())
def key(v):
 return json.dumps([v['type'],v['severity'],sorted([[i['pos']['x'],i['pos']['y'],i['description']] for i in v['items']],key=lambda x:json.dumps(x))],sort_keys=True)
for row in rows:
 d=json.loads((root/row['report']).read_text());before=d['inputReport'];after=d['candidateReport']
 assert before['coordinate_units']==after['coordinate_units']=='mm'
 assert before['kicad_version']==after['kicad_version']
 assert sorted(before['included_severities'])==sorted(after['included_severities']) and 'error' in before['included_severities']
 assert sorted(map(lambda x:json.dumps(x,sort_keys=True),before['ignored_checks']))==sorted(map(lambda x:json.dumps(x,sort_keys=True),after['ignored_checks']))
 counts=collections.Counter(key(v) for v in before['violations'] if v['severity']=='error');new=[]
 for v in after['violations']:
  if v['severity']!='error':continue
  k=key(v)
  if counts[k]:counts[k]-=1
  else:new.append(v)
 assert collections.Counter(key(v) for v in new)==collections.Counter(key(v) for v in d['newErrors'])
 assert len(new)==row['new_errors']==row['prior_new_errors']
 assert len(before['unconnected_items'])==d['opensBefore']==row['opens_before']
 assert len(after['unconnected_items'])==d['opensAfter']==row['opens_after']==row['prior_opens']
 accepted=not new and d['opensAfter']<=d['opensBefore']
 assert accepted==d['accepted']==row['accepted']==(row['exit_code']==0)
 for path,digest in row['source_hashes'].items():
  p=pathlib.Path(path)
  if p.exists():assert hashlib.sha256(p.read_bytes()).hexdigest()==digest
summary=json.loads((root/'summary.json').read_text())
assert len(rows)==summary['candidate_runs']==78
assert len(set(r['case'] for r in rows))==26
assert all(sorted(r['seed'] for r in rows if r['case']==case)==[1,2,3] for case in set(r['case'] for r in rows))
assert summary['accepted']==sum(r['accepted'] for r in rows)
assert summary['rejected']==sum(not r['accepted'] for r in rows)
assert summary['new_errors']==sum(r['new_errors'] for r in rows)
print('PASS: 78 independent decision/error/open/policy replays; 26 cases x 3 seeds; available source hashes verified')
