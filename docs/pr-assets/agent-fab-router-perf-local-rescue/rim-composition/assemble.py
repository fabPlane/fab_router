from pathlib import Path
import gzip,hashlib,json,subprocess,sys,collections
w=Path(__file__).resolve().parent;repo=Path('/home/hyper/bench/wt/fr-perf')
out=repo/'docs/pr-assets/agent-fab-router-perf-local-rescue/rim-composition';out.mkdir(exist_ok=True)
source={'base':(w/'base.txt').read_text().strip(),'ring':subprocess.check_output(['git','rev-parse','origin/agent/fab-router-perf'],cwd=repo,text=True).strip(),'localRecovery':True}
if len(sys.argv)>1:source['candidateProduction']=sys.argv[1]
(w/'source.json').write_text(json.dumps(source,indent=2)+'\n')
for n in ['assemble.py','write-report.py','prepare-repro.py','prepare-native.py','native.py','compare.py','checks.py','package.py','package-stress.py','verify.py','verify-dense.py','report.py','aggregate.py','probe.py','replay.ts','analyze.py','profile.py','stress.py','dense-native.py','compare-dense.py','stress.ts']:(out/n).write_bytes((w/n).read_bytes())
for n in ['package.py','package-stress.py']:subprocess.run(['python3',out/n,w,out],check=True)
(out/'case-provenance.json.gz').write_bytes((w.parent/'cycle80/case-provenance.json.gz').read_bytes())
for n in ['profile-summary.json','source-audit.json','test-fixture-audit.json','full-report-parity.txt','replay-input-parity.txt']:(out/n).write_bytes((w/n).read_bytes())
for pattern in ['*.cpuprofile','profile-*.jsonl','profile-*.stderr','native-supervisor.log','checks-supervisor.log','initial-checks.log','initial-checks-supervisor.log','stress-supervisor.log','stress-exits.json','dense.log','l2-*.log','l3-cycle18-*.log']:
 for p in w.glob(pattern):(out/(p.name+'.gz')).write_bytes(gzip.compress(p.read_bytes(),mtime=0))
for n in ['report.py','aggregate.py']:
 args=[out/'comparison.json',out]if n=='report.py'else[out]
 subprocess.run(['python3',out/n,*args],check=True)
subprocess.run(['rsvg-convert','-w','1600',out/'timings.svg','-o',out/'timings.png'],check=True)
ladder=[]
for case in ['l2','l3-cycle18']:
 a,b=[json.loads((w/f'{case}-{m}/result.json').read_text())for m in ['original','candidate']]
 assert a['stats']==b['stats']
 ladder.append({'case':case,'before_s':a['seconds'],'after_s':b['seconds'],'engine_incomplete':a['report']['incompleteAfter'],'added_represented_violations':a['report']['violationsAdded']})
(out/'ladder-summary.json').write_text(json.dumps(ladder,indent=2)+'\n')
p='| Source-qualified sampled self ms (separate profile) | Control | Candidate |\n|---|---:|---:|\n';counts={}
for mode in ['original','candidate']:
 d=json.loads((w/f'{mode}.cpuprofile').read_text());nodes={n['id']:n for n in d['nodes']};c=collections.Counter()
 for n,delta in zip(d['samples'],d['timeDeltas']):
  f=nodes[n]['callFrame'];c[(f['functionName'],f['url'])]+=delta/1000
 counts[mode]=c
for name,file in [('withinRim','geom/onboard'),('partWithinRim','geom/onboard'),('pointInRing','geom/predicates'),('collect','lattice/grid'),('test','lattice/grid')]:
 v={m:sum(v for (f,url),v in counts[m].items()if f==name and url.endswith('/src/'+file+'.ts'))for m in counts}
 p+=f"| {name} ({file}) | {v['original']:.3f} | {v['candidate']:.3f} |\n"
(out/'profile-table.md').write_text(p)
def manifest():(out/'manifest.json').write_text(json.dumps({p.name:hashlib.sha256(p.read_bytes()).hexdigest()for p in sorted(out.iterdir())if p.is_file()and p.name!='manifest.json'},indent=2)+'\n')
manifest()
logs=[]
for n in ['verify.py','verify-dense.py']:
 r=subprocess.run(['python3',out/n],capture_output=True,text=True);print(r.stdout);assert r.returncode==0,r.stderr;logs.append(r.stdout)
(out/'verification.txt').write_text(''.join(logs));manifest()
print('PASS complete archives, source inventories, derived tables/chart, corruption controls and manifest')
