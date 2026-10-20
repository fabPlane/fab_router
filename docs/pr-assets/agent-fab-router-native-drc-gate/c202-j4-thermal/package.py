import pathlib,tarfile,gzip,shutil,json,hashlib,subprocess
r=pathlib.Path(__file__).resolve().parent;repo=pathlib.Path('/home/hyper/bench/wt/fr-bugs');d=repo/'docs/pr-assets/agent-fab-router-native-drc-gate/c202-j4-thermal';d.mkdir(exist_ok=True)
with tarfile.open(d/'native-search.tar.xz','w:xz',preset=6) as a:
 for name in ['fixtures','repaired','selected.json','recheck.json','measurement.json','provenance.json','source-hashes.json']+[f'{prefix}-{i}{suffix}' for i in range(3) for prefix,suffix in [('search',''),('search','.log'),('status','.json'),('accepted','.json')]]:
  a.add(r/name,arcname='native/'+name,filter=lambda t:None if t.name.endswith(('.kicad_prl','.pyc')) else t)
 a.add(r.parent/'c201/licenses/qrpcard-qrpcard-j4.LICENSE',arcname='native/LICENSE')
for name in ['reproduce.py','verify.py','render.py','package.py','measurement.json','provenance.json','source-hashes.json','comparison.png','README.md','process-status.json']:
 shutil.copyfile(r/name,d/name)
for name in ['checks.log','final-static-checks.log','before.svg','after.svg','render-before.log','render-after.log','recheck.log']:
 (d/(name+'.gz')).write_bytes(gzip.compress((r/name).read_bytes(),mtime=0))
for name in ['test/fixtures/native-thermal-j4/source.kicad_pcb.gz','test/fixtures/native-thermal-j4/routed.kicad_pcb.gz','test/native-thermal-search.test.ts']:
 assert (repo/name).is_file()
unpack=r/'unpacked';unpack.mkdir(exist_ok=False)
subprocess.run(['tar','-xJf',str(d/'native-search.tar.xz'),'-C',str(unpack)],check=True)
v=subprocess.run(['python3',str(d/'verify.py'),str(unpack/'native')],capture_output=True,text=True,check=True);(d/'archive-replay.log').write_text(v.stdout+v.stderr)
assert json.loads(v.stdout)==json.loads((r/'measurement.json').read_text())
manifest={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in d.iterdir() if p.is_file() and p.name!='manifest.json'}
(d/'manifest.json').write_text(json.dumps(manifest,indent=2,sort_keys=True)+'\n')
print('Packaged, extracted and independently replayed',len(manifest),'members')
