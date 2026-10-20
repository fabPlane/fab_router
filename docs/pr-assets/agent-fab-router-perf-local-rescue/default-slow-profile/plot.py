from pathlib import Path
import json,html,subprocess
p=Path(__file__).resolve().parent;s=json.loads((p/'summary.json').read_text());lines=['<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="980"><rect width="100%" height="100%" fill="white"/>']
def text(x,y,t,size=18):lines.append(f'<text x="{x}" y="{y}" font-family="sans-serif" font-size="{size}">{html.escape(t)}</text>')
text(30,35,'Default-setting slow cases: sampled CPU hotspots',28);text(30,65,'One profile/case, recovery disabled. Nested inclusive weights overlap; no speed comparison.',18)
y=100
for case,d in s.items():
 text(30,y,case,23);y+=28
 frames=sorted([f for f in d['profile']['frames'] if f['file'].startswith('src/')],key=lambda f:f['self_ms'],reverse=True)[:6]
 total=d['profile']['sampled_ms']
 for f in frames:
  text(30,y+17,f"{f['function'] or '(anonymous)'} ({f['file']}:{f['line']})",15)
  w=f['self_ms']/total*650;lines.append(f'<rect x="650" y="{y}" width="{w:.2f}" height="20" fill="#227fa7"/>');text(660+w,y+17,f"{f['self_ms']/1000:.3f}s self ({f['self_ms']/total:.1%})",15);y+=31
 y+=32
text(30,955,'Exact sessions and non-timing reports match retained native-run exports and fresh unprofiled replays.',17)
lines.append('</svg>');(p/'hotspots.svg').write_text('\n'.join(lines));subprocess.run(['rsvg-convert','-w','1600',str(p/'hotspots.svg'),'-o',str(p/'hotspots.png')],check=True)
