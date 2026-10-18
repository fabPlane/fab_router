"""Render actual native /sense1 copper before/after. Run with system Python (pcbnew)."""
import json, pathlib, subprocess, sys
import pcbnew
out = pathlib.Path(__file__).parent
case = 'fan-controller-fan-controller-j1'
parts = ['<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="800" viewBox="0 0 1440 800"><rect width="1440" height="800" fill="#101827"/><g fill="#e2e8f0" font-family="sans-serif"><text x="45" y="45" font-size="26">Fan controller J1: isolated router copper on /sense1</text><text x="45" y="78" font-size="18">Actual native output geometry • same case, seed 1 • red F.Cu / blue B.Cu</text>']
for panel, folder in enumerate(sys.argv[1:3]):
    folder = pathlib.Path(folder)
    row = next(r for r in json.loads((folder/'results.json').read_text()) if r['case']==case and r['seed']==1)
    board = pcbnew.LoadBoard(str(folder/row['evidence']/'work/output.kicad_pcb'))
    xoff = 45 + panel * 710
    parts.append(f'<text x="{xoff}" y="120" font-size="22">{"Before" if panel==0 else "After"}: {row["opens"]} native opens (whole board)</text>')
    positions = [p.GetPosition() for fp in board.GetFootprints() for p in fp.Pads() if p.GetNetname() == '/sense1']
    xs, ys = [pcbnew.ToMM(p.x) for p in positions], [pcbnew.ToMM(p.y) for p in positions]
    xmin, ymin = min(xs)-3, min(ys)-3
    scale = min(570/(max(xs)-xmin+3), 490/(max(ys)-ymin+3))
    def xy(pt):
        return (xoff + 35 + (pcbnew.ToMM(pt.x)-xmin)*scale, 170 + (pcbnew.ToMM(pt.y)-ymin)*scale)
    for t in board.GetTracks():
        if t.GetNetname() != '/sense1': continue
        a,b=xy(t.GetStart()),xy(t.GetEnd())
        if isinstance(t,pcbnew.PCB_VIA):
            parts.append(f'<circle cx="{a[0]}" cy="{a[1]}" r="5.1" fill="#d4af37" stroke="#fef3c7" stroke-width="1"/>')
        else:
            color = '#ef6666' if t.GetLayerName()=='F.Cu' else '#65a5ff'
            parts.append(f'<path d="M {a[0]},{a[1]} L {b[0]},{b[1]}" fill="none" stroke="{color}" stroke-width="4.25" stroke-linecap="round"/>')
    for fp in board.GetFootprints():
        for p in fp.Pads():
            if p.GetNetname() != '/sense1': continue
            x,y=xy(p.GetPosition())
            parts.append(f'<circle cx="{x}" cy="{y}" r="10" fill="#cbd5e1"/><text x="{x+15}" y="{y}" font-size="16">{fp.GetReference()}-{p.GetNumber()}</text>')
parts.append('<text x="45" y="740" font-size="18">Cleanup removes only unanchored components made entirely of free router tracks/vias.</text><text x="45" y="770" font-size="18">Pad/pour attachments and components containing retained copper are preserved.</text></g></svg>')
svg=out/'native-orphan.svg'
svg.write_text(''.join(parts))
subprocess.run(['rsvg-convert','-w','1440',str(svg),'-o',str(out/'native-orphan.png')],check=True)
