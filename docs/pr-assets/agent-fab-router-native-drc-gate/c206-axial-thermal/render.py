import base64,json,pathlib,shutil,subprocess,xml.etree.ElementTree as ET
root=pathlib.Path(__file__).resolve().parent;asset=pathlib.Path('/home/hyper/bench/wt/fr-bugs/docs/pr-assets/agent-fab-router-native-drc-gate/c206-axial-thermal');asset.mkdir(parents=True,exist_ok=True)
svgs=[]
for name in ('routed','repaired'):
 d=root/'render'/name;d.mkdir(parents=True)
 src=root/'native-after-0'
 board=(src/'routed.kicad_pcb').read_bytes() if name=='routed' else base64.b64decode(json.loads((src/'accepted.json').read_text())['candidate'][0]['base64'])
 (d/'board.kicad_pcb').write_bytes(board)
 for ext in ('.kicad_pro','.kicad_dru'):shutil.copyfile(src/('source'+ext),d/('board'+ext))
 for command in [ ['kicad-cli','pcb','drc','--severity-all','--format','json','--refill-zones','--save-board','--output',str(d/'drc.json'),str(d/'board.kicad_pcb')], ['kicad-cli','pcb','export','svg','--layers','B.Cu','--mode-single','--exclude-drawing-sheet','--output',str(d/'board.svg'),str(d/'board.kicad_pcb')]]:
  p=subprocess.run(command,capture_output=True,text=True,timeout=120);(d/('drc.log' if 'drc' in command else 'export.log')).write_text(p.stdout+p.stderr);assert p.returncode==0
 doc=ET.fromstring((d/'board.svg').read_text());svgs.append(''.join(ET.tostring(n,encoding='unicode') for n in doc if n.tag.endswith('g')))
parts=['<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1010" viewBox="0 0 1600 1010"><rect width="1600" height="1010" fill="#f3f6fb"/>']
def txt(x,y,t,size=27):parts.append(f'<text x="{x}" y="{y}" font-family="sans-serif" font-size="{size}" fill="#203247">{t}</text>')
txt(40,55,'Restore a ground-pad thermal with a bounded axial detour',34)
txt(40,105,'Native B.Cu refill · same endpoints, source geometry and rules · three repeated checks',23)
for x,name,inner in [(40,'Before: 1 thermal error; 111 opens',svgs[0]),(820,'After: 0 errors; 110 opens',svgs[1])]:
 txt(x,155,name,26);parts.append(f'<svg x="{x}" y="180" width="740" height="650" viewBox="170.8 46.2 7.5 6.6" preserveAspectRatio="xMidYMid meet"><rect x="170.8" y="46.2" width="7.5" height="6.6" fill="#111a22"/>{inner}<circle cx="173.200553" cy="48.414447" r="1.1" fill="none" stroke="#ffe079" stroke-width="0.045"/></svg>')
txt(40,880,'One proposal restores the source open budget; zero source or routed pad pairs lost',26)
txt(40,930,'Reduced complete-board control. Full Aquarius routing remains blocked by source connectivity.',23)
txt(40,975,'Optional offline search; default routing behavior is unchanged.',23);parts.append('</svg>')
svg=asset/'comparison.svg';svg.write_text('\n'.join(line.rstrip() for line in '\n'.join(parts).splitlines())+'\n');subprocess.run(['rsvg-convert',str(svg),'-o',str(asset/'comparison.png')],check=True)
