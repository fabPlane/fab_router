from pathlib import Path
import json,sys
p=Path(sys.argv[1]);s=json.loads((p/'summary.json').read_text());t=s['timings']
rows=['| Complete engine replay | Original | Ordered hole |','|---|---:|---:|']
for i in range(3):rows.append(f"| Repeat {i+1} (s) | {t['original']['seconds'][i]:.6f} | {t['candidate']['seconds'][i]:.6f} |")
for key,label in [('median_s','Median (s)'),('max_s','Maximum (s)')]:rows.append(f"| {label} | {t['original'][key]:.6f} | {t['candidate'][key]:.6f} |")
rows+=['| SES / stats / recovery decisions | Independent control match | Independent control match |','',s['scope']+'.']
(p/'table.md').write_text('\n'.join(rows)+'\n')
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="520"><rect width="1000" height="520" fill="white"/><g font-family="sans-serif" fill="#202a35"><text x="40" y="42" font-size="24">Ordered hole heap sifting</text><text x="40" y="76" font-size="17">One complete board; three alternating pairs; identical output</text>']
for i,(mode,label,color) in enumerate([('original','Original','#527a99'),('candidate','Ordered hole','#d39339')]):
    x=190+i*390;scale=260/max(t[m]['max_s'] for m in t);h=t[mode]['median_s']*scale
    svg.append(f'<rect x="{x}" y="{410-h}" width="200" height="{h}" fill="{color}"/><text x="{x}" y="450" font-size="21">{label}</text><text x="{x}" y="{395-h}" font-size="20">{t[mode]["median_s"]:.3f} s median</text>')
    for v in t[mode]['seconds']:svg.append(f'<circle cx="{x+100}" cy="{410-v*scale}" r="5" fill="#202a35"/>')
svg.append('<text x="40" y="495" font-size="16">Shared host observations; no full-suite or native quality claim</text></g></svg>')
(p/'timing.svg').write_text(''.join(svg)+'\n')
