from pathlib import Path
from statistics import median
import json,sys
p=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(exist_ok=True)
d=json.loads(p.read_text());assert len(d['attempts'])==78
assert not d['regressions'] and d['same_sessions']==78
rows=[]
for case in sorted({r['case'] for r in d['attempts']}):
 rr=[r for r in d['attempts'] if r['case']==case];assert len(rr)==3 and {r['seed'] for r in rr}=={1,2,3}
 row={'case':case}
 for mode in ['before','after']:
  row[mode]={**{k:sum(r[mode][k] for r in rr) for k in ['passed','opens','new_errors','vias','length_mm']},'median_s':median(r[mode]['seconds'] for r in rr),'p95_s':max(r[mode]['seconds'] for r in rr)}
 rows.append(row)
for m in ['before','after']:
 d['summary'][m]['sum_case_medians_s']=sum(r[m]['median_s'] for r in rows)
 d['summary'][m]['sum_case_p95_s']=sum(r[m]['p95_s'] for r in rows)
(out/'summary.json').write_text(json.dumps({'summary':d['summary'],'cases':rows,'same_sessions':78},indent=2)+'\n')
t='| Case (3 repeats) | Median before / after s | p95 before / after s | Passed | Opens | New errors |\n|---|---:|---:|---:|---:|---:|\n'
for r in rows:
 a,b=r['before'],r['after'];t+=f"| {r['case']} | {a['median_s']:.4f} / {b['median_s']:.4f} | {a['p95_s']:.4f} / {b['p95_s']:.4f} | {a['passed']} / {b['passed']} | {a['opens']} / {b['opens']} | {a['new_errors']} / {b['new_errors']} |\n"
(out/'table.md').write_text(t)
s=['<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1150"><rect width="100%" height="100%" fill="white"/><g font-family="sans-serif" fill="#20313d"><text x="30" y="40" font-size="26">Exact ring containment with recovery: full native 26 × 3</text><text x="30" y="78" font-size="18">Same host, cores 12–19; sequential sweeps; shared-host timing is observational.</text><text x="30" y="106" font-size="18">All 78 paired sessions identical. Gray: original. Blue: candidate. Bars: median route seconds.</text>']
mx=max(r[m]['median_s'] for r in rows for m in ['before','after'])
for i,r in enumerate(rows):
 y=135+35*i;s.append(f'<text x="30" y="{y+17}" font-size="15">{r["case"]}</text>')
 for j,(m,c) in enumerate([('before','#87939b'),('after','#217e93')]):
  s.append(f'<rect x="530" y="{y+13*j}" width="{r[m]["median_s"]/mx*790:.3f}" height="11" fill="{c}"/>')
 s.append(f'<text x="1340" y="{y+18}" font-size="16">{r["before"]["median_s"]:.3f} / {r["after"]["median_s"]:.3f}</text>')
a,b=d['summary']['before'],d['summary']['after']
s.append(f'<text x="30" y="1080" font-size="19">Total route: {a["total_s"]:.3f} → {b["total_s"]:.3f} s; p95: {a["p95_s"]:.3f} → {b["p95_s"]:.3f} s.</text>')
improved_medians=sum(r['after']['median_s']<r['before']['median_s'] for r in rows)
improved_p95=sum(r['after']['p95_s']<r['before']['p95_s'] for r in rows)
p95_change=100*(b['sum_case_p95_s']/a['sum_case_p95_s']-1)
s.append(f'<text x="30" y="1118" font-size="18">{improved_medians}/26 medians and {improved_p95}/26 case p95 improve; sum of case p95 change {p95_change:+.2f}%. Known native errors remain.</text></g></svg>')
(out/'timings.svg').write_text(''.join(s)+'\n')
print(json.dumps(d['summary']))
