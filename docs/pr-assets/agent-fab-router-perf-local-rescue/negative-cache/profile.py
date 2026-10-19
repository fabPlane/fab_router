"""Replay self samples from paired saved-session CPU profiles (not route timings)."""
from pathlib import Path
from collections import Counter
import gzip,json,sys
here=Path(__file__).resolve().parent
out={}
for mode in ['before','after']:
 d=json.loads(gzip.decompress((here/f'{mode}.cpuprofile.gz').read_bytes()))
 nodes={n['id']:n['callFrame']for n in d['nodes']}
 counts=Counter(nodes[i]['functionName']for i in d['samples'])
 out[mode]={'samples':len(d['samples']),'duration_us':d['endTime']-d['startTime'],'top_self_samples':counts.most_common(15)}
Path(sys.argv[1]).write_text(json.dumps(out,indent=2)+'\n')
