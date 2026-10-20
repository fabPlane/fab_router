import pathlib,json,subprocess,shutil,hashlib,base64
root=pathlib.Path('/home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c200');repo=pathlib.Path('/home/hyper/bench/wt/fr-bugs');old=root/'before-tool';out=root/'controls';out.mkdir(exist_ok=False)
text=(root/'measure.py').read_text();exec(text[text.index('def invoke('):text.index('for i,row in enumerate')])
rows=[]
for repeat in range(3):
 for mode in ['rewired','thermal']:
  d=out/f'{mode}-{repeat}';d.mkdir()
  if mode=='thermal':
   scratch=root.parent
   origins=[scratch/'c175/inputs/original-input/board.kicad_pcb',scratch/'c175/inputs/original-segment/board.kicad_pcb',scratch/f'c175/native/selected-{repeat}.kicad_pcb']
   for role,origin in zip(['input','routed','repaired'],origins):
    target=d/role;target.mkdir();shutil.copyfile(origin,target/'board.kicad_pcb')
    for ext in ['.kicad_pro','.kicad_dru']:shutil.copyfile(origins[0].with_suffix(ext),target/('board'+ext))
  else:
   fixture=(repo/'test/fixtures/native-terminal-swap/input.kicad_pcb').read_text();source=fixture[:fixture.index('(zone')]
   def segment(x,y,id):return f'(segment (start 15 5) (end {x} {y}) (width 0.25) (layer "F.Cu") (net 1) (uuid "00000000-0000-0000-0000-{id:012}"))'
   for role,copper in [('input',[]),('routed',[segment(5,5,100),segment(5,15,101)]),('repaired',[segment(5,5,100),segment(25,5,102)])]:
    target=d/role;target.mkdir();(target/'board.kicad_pcb').write_text(source+'\n'.join(copper)+')');(target/'board.kicad_pro').write_text('{}')
  paths=[d/role/'board.kicad_pcb' for role in ['input','routed','repaired']]
  a=invoke(d,'before',*paths);b=invoke(d,'after',*paths)
  assert a['published']
  assert b['published']==(mode=='thermal')
  assert b['repair']['lostTerminalPairs']==(2 if mode=='rewired' else 0)
  assert len(b['newErrors'])==0 and b['opensAfter']==(1 if mode=='rewired' else 0)
  assert b['repair']['opensBefore']==b['repair']['opensAfter']
  rows.append(dict(mode=mode,repeat=repeat,before=a['published'],after=b['published'],lost_pairs=b['repair']['lostTerminalPairs'],opens=b['opensAfter'],routed_errors=len([v for v in b['repair']['routedReport']['violations'] if v['severity']=='error']),repaired_errors=len(b['newErrors'])))
  (out/'results.json').write_text(json.dumps(rows,indent=2)+'\n');print(rows[-1],flush=True)
