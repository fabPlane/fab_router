"""Render native fan-controller J2-small outputs. Run with system Python (pcbnew).
Usage: python3 render.py BEFORE_RESULTS_DIR AFTER_RESULTS_DIR OUTPUT_SVG
Uses seed 3, including retained copper; colours highlight only the affected net.
"""
import json
from pathlib import Path
import subprocess
import sys
import pcbnew

case = 'fan-controller-fan-controller-j2-small'
net_name = '/ENC_A(CN2)'
svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="700" viewBox="0 0 1600 700">',
       '<rect width="1600" height="700" fill="#111d29"/>',
       '<g font-family="sans-serif" fill="#edf4fa">',
       '<text x="50" y="52" font-size="32">Escape a narrow SMD terminal from its exact centre</text>',
       '<text x="50" y="88" font-size="19" fill="#b7c7d6">Native benchmark outputs · fan-controller J2-small · seed 3 · affected net highlighted</text>']
for col, root in enumerate(map(Path, sys.argv[1:3])):
    row = next(r for r in json.loads((root / 'results.json').read_text()) if r['case'] == case and r['seed'] == 3)
    board = pcbnew.LoadBoard(str(root / row['evidence'] / 'final.kicad_pcb'))
    ox, oy, scale = 50 + 780 * col, 175, 11
    box = board.GetBoardEdgesBoundingBox()
    bx, by = pcbnew.ToMM(box.GetX()), pcbnew.ToMM(box.GetY())
    def xy(p):
        return ox + (pcbnew.ToMM(p.x) - bx) * scale, oy + (pcbnew.ToMM(p.y) - by) * scale
    def circle(p, r, fill, stroke='none', width=1):
        x, y = xy(p)
        return f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r:.2f}" fill="{fill}" stroke="{stroke}" stroke-width="{width}"/>'
    svg.append(f'<text x="{ox}" y="140" font-size="26">{"Before" if col == 0 else "After"}: {row["opens"]} native open{ "s" if row["opens"] != 1 else ""}</text>')
    svg.append(f'<rect x="{ox}" y="{oy}" width="{pcbnew.ToMM(box.GetWidth())*scale:.2f}" height="{pcbnew.ToMM(box.GetHeight())*scale:.2f}" rx="24" fill="#182e32" stroke="#8cb6b0" stroke-width="2"/>')
    tracks = sorted(board.GetTracks(), key=lambda t: t.GetNetname() == net_name)
    for t in tracks:
        active = t.GetNetname() == net_name
        colour = '#ffb45c' if active else '#607577'
        if isinstance(t, pcbnew.PCB_VIA):
            svg.append(circle(t.GetPosition(), pcbnew.ToMM(t.GetWidth(pcbnew.F_Cu)) * scale / 2, colour))
            svg.append(circle(t.GetPosition(), max(1, pcbnew.ToMM(t.GetDrillValue()) * scale / 2), '#182e32'))
        else:
            x1, y1 = xy(t.GetStart()); x2, y2 = xy(t.GetEnd())
            svg.append(f'<path d="M{x1:.2f},{y1:.2f} L{x2:.2f},{y2:.2f}" stroke="{colour}" stroke-width="{max(.6,pcbnew.ToMM(t.GetWidth())*scale):.2f}" fill="none" stroke-linecap="round"/>')
    endpoints = []
    for pad in board.GetPads():
        active = pad.GetNetname() == net_name
        colour = '#ffdc9e' if active else '#839491'
        x, y = xy(pad.GetPosition())
        w, h = pcbnew.ToMM(pad.GetSize().x)*scale, pcbnew.ToMM(pad.GetSize().y)*scale
        if pad.GetShape() == pcbnew.PAD_SHAPE_CIRCLE:
            svg.append(circle(pad.GetPosition(), w/2, colour))
        else:
            svg.append(f'<rect x="{x-w/2:.2f}" y="{y-h/2:.2f}" width="{w:.2f}" height="{h:.2f}" fill="{colour}" transform="rotate({-pad.GetOrientationDegrees():.2f} {x:.2f} {y:.2f})"/>')
        if active:
            endpoints.append((x,y))
            svg.append(circle(pad.GetPosition(), 13, 'none', '#ffdc9e', 2))
    if col == 0:
        (x1,y1),(x2,y2) = endpoints
        svg.append(f'<path d="M{x1},{y1} L{x2},{y2}" stroke="#ff8c8c" stroke-width="2" stroke-dasharray="6 6"/>')
    svg.append(f'<text x="{ox}" y="626" font-size="20">New native DRC errors: {row["new_errors"]} · Net route: {"missing" if col == 0 else "connected"}</text>')
svg += ['<text x="50" y="674" font-size="18" fill="#b7c7d6">Orange: affected net · grey: retained copper and other pads · dashed red: missing connection</text>', '</g></svg>']
output = Path(sys.argv[3]); output.write_text('\n'.join(svg))
subprocess.run(['rsvg-convert', '-w', '1600', str(output), '-o', str(output.with_suffix('.png'))], check=True)
