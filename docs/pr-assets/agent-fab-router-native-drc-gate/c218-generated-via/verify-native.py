from pathlib import Path
from decimal import Decimal,InvalidOperation
import sys,json,hashlib,importlib.util
sys.dont_write_bytecode=True
r=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('m',r/'after.py');m=importlib.util.module_from_spec(spec);sys.modules[spec.name]=m;spec.loader.exec_module(m)

def check_pairs(v):
 for groups, claimed in [(v['terminalGroups'],v['lostTerminalPairs']),
                         (v['repair']['terminalGroups'],v['repair']['lostTerminalPairs'])]:
  assert groups['nativeVersion']=='10.0.6'
  member={t:i for i,g in enumerate(groups['candidate']) for t in g}
  original={t for g in groups['input'] for t in g}
  assert original==set(member)
  lost=sum(a not in member or b not in member or member[a]!=member[b]
           for g in groups['input'] for i,a in enumerate(g) for b in g[i+1:])
  assert lost==claimed
 assert v['opensBefore']==len(v['inputReport']['unconnected_items'])
 assert v['opensAfter']==len(v['candidateReport']['unconnected_items'])
 assert v['repair']['opensBefore']==len(v['repair']['routedReport']['unconnected_items'])

rows=json.loads((r/'measurement.json').read_text());assert len(rows)==3
candidates=[]
for row in rows:
 i=row['repeat'];b=json.loads((r/'native'/f'before-{i}.json').read_text());a=json.loads((r/'native'/f'after-{i}.json').read_text());check_pairs(b);check_pairs(a);assert [e['type'] for e in b['newErrors']]==['starved_thermal'];assert not b['accepted']
 assert a['accepted'] and not a['newErrors'] and a['lostTerminalPairs']==a['repair']['lostTerminalPairs']==0 and a['nativeCopperChecks']==[True]*3 and a['opensAfter']==b['opensAfter']==95
 old=json.loads((r/'native'/f'before-{i}/manifest.json').read_text());new=json.loads((r/'native'/f'after-{i}/manifest.json').read_text());assert len(new)<=304 and new[:len(old)]==old
 for p in old:assert (r/'native'/f'before-{i}'/p['name']).read_bytes()==(r/'native'/f'after-{i}'/p['name']).read_bytes()
 target=r/'native'/f'after-{i}'/row['proposal']['name'];assert a['candidateSha256']==hashlib.sha256(target.read_bytes()).hexdigest();assert b['candidateSha256']==hashlib.sha256((r/'native/routed.kicad_pcb').read_bytes()).hexdigest();assert a['inputSha256']==b['inputSha256']==hashlib.sha256((r/'native/input.kicad_pcb').read_bytes()).hexdigest();candidates.append(hashlib.sha256(target.read_bytes()).hexdigest());nodes=m.parse(target.read_text());base=m.parse((r/'native/routed.kicad_pcb').read_text())
 original={m.uid(n):n for n in base if isinstance(n,list) and m.uid(n)};current={m.uid(n):n for n in nodes if isinstance(n,list) and m.uid(n)};assert set(original)==set(current)
 changed={k for k in current if current[k]!=original[k]};assert changed=={'e57c15b7-d609-442a-9cca-2c520d20bbab','0278f3c0-7ae5-4ba2-bb29-8039ad00f801','685066e2-0f74-452e-a5d4-bb4371279364','526748ae-cdba-488b-9c2f-37172461148a'},changed
 assert len(nodes)==len(base)
assert len(set(candidates))==1
def exact(n):
 if isinstance(n,list):return tuple(exact(x) for x in n)
 try:return Decimal(n) if not n.startswith('"') else n
 except InvalidOperation:return n
# The native copper render is reused from the same independently checked
# geometry, with only the explanatory labels updated for generated proposals.
assert exact(nodes)==exact(m.parse((r/'render-reference.kicad_pcb').read_text()))

print(json.dumps({'repeats':3,'nativeAccepted':3,'opens':95,'lostSourcePairs':0,'lostCurrentPairs':0,'candidateHashes':candidates,'priorPrefixByteExact':True},indent=2))
