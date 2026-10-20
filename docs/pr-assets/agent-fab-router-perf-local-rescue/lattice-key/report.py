from pathlib import Path
import json,sys
p=Path(sys.argv[1]);s=json.loads((p/'summary.json').read_text());t=s['timings']
rows=['| Complete engine replay | Original | Hoisted cell keys |','|---|---:|---:|']
for i in range(3): rows.append(f"| Repeat {i+1} (s) | {t['original']['seconds'][i]:.6f} | {t['candidate']['seconds'][i]:.6f} |")
for key,label in [('median_s','Median (s)'),('max_s','Maximum (s)')]:rows.append(f"| {label} | {t['original'][key]:.6f} | {t['candidate'][key]:.6f} |")
rows+=['| SES bytes / final stats / recovery decisions | Independent control match | Independent control match |','',s['scope']+'. Historical native findings remain unresolved.']
(p/'table.md').write_text('\n'.join(rows)+'\n')
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="520" viewBox="0 0 1000 520"><rect width="1000" height="520" fill="white"/><g font-family="sans-serif" fill="#202a35"><text x="50" y="42" font-size="24">Complete engine replay: cell-key hoisting prerequisite</text><text x="50" y="76" font-size="17">One board; three alternating repeats per source; exact output parity</text>']
for i,(mode,label,color) in enumerate([('original','Original','#527a99'),('candidate','Hoisted cell keys','#d39339')]):
    x=190+i*390;h=t[mode]['median_s']*6
    svg.append(f'<rect x="{x}" y="{410-h}" width="200" height="{h}" fill="{color}"/><text x="{x}" y="450" font-size="21">{label}</text><text x="{x}" y="{395-h}" font-size="20">{t[mode]["median_s"]:.3f} s median</text>')
    for v in t[mode]['seconds']:svg.append(f'<circle cx="{x+100}" cy="{410-v*6}" r="5" fill="#202a35"/>')
svg.append('<text x="50" y="495" font-size="16">Shared host observation; native checker and full suite not rerun; no adoption</text></g></svg>')
(p/'timing.svg').write_text(''.join(svg)+'\n')
