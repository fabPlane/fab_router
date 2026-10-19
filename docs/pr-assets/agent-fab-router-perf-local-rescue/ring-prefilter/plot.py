from pathlib import Path
import json,subprocess
A=Path(__file__).resolve().parent
s=json.loads(subprocess.check_output(['python3',str(A/'verify.py')]))
parts=['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="560"><rect width="1200" height="560" fill="white"/><g font-family="sans-serif" fill="#182738"><text x="40" y="48" font-size="26">Closed-y edge prefilter: isolated experiment</text><text x="40" y="80" font-size="18">Same 92-vertex board; engine session and statistics identical in all six replays</text>']
for section,y,title,unit in [('predicate',150,'Predicate median, five alternating repeats','ms'),('engine',330,'Complete engine replay median, three alternating repeats','s')]:
 parts.append(f'<text x="40" y="{y}" font-size="20">{title}</text>')
 maxv=max(x['median'] for x in s[section].values())
 for k,(mode,x) in enumerate(s[section].items()):
  v=x['median']; yy=y+25+k*49
  parts.append(f'<text x="40" y="{yy+25}" font-size="18">{mode}</text><rect x="160" y="{yy}" width="{800*v/maxv}" height="32" fill="{["#64748b","#0f766e"][k]}"/><text x="980" y="{yy+24}" font-size="18">{v*(1000 if unit=="ms" else 1):.3f} {unit}</text>')
parts.append('<text x="40" y="535" font-size="18">No full-suite/native DRC rerun. No production adoption or routing speed claim.</text></g></svg>')
(A/'timing.svg').write_text(''.join(parts))
