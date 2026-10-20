"""Compare retained native decisions and audit the three changed-net controls."""
import collections,json,pathlib,sys
prior,current,controls=map(pathlib.Path,sys.argv[1:])
a=json.loads((prior/'results.json').read_text());b=json.loads((current/'results.json').read_text())
assert len(a)==len(b)==78
def errors(report):
 return collections.Counter(json.dumps(v,sort_keys=True) for v in report['violations'] if v['severity']=='error')
witness_differences=[]
for x,y in zip(a,b):
 for key in ['case','seed','accepted','new_errors','opens_before','opens_after','source_hashes','exit_code']:
  assert x[key]==y[key],(y['case'],y['seed'],key)
 old=json.loads((prior/x['report']).read_text());new=json.loads((current/y['report']).read_text())
 for key in ['inputReport','candidateReport']:
  r,s=old[key],new[key]
  for field in ['coordinate_units','kicad_version','included_severities','ignored_checks']:assert r[field]==s[field]
  assert errors(r)==errors(s)
  if r['unconnected_items']!=s['unconnected_items']:witness_differences.append([y['case'],y['seed'],key])
for repeat in range(1,4):
 old=json.loads((controls/'controls-before'/f'report-{repeat}.json').read_text())
 assert old['accepted'] and not old['newErrors'] and old['opensBefore']==old['opensAfter']==0
 for key in ['inputReport','candidateReport']:
  assert not errors(old[key]) and not old[key]['unconnected_items']
  assert [v['type'] for v in old[key]['violations']]==['track_dangling']
  assert all(v['severity']=='warning' for v in old[key]['violations'])
 for stage in ['controls-before','controls-after']:
  root=controls/stage
  before=(root/f'before-{repeat}.kicad_pcb').read_bytes();after=(root/f'after-{repeat}.kicad_pcb').read_bytes()
  assert after==before.replace(b'(net 1 "GND")',b'(net 1 "VCC")')
  assert (root/f'before-{repeat}.kicad_pro').read_bytes()==(root/f'after-{repeat}.kicad_pro').read_bytes()==b'{}'
 after=json.loads((controls/'controls-after/results.json').read_text())[repeat-1]
 assert not after['accepted'] and after['error']=='Error: Candidate net table differs from input'
print(json.dumps(dict(paired_decisions=78,net_rename_controls=3,all_native_error_and_open_counts_preserved=True,connectivity_witness_differences=witness_differences),indent=2))
