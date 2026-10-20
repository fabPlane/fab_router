import json,pathlib,subprocess
root=pathlib.Path(__file__).resolve().parent
out=pathlib.Path('/home/hyper/bench/wt/fr-bugs/docs/pr-assets/agent-fab-router-native-drc-gate/c209-native-ownership');out.mkdir(parents=True,exist_ok=True)
rows=json.loads((root/'measurement.json').read_text());assert len(rows)==12
parts=['<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="960"><rect width="1600" height="960" fill="#f3f6fb"/>']
def text(x,y,s,size=30):parts.append(f'<text x="{x}" y="{y}" font-family="sans-serif" font-size="{size}" fill="#203247">{s}</text>')
text(55,65,'Reject native load-time track ownership changes',42)
text(55,115,'Same outlined board on hyper-ms-lin · three repeats per version and control',26)
text(55,173,'One pad on SIGNAL_B; touching track submitted on SIGNAL_A',29)
for x,phase,label in [(100,'before','Before guard'),(850,'after','After guard')]:
 text(x,245,label,35)
 for j,(mode,title) in enumerate([('candidate','Reassigned track'),('control','Matching-net control')]):
  y=300+j*150;count=sum(r['accepted'] for r in rows if r['phase']==phase and r['mode']==mode)
  text(x,y,title,27);parts.append(f'<rect x="{x}" y="{y+20}" width="540" height="60" rx="8" fill="#dae2eb"/>')
  if count:parts.append(f'<rect x="{x}" y="{y+20}" width="{180*count}" height="60" rx="8" fill="{"#b64949" if mode=="candidate" else "#298066"}"/>')
  text(x+560,y+62,f'{count}/3',32)
text(55,665,'Bars show accepted candidates; all 12 checks report zero errors and zero opens.',28)
text(55,725,'Before: unsafe ownership accepted 3/3. After: unsafe ownership blocked 3/3.',30)
text(55,795,'Ownership check also blocks repair progress and offline bundle publication.',28)
text(55,855,'Synthetic native regression; no new full routing score or speed claim.',25)
text(55,925,'Retained axial candidate: unsafe ownership blocked 3/3 (previously accepted 3/3).',25)
parts.append('</svg>');(out/'comparison.svg').write_text('\n'.join(parts)+'\n');subprocess.run(['rsvg-convert',str(out/'comparison.svg'),'-o',str(out/'comparison.png')],check=True)
