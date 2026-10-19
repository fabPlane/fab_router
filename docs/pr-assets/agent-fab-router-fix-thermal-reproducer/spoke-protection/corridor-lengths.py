#!/usr/bin/python3
"""Localize missing downward-strip area on retained filled native boards.

Rectangular pad fixture only. Does not route, refill, count spokes, or establish
plane connectivity. A shorter covered strip is not a native acceptance rule.
"""
import argparse
import hashlib
import html
import json
from pathlib import Path
import pcbnew
from corridor import rectangle, coverage

HERE = Path(__file__).resolve().parent

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def inspect(path):
    board = pcbnew.LoadBoard(str(path))
    pad, = [p for p in board.GetPads() if p.GetNetname() == 'GND']
    zone, = list(board.Zones())
    assert pad.GetOrientationDegrees() % 90 == 0
    assert pad.GetShape() == pcbnew.PAD_SHAPE_RECT
    assert zone.GetThermalReliefSpokeWidth() == 508000
    assert zone.GetThermalReliefGap() == 508000
    x, edge = pad.GetPosition().x, pad.GetBoundingBox().GetBottom()
    copper = zone.GetFilledPolysList(board.GetLayerID('F.Cu'))
    lengths = (508000, 750000, 950000, 1000000)
    strips = {str(length): coverage(copper, x-254000, edge, x+254000, edge+length)
              for length in lengths}
    missing = rectangle(x-254000, edge, x+254000, edge+1000000)
    missing.BooleanSubtract(copper)
    # Preserve exact native polygon vertices, including holes, in local nm.
    polygons = []
    for i in range(missing.OutlineCount()):
        assert missing.HoleCount(i) == 0, 'fixture changed: inspect hole geometry'
        chain = missing.COutline(i)
        polygons.append([[chain.CPoint(j).x-x, chain.CPoint(j).y-edge]
                         for j in range(chain.PointCount())])
    return dict(board_sha256=digest(path), lengths_nm=strips,
                missing_polygons_local_nm=polygons,
                first_missing_vertex_distance_nm=min((p[1] for poly in polygons for p in poly), default=None))

def run(out):
    assert pcbnew.Version() == '10.0.6'
    out.mkdir(parents=True, exist_ok=False)
    prior_path = HERE/'area-results'/'native'/'results.json'
    prior = json.loads(prior_path.read_text())
    rows = []
    for old in prior['rows']:
        variant, repeat = old['variant'], old['repeat']
        path = (HERE/'filled-results'/'before.kicad_pcb' if variant == 'input'
                else HERE/'direction-results'/f'{repeat}-{variant}'/'after.kicad_pcb')
        row = dict(variant=variant, repeat=repeat, **inspect(path))
        assert row['board_sha256'] == old['board_sha256']
        assert row['lengths_nm']['1000000'] == old['directions']['downward']
        if variant in ('input', 'downward'):
            assert all(row['lengths_nm'][str(n)]['positive_area_covered'] for n in (508000,750000,950000))
        if variant == 'downward':
            assert row['first_missing_vertex_distance_nm'] == 959661
            assert len(row['missing_polygons_local_nm']) == 2
        if variant == 'leftward':
            assert not row['lengths_nm']['508000']['positive_area_covered']
        rows.append(row)
    result = dict(production_fix=False, routing_benchmark=False,
                  source_sha256=digest(Path(__file__)), helper_sha256=digest(HERE/'corridor.py'),
                  prior_results_sha256=digest(prior_path), rows=rows)
    (out/'results.json').write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps(rows, indent=2))
    # Draw actual missing polygons in strip-local coordinates; scale nm to px.
    row = next(r for r in rows if r['variant'] == 'downward')
    svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760"><rect width="1200" height="760" fill="#f4f6f8"/>',
           '<text x="25" y="40" font-family="sans-serif" font-size="25">Downward guard: missing copper starts beyond 0.95 mm</text>',
           '<g transform="translate(205 100) scale(0.0005)">',
           '<rect x="-254000" y="0" width="508000" height="1000000" fill="#9bd0b5" stroke="#173c32" stroke-width="2000"/>']
    for poly in row['missing_polygons_local_nm']:
        svg.append('<polygon points="'+' '.join(f'{x},{y}' for x,y in poly)+'" fill="#ce503f"/>')
    svg.append('</g>')
    for y,label in ((100,'Pad edge: 0 mm'), (354,'Zone gap setting: 0.508 mm'), (575,'0.95 mm: full area covered'), (600,'1 mm: two missing corner triangles')):
        svg.append(f'<text x="370" y="{y}" font-family="sans-serif" font-size="20">{html.escape(label)}</text>')
    for i,line in enumerate(['Three retained outputs: same hashes, same geometry; no routing or refill.', 'Missing area: 0.001514288654 mm²; earliest missing vertex: 0.959661 mm.', 'Shorter strip coverage does not count native spokes or prove plane connectivity.']):
        svg.append(f'<text x="25" y="{660+i*32}" font-family="sans-serif" font-size="19">{html.escape(line)}</text>')
    (out/'comparison.svg').write_text('\n'.join(svg+['</svg>'])+'\n')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', required=True, type=Path)
    run(parser.parse_args().out.resolve())
