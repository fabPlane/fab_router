"""Verify exact retained inputs, sessions, non-timing reports and profile weights."""
from pathlib import Path
import json,hashlib,gzip,sys
from stack_analysis import analyze
p=Path(__file__).resolve().parent

def normalized(d):
 d=json.loads(json.dumps(d));d['result']['report'].pop('wallClockMs');return d

def verify(root):
 audit=json.loads((root/'audit.json').read_text());summary={}
 for case,meta in audit['inputs'].items():
  inp=root/case
  for f,h in meta['hashes'].items():
   assert hashlib.sha256((inp/f).read_bytes()).hexdigest()==h,(case,f,'input hash')
  ref=json.loads((inp/'router-summary.json').read_text())
  assert ref['settings'].get('localRecovery') is not True
  modes={}
  for mode in ['unprofiled','profiled']:
   name=case+'-'+mode;d=root/'runs'/name
   report=json.loads((d/'router-summary.json').read_text())
   assert normalized(report)==normalized(ref),(name,'report mismatch')
   assert (d/'board.ses').read_bytes()==(inp/'board.ses').read_bytes(),(name,'session mismatch')
   modes[mode]=json.loads((d/'timing.json').read_text())
  raw=root/'runs'/(case+'-profiled.cpuprofile')
  profile=json.loads(raw.read_text()) if raw.exists() else json.loads(gzip.decompress(raw.with_suffix('.cpuprofile.gz').read_bytes()))
  stats=analyze(profile)
  assert abs(sum(f['self_ms'] for f in stats['frames'])-stats['sampled_ms'])<1e-5
  assert all(f['inclusive_ms']<=stats['sampled_ms']+1e-5 for f in stats['frames'])
  summary[case]={'timings':modes,'profile':stats,'engine_incomplete':ref['result']['report']['incompleteAfter'],'violations_added':ref['result']['report']['violationsAdded'],'stats':ref['result']['statsAfter']}
 return summary
if __name__=='__main__':
 root=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else p
 print(json.dumps(verify(root),indent=2))
