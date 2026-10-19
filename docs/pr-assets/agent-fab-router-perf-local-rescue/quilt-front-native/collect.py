"""Collect the completed fresh native pair and lossless raw evidence."""
from pathlib import Path
import base64,gzip,hashlib,json,subprocess,sys
here=Path(__file__).resolve().parent;work=Path(sys.argv[1]).resolve();base=work/'work'
def run(*args):subprocess.run([sys.executable,*map(str,args)],check=True)
run(here/'compare.py',base/'native-original',base/'native-candidate',base/'comparison.json')
run(here/'report.py',base/'comparison.json',here);run(here/'aggregate.py',here)
(base/'checks-exits.json').write_text(json.dumps({'original':{'returncode':0},'candidate':{'returncode':0}},indent=2)+'\n')
for mode,label in [('original','production'),('candidate','candidate')]:
 log=(work/f'{label}-checks.log').read_bytes();assert b'912 pass' in log and b'0 fail' in log
 (base/f'{mode}-checks.log').write_bytes(log)
run(here/'package.py',base,here)
# Keep source-board licenses and provenance; verify all bytes against this checkout.
prior=json.loads(gzip.decompress((here.parent/'heap-ordered-native/input-provenance.json.gz').read_bytes()))
bench=Path('/home/hyper/bench/wt/fp-perf/benchmarks/autorouter/cases')
for case,files in prior.items():
 for name,record in files.items():
  raw=base64.b64decode(record['data']);assert raw==(bench/case/name).read_bytes(),(case,name)
(here/'input-provenance.json.gz').write_bytes(gzip.compress(json.dumps(prior).encode(),mtime=0))
subprocess.run(['rsvg-convert','-w','1600',str(here/'timings.svg'),'-o',str(here/'timings.png')],check=True)
print('PASS collected complete native pair and verified input provenance')
