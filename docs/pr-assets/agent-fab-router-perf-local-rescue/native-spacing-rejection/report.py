"""Render all measured frozen cases without dropping failed attempts."""
from pathlib import Path
from statistics import median
import json,sys
source,out=map(Path,sys.argv[1:]);d=json.loads(source.read_text());rows=d['attempts'];assert len(rows)==78
lines=['# Fresh paired native measurements','','Same 26 frozen cases, three repeats per source, host and cores 12–19. Recovery enabled in both modes. Same production baseline with exactly four corner-offset replacements in the isolated candidate. Sequential sweeps, no overlapping own heavy jobs; shared-host timing is observational.','','| Native mode | Passed /78 | Valid /26 | Opens | Known new errors | Median / p95 s | Total s | Vias | Length sum mm |','| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |']
for mode,label in [('before','Global proposal offset'),('after','Obstacle kind/sheet proposal offset')]:
 x=d['summary'][mode];lines.append(f"| {label} | {x['passed']} | {x['valid_cases_3of3']} | {x['opens']} | {x['new_errors']} | {x['median_s']:.6f} / {x['p95_s']:.6f} | {x['total_s']:.6f} | {x['vias']} | {x['length_mm']:.6f} |")
lines+=['',f"Unchanged sessions: {d['same_sessions']}/78. Structured-error, warning-geometry, fidelity and completion regressions: {len(d['regressions'])}. Existing errors remain unresolved; the suite is not DRC clean.",'','Three repeats per case. p95 for three observations is their maximum; opens/errors/vias/length are totals over the same three attempts.','','| Case | Passed before→after /3 | Opens | Errors | Vias | Length sum mm | Median s before→after | p95 s before→after |','| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |']
for case in sorted({r['case']for r in rows}):
 rr=[r for r in rows if r['case']==case];assert len(rr)==3
 cols=[case]
 for key in ['passed','opens','new_errors','vias','length_mm']:
  v=[sum(r[m][key]for r in rr)for m in ['before','after']];cols.append('→'.join(f'{x:.3f}'if key=='length_mm'else str(x)for x in v))
 for fn in [median,max]:cols.append('→'.join(f"{fn(r[m]['seconds']for r in rr):.6f}"for m in ['before','after']))
 lines.append('| '+' | '.join(cols)+' |')
out.write_text('\n'.join(lines)+'\n')
