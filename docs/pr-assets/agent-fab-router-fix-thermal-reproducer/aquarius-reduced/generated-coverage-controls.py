"""Reject incomplete or forged all-target transaction evidence after rebinding manifests."""
import argparse,hashlib,json,os,shutil,subprocess
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--out',type=Path,required=True)
p.add_argument('--results',type=Path,required=True)
p.add_argument('--source',type=Path,required=True)
a=p.parse_args()
root=a.out
root.mkdir(parents=True,exist_ok=False)
asset=Path(__file__).resolve().parent
fixture=json.loads((a.results/'summary.json').read_text())
assert fixture['all_targets'] and len(fixture['rows'])==3
assert all(r['accepted'] and r['target_index']==0 for r in fixture['rows'])
rows=[]
for label in ('unchanged','missing-target','duplicate-repeat','truncated-rejection','wrong-track-rank','wrong-track-limit'):
 out=root/('verify-control-'+label)
 shutil.copytree(a.results,out)
 s=json.loads((out/'summary.json').read_text())
 if label=='wrong-track-rank':s['rows'][0]['attempts'][0]['track_rank']=2
 if label=='wrong-track-limit':s['track_limit']=True
 if label=='missing-target':s['rows'].pop()
 if label=='duplicate-repeat':s['rows'][1]['repeat']=1
 if label=='truncated-rejection':
  row=s['rows'][0];row['attempts'].pop();row['accepted']=False
  data=a.source.read_bytes()
  (out/'selected-1-0.kicad_pcb').write_bytes(data)
  row['selected_sha256']=hashlib.sha256(data).hexdigest()
 (out/'summary.json').write_text(json.dumps(s))
 (out/'manifest.json').write_text(json.dumps({str(p.relative_to(out)):hashlib.sha256(p.read_bytes()).hexdigest() for p in out.rglob('*') if p.is_file() and p.name!='manifest.json' and p.suffix!='.kicad_prl'}))
 p=subprocess.run(['/usr/bin/python3',str(asset/'verify-generated-transaction.py'),str(out),'--source',str(a.source)],env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1'},capture_output=True,text=True,timeout=120)
 (root/f'verify-control-{label}.log').write_text(p.stdout+p.stderr)
 assert (p.returncode==0)==(label=='unchanged'),label
 rows.append(dict(control=label,exit_code=p.returncode,expected_accept=label=='unchanged'))
(root/'verify-controls.json').write_text(json.dumps(rows,indent=2)+'\n')
print('PASS: unchanged accepted; missing target, duplicate repeat, truncated rejection, wrong rank and invalid limit rejected')
