"""Render measured open counts from the repeated acceptance reports."""
import json
from pathlib import Path
import subprocess
root = Path(__file__).resolve().parent
r = json.loads((root / 'results.json').read_text())
labels = {'main':'Main', 'reverse':'Reverse search', 'fine':'Finer grid', 'exact':'Exact edges', 'endcap':'End-cap access'}
rows = []
for key, label in labels.items():
    counts = [x['report']['cases'][0]['measured']['incomplete'] for x in r['results'] if x['variant'] == key]
    assert len(counts) == 3 and len(set(counts)) == 1
    rows.append((label, counts[0]))
svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="650" viewBox="0 0 1200 650">',
       '<rect width="1200" height="650" fill="#f6f8fc"/>',
       '<g font-family="DejaVu Sans, sans-serif" fill="#1b2940">',
       '<text x="65" y="65" font-size="30">No-via acceptance remains unresolved</text>',
       '<text x="65" y="103" font-size="18">Issue026 J2 · same input and rules · three repeats per variant · lower is better</text>']
for i, (label, value) in enumerate(rows):
    x=105+i*215; h=value*24
    svg += [f'<rect x="{x}" y="{470-h}" width="145" height="{h}" rx="5" fill="#51749c"/>',
            f'<text x="{x+72}" y="{452-h}" text-anchor="middle" font-size="26">{value}</text>',
            f'<text x="{x+72}" y="508" text-anchor="middle" font-size="18">{label}</text>']
svg += ['<path d="M65 326H1150" stroke="#bc4938" stroke-width="3" stroke-dasharray="10 7"/>',
        '<text x="73" y="315" fill="#a73729" font-size="18">Acceptance maximum: 6 opens</text>',
        '<text x="65" y="567" font-size="19">Every run: 0 added vias, 0 added engine violations, acceptance FAIL.</text>',
        '<text x="65" y="601" font-size="17">Scratch proposals only. Native DRC and thermal safety are not evaluated here.</text>',
        '</g></svg>']
(root/'opens.svg').write_text('\n'.join(svg))
subprocess.run(['rsvg-convert','-w','1600',str(root/'opens.svg'),'-o',str(root/'opens.png')],check=True)
