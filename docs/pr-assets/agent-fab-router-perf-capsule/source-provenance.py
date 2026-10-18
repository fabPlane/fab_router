"""Capture committed source hashes, or verify an existing capture without modifying it."""
from pathlib import Path
import argparse,hashlib,json,subprocess
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('baseline',type=Path);p.add_argument('candidate',type=Path);p.add_argument('output',type=Path);p.add_argument('--verify',action='store_true')
args=p.parse_args();data={}
for version,source in [('before',args.baseline.resolve()),('after',args.candidate.resolve())]:
 files=subprocess.check_output(['git','-C',str(source),'ls-files','-z','src','spec','tools','test'],text=True).rstrip('\0').split('\0')
 commit=subprocess.check_output(['git','-C',str(source),'rev-parse','HEAD'],text=True).strip()
 hashes={f:hashlib.sha256((source/f).read_bytes()).hexdigest() for f in files}
 for f,h in hashes.items():
  assert hashlib.sha256(subprocess.check_output(['git','-C',str(source),'show',f'{commit}:{f}'])).hexdigest()==h,(source,f,'uncommitted source')
 data[version]={'path':str(source),'commit':commit,'sha256':hashes}
if args.verify:
 assert json.loads(args.output.read_text())==data,'source identity differs from capture'
else:
 with args.output.open('x') as output:output.write(json.dumps(data,indent=2)+'\n')
print('Verified committed source identities' if args.verify else 'Captured committed source identities')
