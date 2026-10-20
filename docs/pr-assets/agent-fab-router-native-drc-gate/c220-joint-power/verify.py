import pathlib,json,hashlib,gzip,statistics
R=pathlib.Path(__file__).resolve().parent
rows=json.loads((R/'strict-results.json').read_text());assert len(rows)==9
for name,count,opens,lost,current,relative in [('routed',6,13,235,0,True),('power',8,14,292,57,False),('joint',5,13,235,0,True)]:
 rr=[r for r in rows if r['name']==name];assert len(rr)==3
 for r in rr:assert len(r['errors'])==count and r['opens']==opens and r['lostSource']==lost and r['lostCurrent']==current and r['ownership']==[True]*3 and not r['accepted'] and r['relativeAccepted']==relative
 for i in range(1,3):assert (R/f'repeat-{i}/{name}.kicad_pcb').read_bytes()==(R/f'repeat-0/{name}.kicad_pcb').read_bytes()
 for ext in ['.kicad_pro','.kicad_dru']:
  for i in range(3):assert (R/f'repeat-{i}/{name}{ext}').read_bytes()==(R/f'repeat-0/input{ext}').read_bytes()
for row in rows:
 d=json.loads((R/f"repeat-{row['repeat']}/{row['name']}.json").read_text())
 assert d['newErrors']==[e for e in d['candidateReport']['violations'] if e['severity']=='error']
 assert row['errors']==[e['type'] for e in d['newErrors']]
 assert len(d['candidateReport']['unconnected_items'])==row['opens']
 assert d['candidateSha256']==hashlib.sha256((R/f"repeat-{row['repeat']}/{row['name']}.kicad_pcb").read_bytes()).hexdigest()
 assert d['inputSha256']==hashlib.sha256((R/f"repeat-{row['repeat']}/input.kicad_pcb").read_bytes()).hexdigest()
 for groups,key in [(d['terminalGroups'],'lostSource'),(d['repair']['terminalGroups'],'lostCurrent')]:
  baseline=groups.get('input',groups.get('routed'));member={pad:i for i,g in enumerate(groups['candidate']) for pad in g}
  lost=sum(member[a]!=member[b] for group in baseline for i,a in enumerate(group) for b in group[i+1:]);assert lost==row[key]
summary={n:{'repeats':3,'median_native_check_s':statistics.median(r['seconds'] for r in rows if r['name']==n)} for n in ['routed','power','joint']}
summary['exploratory_checks']=sum(len(json.loads((R/f).read_text())) for f in ['results.json','deletion-results.json','detour-results.json','joint-probe-results.json','fine-probe-results.json'])
(R/'verification.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
