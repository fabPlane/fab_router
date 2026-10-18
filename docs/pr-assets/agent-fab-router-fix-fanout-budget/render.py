import json, subprocess
from pathlib import Path
root=Path(__file__).parent
parts=['<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="520"><rect width="1000" height="520" fill="#fafafa"/><g font-family="sans-serif" fill="#25333d"><text x="55" y="45" font-size="25">Atomic fanout escapes respect the item budget</text><text x="55" y="80" font-size="18">Copper items added; three identical repeats per version</text>']
for i in range(5):
    x=115+i*175
    for version,off,color in [('before',0,'#cf654b'),('after',57,'#347c92')]:
        row=json.loads((root/f'{version}.json').read_text())[i]
        count=len(row['tracks'])+len(row['barrels']); h=count*65
        parts.append(f'<rect x="{x+off}" y="{395-h}" width="48" height="{h}" fill="{color}"/><text x="{x+off+15}" y="{383-h}" font-size="20">{count}</text>')
    parts.append(f'<text x="{x}" y="430" font-size="18">Budget {i}</text>')
parts.append('<text x="115" y="485" font-size="20" fill="#cf654b">Before</text><text x="260" y="485" font-size="20" fill="#347c92">After</text></g></svg>')
(root/'budget.svg').write_text(''.join(parts))
subprocess.run(['rsvg-convert','-w','1600',str(root/'budget.svg'),'-o',str(root/'budget.png')],check=True)
