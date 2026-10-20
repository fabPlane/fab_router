import hashlib,json,pathlib,subprocess,time
root=pathlib.Path('/home/hyper/bench/wt/fr-bugs')
scratch=pathlib.Path('/home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c189')
prior=scratch.parent/'c188/final-run'
out=scratch/'native-run';out.mkdir(exist_ok=False)
rows=[]
for index,row in enumerate(json.loads((prior/'results.json').read_text())):
 evidence=prior/row['evidence'];inp=evidence/'work/board.kicad_pcb';candidate=evidence/'final.kicad_pcb'
 target=out/f'{index:03}.json'
 tracked=[p.with_suffix(ext) for p in (inp,candidate) for ext in ('.kicad_pcb','.kicad_pro','.kicad_dru')]
 hashes={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in tracked}
 start=time.monotonic()
 p=subprocess.run(['taskset','-c','20-25','nice','-n','10','timeout','260','bun','tools/native-drc-gate.ts',str(inp),str(candidate),str(target)],cwd=root,capture_output=True,text=True,timeout=270)
 (out/f'{index:03}.log').write_text(p.stdout+p.stderr)
 assert p.returncode in (0,1),(index,p.returncode,p.stderr)
 data=json.loads(target.read_text())
 assert hashes=={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in tracked}
 result=dict(case=row['case'],seed=row['seed'],prior_evidence=row['evidence'],prior_passed=row['passed'],prior_new_errors=row['new_errors'],prior_opens=row['opens'],accepted=data['accepted'],new_errors=len(data['newErrors']),opens_before=data['opensBefore'],opens_after=data['opensAfter'],seconds=time.monotonic()-start,report=target.name,source_hashes=hashes,exit_code=p.returncode)
 assert data['accepted']==(p.returncode==0)
 assert result['new_errors']==row['new_errors'],(row['case'],row['seed'],result['new_errors'],row['new_errors'])
 assert result['opens_after']==row['opens'],(row['case'],row['seed'],result['opens_after'],row['opens'])
 rows.append(result);(out/'results.json').write_text(json.dumps(rows,indent=2)+'\n')
 print(index+1,row['case'],row['seed'],data['accepted'],result['new_errors'],result['opens_after'],flush=True)
assert len(rows)==78
summary=dict(cases=26,candidate_runs=78,native_checks=156,accepted=sum(r['accepted'] for r in rows),rejected=sum(not r['accepted'] for r in rows),new_errors=sum(r['new_errors'] for r in rows),opens=sum(r['opens_after'] for r in rows),prior_passed=sum(r['prior_passed'] for r in rows),no_sources_modified=True,router_rerun=False)
(out/'summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(summary,flush=True)
