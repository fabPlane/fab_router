from pathlib import Path
import hashlib,json,itertools
R=Path(__file__).resolve().parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def lost(groups,after):
 member={t:i for i,g in enumerate(after) for t in g}
 return sum(member.get(a)!=member.get(b) for g in groups for a,b in itertools.combinations(g,2))
rows=json.loads((R/'strict-results.json').read_text());assert len(rows)==6
for r in rows:
 p=R/f"strict-{r['repeat']}";d=json.loads((p/(r['name']+'.json')).read_text());g=d['terminalGroups'];c=d['repair'];cg=c['terminalGroups']
 assert d['inputSha256']==sha(p/'input.kicad_pcb') and d['candidateSha256']==sha(p/(r['name']+'.kicad_pcb')) and c['routedSha256']==sha(p/'before.kicad_pcb')
 assert lost(g['input'],g['candidate'])==d['lostTerminalPairs']==235
 assert lost(cg['input'],cg['candidate'])==c['lostTerminalPairs']==0
 assert d['opensAfter']==r['opens']==13
 assert len(d['newErrors'])==({'before':5,'after':4}[r['name']])
 assert all(e['type']=='starved_thermal' for e in d['newErrors'])
 assert d['accepted'] is False and c['accepted'] is True
 assert d['nativeCopperChecks']==[True,True,True]
for filename,n in [('deletion-results.json',9),('detour-results.json',6),('offset-results.json',16)]:
 attempts=json.loads((R/filename).read_text());assert len(attempts)==n
 for r in attempts:
  p=R/r['name'];d=json.loads((p/'drc.json').read_text());errs=[e for e in d['violations'] if e['severity']=='error'];groups=json.loads((p/'groups.json').read_text())
  assert [e['type'] for e in errs]==r['errors']
  assert len(d['unconnected_items'])==r['opens']
  assert lost(json.loads((R/'strict-0/before.json').read_text())['terminalGroups']['input'],groups)==r['lostSource']
assert lost(json.loads((R/'strict-0/before.json').read_text())['terminalGroups']['candidate'],json.loads((R/'delete-1/groups.json').read_text()))==2
before=json.loads((R/'scored-before.json').read_text());after=json.loads((R/'scored-aquarius/results.json').read_text());comparison=json.loads((R/'scored-comparison.json').read_text())
for old in before:
 new=next(r for r in after if r['seed']==old['seed'])
 expected=next(r for r in comparison['pairs'] if r['seed']==old['seed'])
 for k in expected['matching_fields']:assert old[k]==new[k]
 for name,hashes in expected['blobs'].items():assert sha(R/'scored-before-work'/str(old['seed'])/name)==sha(R/'scored-aquarius'/new['evidence']/'work'/name)==hashes[0]==hashes[1]
for k in comparison['same_controls']:assert json.loads((R/'scored-before-controls.json').read_text())[k]==json.loads((R/'scored-aquarius/controls.json').read_text())[k]
result={'strict_pairs':3,'exploratory_checks':31,'before_thermals':5,'after_thermals':4,'opens':13,'lost_source_pairs':235,'lost_current_pairs':0,'published':False,'verified':True}
(R/'verification.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
