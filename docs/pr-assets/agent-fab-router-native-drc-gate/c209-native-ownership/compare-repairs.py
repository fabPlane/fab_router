import json,pathlib,shutil,hashlib
r=pathlib.Path(__file__).resolve().parent;c=r.parent/'c206/full-after';rows=json.loads((c/'results.json').read_text());results=json.loads((r/'repair-recheck-results.json').read_text());assert len(results)==6
for result in results:
 row=next(x for x in rows if x['case']==result['case'] and x['seed']==result['seed']);old=c/row['evidence']/'work/native-thermal-postprocess/search';d=r/'repair-recheck'/f"{row['case']}-{row['seed']}";new=d/'search'
 old_result=json.loads((old/'result.json').read_text());new_result=json.loads((new/'result.json').read_text())
 sequence=lambda v:[(a['stage'],a['name'],a['progress']) for a in v['attempts']]
 assert sequence(old_result)==sequence(new_result)
 shutil.copyfile(old/'result.json',d/'old-search-result.json')
 checked=[]
 for a in new_result['attempts']:
  if not a['progress']:continue
  path=pathlib.Path(f"stage-{a['stage']}")/a['name'];assert (old/path).read_bytes()==(new/path).read_bytes()
  target=d/'old-progress'/path;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(old/path,target)
  checked.append(dict(stage=a['stage'],name=a['name'],sha256=hashlib.sha256(target.read_bytes()).hexdigest()))
 result['sameProgressSequence']=True;result['acceptedCheckpoints']=checked
(r/'repair-recheck-results.json').write_text(json.dumps(results,indent=2)+'\n');print('six searches preserve exact proposal sequences, accepted checkpoint bytes and final bytes')
