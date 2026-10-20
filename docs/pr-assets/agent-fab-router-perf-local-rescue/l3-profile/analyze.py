"""Verify profile replay parity and report top self-samples, for raw or retained runs."""
from pathlib import Path
import collections,gzip,json,sys
w=Path(sys.argv[1]);reference=Path(__file__).resolve().parent.parent/'l3-replication'
summary={}
for mode in ['candidate','original']:
 result=json.loads((w/mode/'result.json').read_text());ref=json.loads((reference/f'1-{mode}'/'result.json').read_text())
 for r in [result,ref]:
  r.pop('seconds');r['report'].pop('wallClockMs')
 assert result==ref,(mode,'report changed')
 assert (w/mode/'board.ses').read_bytes()==(reference/f'1-{mode}'/'board.ses').read_bytes(),(mode,'session changed')
 p=w/f'{mode}.cpuprofile';raw=p.read_bytes() if p.exists() else gzip.decompress(p.with_suffix('.cpuprofile.gz').read_bytes())
 d=json.loads(raw);assert len(d['samples'])==len(d['timeDeltas']);nodes={n['id']:n for n in d['nodes']};counts=collections.Counter()
 for n,t in zip(d['samples'],d['timeDeltas']):
  f=nodes[n]['callFrame'];url=f['url'];url=url[url.index('/src/')+1:] if '/src/' in url else url
  counts[(f['functionName'],url,f['lineNumber']+1)]+=t
 summary[mode]=[dict(function=k[0],file=k[1],line=k[2],self_sample_ms=v/1000) for k,v in counts.most_common(40)]
print(json.dumps(summary,indent=2))
