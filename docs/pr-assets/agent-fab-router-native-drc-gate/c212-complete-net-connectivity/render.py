import pathlib,xml.etree.ElementTree as ET
root=pathlib.Path(__file__).resolve().parent
parts=['<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="950"><rect width="1600" height="950" fill="#f6f8fa"/><g font-family="sans-serif" fill="#172b4d"><text x="45" y="60" font-size="36">Aquarius ground-pad cut with two complete generated nets</text>']
for i,(name,title,label) in enumerate([('source','Source B.Cu','U1.53 connected to 61 source peers'),('reduced','+3V3 and /Inputs/TCK added','U1.53 isolated after native refill')]):
 x=40+i*790
 parts.append(f'<text x="{x}" y="110" font-size="28">{title}</text>')
 board=ET.parse(root/(name+'.svg')).getroot()
 board.set('x',str(x));board.set('y','135');board.set('width','740');board.set('height','650');board.set('viewBox','163.0 47.7 6 5.5')
 ET.SubElement(board,'{http://www.w3.org/2000/svg}circle',{'cx':'165.881998','cy':'50.182214','r':'0.45','fill':'none','stroke':'#e87c16','stroke-width':'0.04'})
 parts.append(ET.tostring(board,encoding='unicode'))
 parts.append(f'<text x="{x}" y="825" font-size="23">{label}</text>')
parts.append('<text x="45" y="890" font-size="25">Orange circle: GNDD U1.53. Native 10.0.6 refill; same source geometry and rules.</text><text x="45" y="930" font-size="23">Diagnostic witness only. The gate rejects 61 lost source pairs, despite 110 → 94 opens.</text></g></svg>')
(root/'board-comparison.svg').write_text(''.join(parts))
