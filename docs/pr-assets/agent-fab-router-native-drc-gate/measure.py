"""Run the native gate on every retained candidate in a complete single-router suite.

Re-runs native DRC on disposable copies; does not re-run or alter the router/checker.
The source suite must contain final boards and their original project/rule sidecars.
"""
import argparse,hashlib,json,pathlib,subprocess,time
p=argparse.ArgumentParser();p.add_argument('--prior',type=pathlib.Path,required=True);p.add_argument('--source',type=pathlib.Path,required=True);p.add_argument('--out',type=pathlib.Path,required=True);x=p.parse_args()
x.source=x.source.resolve();x.prior=x.prior.resolve();x.out=x.out.resolve();x.out.mkdir(exist_ok=False,parents=True)
rows=[]
for index,row in enumerate(json.loads((x.prior/'results.json').read_text())):
 if row['router']!='fab-router':continue
 evidence=x.prior/row['evidence'];inp=evidence/'work/board.kicad_pcb';candidate=evidence/'final.kicad_pcb';target=x.out/f'{index:03}.json'
 files=[p.with_suffix(ext) for p in (inp,candidate) for ext in ('.kicad_pcb','.kicad_pro','.kicad_dru')]
 hashes={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
 start=time.monotonic();command=['taskset','-c','20-25','nice','-n','10','timeout','260','bun','tools/native-drc-gate.ts',str(inp),str(candidate),str(target)]
 result=subprocess.run(command,cwd=x.source,capture_output=True,text=True,timeout=270)
 (x.out/f'{index:03}.log').write_text(result.stdout+result.stderr)
 assert result.returncode in (0,1),(row['case'],result.returncode,result.stderr)
 data=json.loads(target.read_text())
 assert hashes=={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
 r=dict(case=row['case'],seed=row['seed'],prior_evidence=row['evidence'],prior_passed=row['passed'],prior_new_errors=row['new_errors'],prior_opens=row['opens'],accepted=data['accepted'],new_errors=len(data['newErrors']),opens_before=data['opensBefore'],opens_after=data['opensAfter'],seconds=time.monotonic()-start,report=target.name,source_hashes=hashes,exit_code=result.returncode)
 assert data['accepted']==(result.returncode==0)
 assert r['new_errors']==row['new_errors'] and r['opens_after']==row['opens']
 rows.append(r);(x.out/'results.json').write_text(json.dumps(rows,indent=2)+'\n');print(len(rows),r['case'],r['seed'],r['accepted'],r['new_errors'],r['opens_after'],flush=True)
assert len(rows)==78
summary=dict(cases=26,candidate_runs=78,native_checks=156,accepted=sum(r['accepted'] for r in rows),rejected=sum(not r['accepted'] for r in rows),new_errors=sum(r['new_errors'] for r in rows),opens=sum(r['opens_after'] for r in rows),prior_passed=sum(r['prior_passed'] for r in rows),no_sources_modified=True,router_rerun=False)
(x.out/'summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(summary)
