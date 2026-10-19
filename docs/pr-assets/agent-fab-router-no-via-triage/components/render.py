"""Render measured engine-only diagnostic counts; requires rsvg-convert."""
import argparse,json,subprocess
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__);p.add_argument('results',type=Path);p.add_argument('--out',type=Path,required=True);a=p.parse_args()
data=json.loads(a.results.read_text())['results'];a.out.mkdir(parents=True,exist_ok=True)
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="560" viewBox="0 0 1100 560">','<rect width="1100" height="560" fill="#f5f7fa"/>','<g font-family="sans-serif" fill="#162536">','<text x="55" y="48" font-size="27">Search budget diagnosis — unchanged no-via case</text>','<text x="55" y="80" font-size="18">Three repeats per budget; engine checks only; acceptance requires ≤6 opens</text>']
for i,factor in enumerate((1,8)):
    rows=[r for r in data if r.get('scope')=='acceptance' and r['factor']==factor]
    values=[r['report']['cases'][0]['measured']['incomplete'] for r in rows]
    assert len(values)==3 and len(set(values))==1
    y=140+i*125;v=values[0]
    svg.extend([f'<text x="55" y="{y+30}" font-size="22">Budget ×{factor}</text>',f'<rect x="235" y="{y}" width="{v*52}" height="55" fill="{("#b85651" if factor==1 else "#377c99")}"/>',f'<text x="{250+v*52}" y="{y+35}" font-size="24">{v} opens</text>'])
svg.extend(['<path d="M547 125V335" stroke="#162536" stroke-dasharray="8 5" stroke-width="2"/>','<text x="535" y="365" font-size="18">Maximum six</text>','<text x="55" y="425" font-size="21">All five isolated capped pairs have reachable goals on the original grids.</text>','<text x="55" y="462" font-size="21">Budget ×8 connects all five; retained copper and engine DRC are preserved.</text>','<text x="55" y="505" font-size="18">Acceptance still fails 3/3. Native thermal safety and full-suite nonregression unmeasured.</text>','</g></svg>'])
path=a.out/'budget.svg';path.write_text('\n'.join(svg));subprocess.run(['rsvg-convert','-w','1600',str(path),'-o',str(a.out/'budget.png')],check=True)
