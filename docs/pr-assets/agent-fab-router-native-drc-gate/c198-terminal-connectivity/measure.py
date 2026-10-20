import argparse,base64,hashlib,json,pathlib,shutil,subprocess,time
p=argparse.ArgumentParser();p.add_argument('--prior',type=pathlib.Path,required=True);p.add_argument('--source',type=pathlib.Path,required=True);p.add_argument('--before-tool',type=pathlib.Path,required=True);p.add_argument('--out',type=pathlib.Path,required=True);x=p.parse_args()
x.out.mkdir(parents=True,exist_ok=False)
rows=[]
hash=lambda b:hashlib.sha256(b).hexdigest()
for i,row in enumerate(json.loads((x.prior/'results.json').read_text())):
 if row['router']!='fab-router':continue
 source=x.prior/row['evidence'];d=x.out/f'{i:03}';d.mkdir()
 for role,path in [('input',source/'work/board.kicad_pcb'),('candidate',source/'final.kicad_pcb')]:
  target=d/role;target.mkdir()
  for ext in ['.kicad_pcb','.kicad_pro','.kicad_dru']:
   f=path.with_suffix(ext)
   if f.exists():shutil.copyfile(f,target/('board'+ext))
 before=d/'input/board.kicad_pcb';after=d/'candidate/board.kicad_pcb';args=[str(before),str(after)]
 sources={str(f.relative_to(d)):hash(f.read_bytes()) for role in ['input','candidate'] for f in (d/role).iterdir()}
 data=[]
 for phase,command in [('before',['bun',str(x.before_tool),*args,str(d/'before.json')]),('after',['bun',str(x.source/'tools/native-candidate-bundle.ts'),*args,str(d/'bundle.json')])]:
  proc=subprocess.run(['taskset','-c','20-25','nice','-n','10','timeout','400',*command],capture_output=True,text=True,cwd=x.source,timeout=410)
  (d/f'{phase}.log').write_text(proc.stdout+proc.stderr)
  assert proc.returncode in [0,1],(row['case'],phase,proc.returncode,proc.stderr)
  result=json.loads((d/'before.json').read_text() if phase=='before' else proc.stdout)
  if phase=='after':(d/'after.json').write_text(json.dumps(result,indent=2)+'\n')
  assert result['accepted']==(proc.returncode==0)
  assert len(result['newErrors'])==row['new_errors'] and result['opensAfter']==row['opens']
  data.append(result)
 for key in ['newErrors','opensBefore','opensAfter','inputSha256','candidateSha256']:
  assert data[0][key]==data[1][key],(row['case'],key)
 for key in ['inputReport','candidateReport']:
  for policy in ['coordinate_units','kicad_version','included_severities','ignored_checks']:
   assert data[0][key][policy]==data[1][key][policy]
  signature=lambda report: sorted(json.dumps([v['type'],v['severity'],sorted((i['description'],i['pos']['x'],i['pos']['y']) for i in v['items'])]) for v in report['violations'] if v['severity']=='error')
  assert signature(data[0][key])==signature(data[1][key])
  assert len(data[0][key]['unconnected_items'])==len(data[1][key]['unconnected_items'])
 assert data[1]['published']==data[1]['accepted']==(d/'bundle.json').exists()
 if data[1]['published']:
  bundle=json.loads((d/'bundle.json').read_text());assert bundle['format']=='fab-router-native-candidate-v1'
  assert bundle['validation']=={k:v for k,v in data[1].items() if k!='published'}
  for role in ['input','candidate']:
   assert {f['name'] for f in bundle[role]}=={f.name for f in (d/role).iterdir()}
   for f in bundle[role]:
    b=base64.b64decode(f['base64'],validate=True);assert hash(b)==f['sha256'];assert b==(d/role/f['name']).read_bytes()
 assert sources=={str(f.relative_to(d)):hash(f.read_bytes()) for role in ['input','candidate'] for f in (d/role).iterdir()}
 r=dict(case=row['case'],seed=row['seed'],accepted=data[0]['accepted'],lost_terminal_pairs=data[1]['lostTerminalPairs'],published=data[1]['published'],new_errors=len(data[0]['newErrors']),opens=data[0]['opensAfter'],prior_passed=row['passed'],source_hashes=sources,directory=d.name)
 rows.append(r);(x.out/'results.json').write_text(json.dumps(rows,indent=2)+'\n');print(len(rows),r['case'],r['seed'],r['published'],flush=True)
assert len(rows)==78
summary=dict(cases=26,runs=78,native_checks=312,accepted=sum(r['accepted'] for r in rows),published=sum(r['published'] for r in rows),new_errors=sum(r['new_errors'] for r in rows),opens=sum(r['opens'] for r in rows),underlying_passed=sum(r['prior_passed'] for r in rows),router_rerun=False,all_paired_decisions_equal=all(r['accepted']==r['published'] for r in rows),lost_terminal_pairs=sum(r['lost_terminal_pairs'] for r in rows),all_source_bytes_unchanged=True)
(x.out/'summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(summary,flush=True)
