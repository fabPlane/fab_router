import pathlib,subprocess,xml.etree.ElementTree as ET
root=pathlib.Path(__file__).resolve().parent;asset=pathlib.Path('/home/hyper/bench/wt/fr-bugs/docs/pr-assets/agent-fab-router-native-drc-gate/c207-aquarius-connectivity')
svgs=[]
for name,path in [('source',root/'minimized/source/board.kicad_pcb'),('reduced',root/'minimized/final-0/board.kicad_pcb')]:
 svg=root/(name+'.svg');p=subprocess.run(['kicad-cli','pcb','export','svg','--layers','B.Cu','--mode-single','--exclude-drawing-sheet','--output',str(svg),str(path)],capture_output=True,text=True,timeout=120);(root/(name+'-render.log')).write_text(p.stdout+p.stderr);assert p.returncode==0
 doc=ET.fromstring(svg.read_text());inner=''.join(ET.tostring(n,encoding='unicode') for n in doc if n.tag.endswith('g'))
 svgs.append(inner)
parts=['<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1020" viewBox="0 0 1600 1020"><rect width="1600" height="1020" fill="#f3f6fb"/>']
def txt(x,y,t,size=27):parts.append(f'<text x="{x}" y="{y}" font-family="sans-serif" font-size="{size}" fill="#203247">{t}</text>')
txt(40,55,'Three signal tracks isolate a previously connected ground pad',35)
txt(40,100,'Real benchmark witness · B.Cu after native zone refill · source geometry and rules retained',23)
for x,name,inner in [(40,'Source: 0 errors; 110 opens',svgs[0]),(820,'Source + 3 tracks: 61 ground pairs lost',svgs[1])]:
 txt(x,150,name,25)
 parts.append(f'<svg x="{x}" y="175" width="740" height="650" viewBox="170.0 46.2 7.5 6.6" preserveAspectRatio="xMidYMid meet"><rect x="170.0" y="46.2" width="7.5" height="6.6" fill="#111a22"/>{inner}<circle cx="173.200553" cy="48.414447" r="1.1" fill="none" stroke="#ffe079" stroke-width="0.045"/></svg>')
txt(40,875,'466 generated copper items → 3 segments; source GNDD group splits 62 → 61 + 1',27)
txt(40,925,'Removing any one of the 3 tracks restores all source-connected pad pairs',25)
txt(40,978,'Diagnostic reduction, not a repaired route. Full routing score and thermal errors are unchanged.',24)
parts.append('</svg>');svg=asset/'comparison.svg';svg.write_text('\n'.join(line.rstrip() for line in '\n'.join(parts).splitlines())+'\n');subprocess.run(['rsvg-convert',str(svg),'-o',str(asset/'comparison.png')],check=True)
