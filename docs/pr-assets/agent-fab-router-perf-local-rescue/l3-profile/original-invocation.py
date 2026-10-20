from pathlib import Path
import subprocess,json,gzip,hashlib,collections
w=Path(__file__).resolve().parent
repo=Path('/home/hyper/bench/wt/fr-perf')
asset=repo/'docs/pr-assets/agent-fab-router-perf-local-rescue/l3-replication'
summary={}
for mode in ['candidate','original']:
 with (w/f'{mode}.log').open('w') as log:
  subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','--kill-after=5','900','bun','--cpu-prof','--cpu-prof-dir',str(w),'--cpu-prof-name',f'{mode}.cpuprofile',str(asset/'stress.ts'),f'/home/hyper/bench/agents/codex-fabpcb-perf/scratch/cycle81/{mode}','/home/hyper/bench/boards/ladder/l3-cycle18.dsn',str(w/mode)],stdout=log,stderr=subprocess.STDOUT,check=True)
 result=json.loads((w/mode/'result.json').read_text());ref=json.loads((asset/f'1-{mode}'/'result.json').read_text())
 for r in [result,ref]:
  r.pop('seconds');r['report'].pop('wallClockMs')
 assert result==ref
 assert (w/mode/'board.ses').read_bytes()==(asset/f'1-{mode}'/'board.ses').read_bytes()
 d=json.loads((w/f'{mode}.cpuprofile').read_text());nodes={n['id']:n for n in d['nodes']};counts=collections.Counter()
 for n,t in zip(d['samples'],d['timeDeltas']):
  f=nodes[n]['callFrame'];counts[(f['functionName'],f['url'].replace('/home/hyper/bench/agents/codex-fabpcb-perf/scratch/cycle81/',''),f['lineNumber']+1)]+=t
 summary[mode]=[dict(function=k[0],file=k[1],line=k[2],self_sample_ms=v/1000) for k,v in counts.most_common(40)]
 print(mode,'parity PASS',flush=True)
(w/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
with (w/'checks.log').open('w') as log:
 subprocess.run(['taskset','-c','12-19','nice','-n','10','timeout','--kill-after=10','1800','bash','-c','bun run typecheck && bun run check:layers && bun run test'],cwd=repo,stdout=log,stderr=subprocess.STDOUT,check=True)
print('checks PASS',flush=True)
