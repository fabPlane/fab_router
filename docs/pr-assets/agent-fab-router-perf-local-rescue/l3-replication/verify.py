"""Verify complete six-attempt parity and rebuild the timing summary."""
from pathlib import Path
import gzip,hashlib,json,statistics,sys
w=Path(sys.argv[1]);records=json.loads((w/'records.json').read_text())
assert [(r['pair'],r['mode']) for r in records]==[(p,m) for p in range(1,4) for m in (['candidate','original'] if p%2 else ['original','candidate'])]
if (w/'l3-cycle18.dsn.gz').exists():
 audit=json.loads((w/'source-audit.json').read_text())
 assert hashlib.sha256(gzip.decompress((w/'l3-cycle18.dsn.gz').read_bytes())).hexdigest()==audit['input']['sha256']
reference=None
for r in records:
 p=w/f"{r['pair']}-{r['mode']}"
 assert hashlib.sha256((p/'board.ses').read_bytes()).hexdigest()==r['ses_sha256']
 result=json.loads((p/'result.json').read_text());assert result.pop('seconds')==r['seconds'];result['report'].pop('wallClockMs')
 assert not result['report']['timedOut'] and not result['report']['aborted']
 if reference is None:reference=result
 assert result==reference
assert len({r['ses_sha256'] for r in records})==1
summary={'scope':'three L3 alternating pairs; engine replay only, not a native DRC score','same_sessions':6,'same_non_timing_results':6,'engine_incomplete':reference['report']['incompleteAfter'],'represented_violations_added':reference['report']['violationsAdded'],'stats':reference['stats'],'timing':{}}
for mode in ['original','candidate']:
 times=[r['seconds'] for r in records if r['mode']==mode]
 summary['timing'][mode]={'median_s':statistics.median(times),'p95_max3_s':max(times),'sum_s':sum(times),'times':times}
summary['median_change_percent']=100*(summary['timing']['candidate']['median_s']/summary['timing']['original']['median_s']-1)
(w/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(summary,indent=2))
