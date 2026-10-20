"""Plot every frozen case's observed median ratio, including failed cases."""
from pathlib import Path
from statistics import median
import json,sys,html,subprocess
source,out=map(Path,sys.argv[1:]);d=json.loads(source.read_text());rows=d['attempts'];assert len(rows)==78
cases=sorted({r['case']for r in rows});assert len(cases)==26
ratios=[]
for case in cases:
 rr=[r for r in rows if r['case']==case];a,b=[median(r[m]['seconds']for r in rr)for m in ['before','after']];ratios.append((case,a/b,a,b))
maximum=max(1.5,max(r[1]for r in ratios)*1.08);left,right=555,1460;scale=(right-left)/maximum;H=1200
parts=[f'<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="{H}" viewBox="0 0 1600 {H}">','<rect width="1600" height="1200" fill="white"/>','<g font-family="sans-serif" fill="#1d3142">','<text x="40" y="46" font-size="30" font-weight="bold">Observed median route-time ratio: before / after</text>','<text x="40" y="80" font-size="21">Same 26 frozen cases · 3 repeats/source · cores 12–19 · recovery enabled</text>','<text x="40" y="112" font-size="20">Sequential sweeps overlap tests and stress runs. These ratios do not establish causal speedup.</text>']
for index,(case,ratio,a,b)in enumerate(ratios):
 y=161+index*35;color='#347a65'if ratio>=1 else'#b47728'
 parts += [f'<text x="40" y="{y+17}" font-size="17">{html.escape(case)}</text>',f'<rect x="{left}" y="{y}" height="23" width="{ratio*scale:.4f}" fill="{color}"/>',f'<text x="{left+ratio*scale+10:.4f}" y="{y+18}" font-size="18">{ratio:.3f}</text>']
parts += [f'<path d="M {left+scale:.4f},150 V 1077" stroke="#233b50" stroke-width="2" stroke-dasharray="5 4"/>',f'<text x="{left+scale:.4f}" y="1106" text-anchor="middle" font-size="20">1.0 = equal observed median</text>','<text x="40" y="1150" font-size="20">All attempts retained, including failed cases. See results.md for per-case median/p95 and copper quality.</text>','</g></svg>']
svg=out.with_suffix('.svg');svg.write_text('\n'.join(parts)+'\n');subprocess.run(['rsvg-convert','-w','1600',str(svg),'-o',str(out)],check=True)
