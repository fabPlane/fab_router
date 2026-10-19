from pathlib import Path
import base64,gzip,hashlib,json,subprocess,sys
base=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(exist_ok=True)
def packed(name,raw): (out/name).write_bytes(gzip.compress(raw,mtime=0))
archive={}; audits={}
for mode in ['original','candidate']:
 d=base/('native-'+mode)
 for n in ['controls','results','summary']:packed(mode+'-'+n+'.json.gz',(d/(n+'.json')).read_bytes())
 packed(mode+'-run.log.gz',(base/('native-'+mode+'.log')).read_bytes())
 (out/(mode+'-supervisor.json')).write_bytes((base/('native-'+mode+'-exit.json')).read_bytes())
 archive[mode]=[]
 for r in json.loads((d/'results.json').read_text()):
  ev=d/r['evidence']; files={}
  for n in ['check.json','record.json','work/board.dsn','work/board.ses','work/candidate-settings.json','work/dsn-manifest.json','work/router-summary.json']:
   raw=(ev/n).read_bytes();files[n]={'sha256':hashlib.sha256(raw).hexdigest(),'base64':base64.b64encode(raw).decode()}
  archive[mode].append({k:r[k] for k in ['case','seed','evidence']}|{'files':files})
 source=base/mode
 names=subprocess.check_output(['git','-C',str(source),'ls-files','-z','src','spec','test','tools','package.json','tsconfig.json','entry']).split(b'\0')
 audits[mode]={n.decode():hashlib.sha256((source/n.decode()).read_bytes()).hexdigest() for n in names if n}
assert audits['original'].keys()==audits['candidate'].keys()
assert [n for n in audits['original'] if audits['original'][n]!=audits['candidate'][n]]==['src/route/clear.ts']
packed('full-source-audit.json.gz',json.dumps(audits,indent=2).encode())
packed('raw-attempts.json.gz',json.dumps(archive,separators=(',',':')).encode())
packed('source-audit.json.gz',(base/'audit.json').read_bytes())
for n in ['comparison.json','checks-exits.json']:(out/n).write_bytes((base/n).read_bytes())
for mode in ['candidate','original']:packed(mode+'-checks.log.gz',(base/(mode+'-checks.log')).read_bytes())
