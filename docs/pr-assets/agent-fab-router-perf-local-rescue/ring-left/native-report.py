from pathlib import Path
import json,statistics,subprocess
w=Path(__file__).resolve().parent
a=w
x=json.loads((w/'comparison.json').read_text());cases=sorted({r['case']for r in x['attempts']});table=['| Case (3 repeats/version) | Control median / p95 s | Candidate median / p95 s | Median change | Passed both | Opens / native errors both |','|---|---:|---:|---:|---:|---:|'];deltas=[]
for m in ['before','after']:
 x['summary'][m]['sum_case_medians_s']=sum(statistics.median(r[m]['seconds']for r in x['attempts']if r['case']==c)for c in cases)
 x['summary'][m]['sum_case_p95_s']=sum(max(r[m]['seconds']for r in x['attempts']if r['case']==c)for c in cases)
for c in cases:
 rs=[r for r in x['attempts']if r['case']==c];v={m:(statistics.median(r[m]['seconds']for r in rs),max(r[m]['seconds']for r in rs))for m in ['before','after']};delta=100*(v['after'][0]/v['before'][0]-1);deltas.append((c,delta));table.append(f"| {c} | {v['before'][0]:.6f} / {v['before'][1]:.6f} | {v['after'][0]:.6f} / {v['after'][1]:.6f} | {delta:+.2f}% | {sum(r['before']['passed']for r in rs)}/3 | {sum(r['before']['opens']for r in rs)} / {sum(r['before']['new_errors']for r in rs)} |")
(a/'native-summary.json').write_text(json.dumps(x,indent=2)+'\n');(a/'native-table.md').write_text('\n'.join(table)+'\n')
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1320"><rect width="1600" height="1320" fill="#fafafa"/><g font-family="sans-serif" fill="#202020">','<text x="55" y="55" font-size="32">Strict-left ring edge filter: full native timing comparison</text>','<text x="55" y="95" font-size="21">26 cases, 3 repeats per version, same host and cores. Negative = lower candidate median.</text>']
scale=400/max(5,max(abs(d)for _,d in deltas));zero=1080
svg.append(f'<path d="M{zero} 125V1190" stroke="#aaa"/>')
for i,(c,d)in enumerate(deltas):
 y=150+i*39;px=abs(d)*scale
 svg.extend([f'<text x="55" y="{y+20}" font-size="20">{c}</text>',f'<rect x="{zero-px if d<0 else zero}" y="{y}" width="{px}" height="26" fill="{"#586e85"if d<0 else "#c56228"}"/>',f'<text x="{zero+px+12 if d>=0 else zero+12}" y="{y+21}" font-size="20">{d:+.2f}%</text>'])
svg.extend(['<text x="55" y="1240" font-size="21">Control sweep first, candidate second. Shared-host observational timings; individual regressions retained.</text>','<text x="55" y="1280" font-size="21">p95 in accompanying table is the maximum of three attempts. Known native errors remain unresolved.</text>','</g></svg>'])
(a/'native.svg').write_text('\n'.join(svg)+'\n');subprocess.run(['rsvg-convert','-w','1600',a/'native.svg','-o',a/'native.png'],check=True)
print(json.dumps(x['summary'],indent=2))
