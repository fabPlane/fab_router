"""Independently replay captured native decisions and exact published bytes; no native execution."""
import argparse,base64,collections,hashlib,json,pathlib
p=argparse.ArgumentParser();p.add_argument('root',type=pathlib.Path);x=p.parse_args();s=x.root
sha=lambda b:hashlib.sha256(b).hexdigest()
def errors(r):
 return collections.Counter(json.dumps([v['type'],v['severity'],sorted((i['description'],i['pos']['x'],i['pos']['y']) for i in v['items'])]) for v in r['violations'] if v['severity']=='error')
def validate(d,result,bundlepath,inputrole='input',candidaterole='candidate'):
 before,after=result['inputReport'],result['candidateReport']
 for policy in ['coordinate_units','kicad_version','included_severities','ignored_checks']:assert before[policy]==after[policy]
 new=errors(after)-errors(before)
 assert sum(new.values())==len(result['newErrors'])
 assert errors(dict(violations=result['newErrors']))==new
 assert result['opensBefore']==len(before['unconnected_items'])
 assert result['opensAfter']==len(after['unconnected_items'])
 assert result['accepted']==(not new and result['opensAfter']<=result['opensBefore'])
 for role,key in [(inputrole,'inputSha256'),(candidaterole,'candidateSha256')]:assert sha((d/role/'board.kicad_pcb').read_bytes())==result[key]
 if 'published' not in result:return
 assert result['published']==result['accepted']==bundlepath.exists()
 if not result['published']:return
 b=json.loads(bundlepath.read_text());assert b['format']=='fab-router-native-candidate-v1'
 assert b['validation']=={k:v for k,v in result.items() if k!='published'}
 for role,target in [('input',inputrole),('candidate',candidaterole)]:
  assert {f['name'] for f in b[role]}=={f.name for f in (d/target).iterdir()}
  for f in b[role]:
   data=base64.b64decode(f['base64'],validate=True);assert sha(data)==f['sha256'];assert data==(d/target/f['name']).read_bytes()
rows=json.loads((s/'native/results.json').read_text());assert len(rows)==78
assert len({(r['case'],r['seed']) for r in rows})==78
assert set(collections.Counter(r['case'] for r in rows).values())=={3}
for row in rows:
 d=s/'native'/row['directory'];a=json.loads((d/'before.json').read_text());b=json.loads((d/'after.json').read_text())
 for k in ['accepted','newErrors','opensBefore','opensAfter','inputSha256','candidateSha256']:assert a[k]==b[k]
 for report in ['inputReport','candidateReport']:assert errors(a[report])==errors(b[report])
 for f,digest in row['source_hashes'].items():assert sha((d/f).read_bytes())==digest
 validate(d,a,d/'unused');validate(d,b,d/'bundle.json')
summary=json.loads((s/'native/summary.json').read_text())
assert summary['cases']==26 and summary['runs']==78 and summary['native_checks']==312
assert sum(r['published'] for r in rows)==summary['published']==69
assert sum(r['new_errors'] for r in rows)==summary['new_errors']==27
assert sum(r['opens'] for r in rows)==summary['opens']==120
assert sum(r['prior_passed'] for r in rows)==summary['underlying_passed']==39
repairs=json.loads((s/'repairs/results.json').read_text());assert len(repairs)==6
for row in repairs:
 d=s/'repairs'/str(row['repeat']);role=row['role'];result=json.loads((d/(role+'.json')).read_text())
 validate(d,result,d/(role+'.bundle.json'),candidaterole=role)
 assert result['published']==(role=='repaired') and result['opensAfter']==0
 assert len(result['newErrors'])==(2 if role=='unsafe' else 0)
# Initial comparison stopped only because independent native timestamps differed.
d=s/'native-timestamp-stop/000';a=json.loads((d/'before.json').read_text());b=json.loads((d/'after.json').read_text())
assert {k:v for k,v in a.items() if k not in ['inputReport','candidateReport']}=={k:v for k,v in b.items() if k not in ['inputReport','candidateReport','published']}
for key in ['inputReport','candidateReport']:assert {k:v for k,v in a[key].items() if k!='date'}=={k:v for k,v in b[key].items() if k!='date'}
validate(d,b,d/'bundle.json')
print(json.dumps(dict(full_pairs=78,paired_native_checks=312,published=69,rejected=9,new_thermal_errors=27,underlying_opens=120,repair_checks=12,clean_repairs_published=3,unsafe_repairs_blocked=3,timestamp_stop_native_checks=4,exact_bundle_bytes=True,router_rerun=False),indent=2))
