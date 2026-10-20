import collections,hashlib,json,pathlib,statistics,sys
root=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else pathlib.Path(__file__).resolve().parent
read=lambda p:json.loads(p.read_text())
import importlib.util
from decimal import Decimal, InvalidOperation
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('native',root/'old-native-thermal-proposals.py');native=importlib.util.module_from_spec(spec);sys.modules[spec.name]=native;spec.loader.exec_module(native)
def canonical(node):
 if isinstance(node,list) and node[0]=='segment':
  # Reversing endpoints leaves the exact physical segment unchanged. Native
  # import regenerates IDs, which can reverse the sorted pair's direction.
  ends=tuple(sorted(tuple(Decimal(v).normalize() for v in native.child(node,k)[1:]) for k in ('start','end')))
  return ('segment',ends,tuple(canonical(n) for n in node[1:] if not (isinstance(n,list) and n[0] in ('uuid','tstamp','start','end'))))
 if isinstance(node,list):return tuple(canonical(n) for n in node if not (isinstance(n,list) and n[0] in ('uuid','tstamp')))
 try:return str(Decimal(node).normalize()) if not node.startswith('"') else node
 except InvalidOperation:return node
def copper(path):
 return sorted(repr(canonical(n)) for n in native.parse(path.read_text()) if isinstance(n,list) and n[0] in ('segment','arc','via'))
controls=[read(root/phase/'controls.json') for phase in ('optional-before','optional-after')]
for c in controls:
 assert c['complete'] and c['controls_preserved'] and not c['interrupted']
 assert c['allowed_cpus']==[20,21,22,23,24,25] and c['seeds']==[1,2,3]
for field in ('order','inputs_sha256','harness_sha256','runtime_sha256','runtime_source_sha256','allowed_cpus','cases','seeds'):
 assert controls[0][field]==controls[1][field],field
assert controls[0]['candidate']['source_sha256']==controls[1]['candidate']['source_sha256']
# Copied configurations may differ only in the selected engine checkout.
configs=[]
for phase,control in zip(('optional-before','optional-after'),controls):
 text=(root/(phase+'-configs')/'fab-router.json').read_text()
 configs.append(text.replace(control['candidate']['path'],'<engine>'))
assert configs[0]==configs[1]

key=lambda row:(row['case'],row['seed'])
before={key(r):r for r in read(root/'optional-before/results.json')}
after={key(r):r for r in read(root/'optional-after/results.json')}
assert before.keys()==after.keys() and len(before)==78
regressions=[];changes=[];dispositions=collections.Counter();changed_boards=[];repair_attempt_counts=[]
for k,b in before.items():
 a=after[k]
 assert copper(root/'optional-before'/b['evidence']/'work/output.kicad_pcb')==copper(root/'optional-after'/a['evidence']/'work/output.kicad_pcb'),(k,'physical copper changed')
 for name in ('board.dsn','board.ses'):
  assert (root/'optional-before'/b['evidence']/'work'/name).read_bytes()==(root/'optional-after'/a['evidence']/'work'/name).read_bytes(),(k,name)
 if a['status']!='checked' or a['opens']>b['opens'] or a['new_errors']>b['new_errors'] or (b['passed'] and not a['passed']) or a['failed_fidelity']!=b['failed_fidelity']: regressions.append(k)
 for field in ('fidelity','integrity_checks','ignored_checks','new_warnings','new_warning_types'):
  assert a['check'][field]==b['check'][field],(k,field)
 if a['new_errors']==b['new_errors']:
  assert a['vias']==b['vias'],(k,'unchanged via count')
 if any(a[f]!=b[f] for f in ('passed','opens','new_errors','new_error_types','failed_fidelity')): changes.append({'case':k[0],'seed':k[1],'before':{f:b[f] for f in ('passed','opens','new_errors','new_error_types')},'after':{f:a[f] for f in ('passed','opens','new_errors','new_error_types')}})
 work=root/'optional-after'/a['evidence']/'work/native-thermal-postprocess'
 disposition=read(work/'postprocess.json');dispositions[disposition['status']]+=1
 if disposition['applied']:
  bundle=read(work/'accepted.json')
  import base64
  for role in ('input','routed'):
   for f in bundle[role]: assert hashlib.sha256(base64.b64decode(f['base64'])).hexdigest()==f['sha256']
  assert bundle['validation']['accepted'] and bundle['validation']['newErrors']==[]
  assert bundle['validation']['lostTerminalPairs']==bundle['validation']['repair']['lostTerminalPairs']==0
  out=root/'optional-after'/a['evidence']/'work/output.kicad_pcb'
  assert out.read_bytes()==base64.b64decode(bundle['candidate'][0]['base64'])
  if bundle['routed'][0]['sha256']!=bundle['candidate'][0]['sha256']:
   changed_boards.append(k)
   old_search=read(root/'optional-before'/b['evidence']/'work/native-thermal-postprocess/search/result.json')
   new_search=read(work/'search/result.json')
   assert len(old_search['attempts'])==len(new_search['attempts']),(k,'native proposal check count changed')
   sequence=lambda v:[(a['stage'],a['name'],a['progress'])for a in v['attempts']]
   assert sequence(old_search)==sequence(new_search),(k,'successful search sequence changed')
   for step in new_search['attempts']:
    if not step['progress']:continue
    rel=pathlib.Path(f"stage-{step['stage']}")/step['name']
    prior=root/'optional-before'/b['evidence']/'work/native-thermal-postprocess/search'/rel
    assert copper(prior)==copper(work/'search'/rel),(k,'accepted checkpoint geometry changed')
   repair_attempt_counts.append({'case':k[0],'seed':k[1],'before':len(old_search['attempts']),'after':len(new_search['attempts'])})
 else:
  # Declined search must preserve the exact imported routed board whenever the
  # search froze it before rejecting. Preflight failures also retain this freeze.
  frozen=work/'search/routed/board.kicad_pcb'
  assert frozen.read_bytes()==(root/'optional-after'/a['evidence']/'work/output.kicad_pcb').read_bytes()
def aggregate(rows):
 groups=collections.defaultdict(list)
 for r in rows:groups[r['case']].append(r)
 return {'runs':len(rows),'passed':sum(r['passed'] for r in rows),'valid_cases_3of3':sum(len(v)==3 and all(r['passed'] for r in v) for v in groups.values()),'opens':sum(r['opens'] for r in rows),'new_errors':sum(r['new_errors'] for r in rows),'median_route_s':statistics.median(r['seconds'] for r in rows),'median_length_mm':statistics.median(r['length_mm'] for r in rows),'total_vias':sum(r['vias'] for r in rows),'total_length_mm':sum(r['length_mm'] for r in rows)}
result={'before':aggregate(list(before.values())),'after':aggregate(list(after.values())),'regressions':regressions,'changes':changes,'postprocess_statuses':dict(dispositions),'changed_boards':changed_boards,'physical_copper_unchanged_all_78':True,'repair_attempt_counts':repair_attempt_counts,'groups':{}}
for label,case in [('J2small','qrpcard-qrpcard-j2-small'),('J4','qrpcard-qrpcard-j4'),('Aquarius','kitspace-aquarius-j4')]:
 result['groups'][label]={phase:aggregate([r for r in rows.values() if r['case']==case]) for phase,rows in [('before',before),('after',after)]}
assert not regressions,regressions
assert set(changed_boards)=={(case,s) for case in ('qrpcard-qrpcard-j2-small','qrpcard-qrpcard-j4') for s in (1,2,3)}
assert not changes,changes
(root/'comparison.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
