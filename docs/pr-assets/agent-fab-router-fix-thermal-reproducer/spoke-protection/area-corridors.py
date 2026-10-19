#!/usr/bin/python3
"""Measure full-width cardinal strips on existing filled miniature boards.

Reads prior native outputs; does not refill, route, or count native spokes.
"""
import argparse
import hashlib
import json
from pathlib import Path
import pcbnew
from corridor import coverage


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
    box = pad.GetBoundingBox()
    x, y = pad.GetPosition().x, pad.GetPosition().y
    half, extent = 254000, 1000000
    rectangles = dict(
        downward=(x-half, box.GetBottom(), x+half, box.GetBottom()+extent),
        upward=(x-half, box.GetTop()-extent, x+half, box.GetTop()),
        leftward=(box.GetLeft()-extent, y-half, box.GetLeft(), y+half),
        rightward=(box.GetRight(), y-half, box.GetRight()+extent, y+half))
    poly = zone.GetFilledPolysList(board.GetLayerID('F.Cu'))
    return dict(board_sha256=digest(path), directions={
        name: coverage(poly, *bounds) for name, bounds in rectangles.items()})

def run(out):
    assert pcbnew.Version() == '10.0.6'
    out.mkdir(parents=True, exist_ok=False)
    prior = json.loads((HERE/'filled-results'/'samples.json').read_text())['rows']
    rows = []
    for old in prior:
        variant, repeat = old['variant'], old['repeat']
        path = (HERE/'filled-results'/'before.kicad_pcb' if variant == 'input'
                else HERE/'direction-results'/f'{repeat}-{variant}'/'after.kicad_pcb')
        row = dict(variant=variant, repeat=repeat, **inspect(path))
        assert row['board_sha256'] == old['board_sha256']
        row['sampled_filled'] = [d for d,v in old['directions'].items() if v['all_samples_filled']]
        row['area_covered'] = [d for d,v in row['directions'].items() if v['positive_area_covered']]
        assert row['area_covered'] == (['downward', 'leftward'] if variant == 'input' else ['leftward'])
        if variant == 'downward':
            assert row['directions']['downward']['missing_area_nm2'] == 1514288654
        rows.append(row)
    result = dict(production_fix=False, routing_benchmark=False,
                  source_sha256=digest(Path(__file__)), helper_sha256=digest(HERE/'corridor.py'),
                  sample_results_sha256=digest(HERE/'filled-results'/'samples.json'), rows=rows)
    (out/'results.json').write_text(json.dumps(result, indent=2)+'\n')
    for row in rows:
        print(row['variant'], row['repeat'], row['sampled_filled'], row['area_covered'],
              {d:v['missing_area_nm2'] for d,v in row['directions'].items()})
    lines = ['Full-width filled-copper corridor audit',
             'Native integer polygon subtraction; existing boards; no routing or refill',
             'Requested strip: 0.508 mm wide, 1 mm beyond each cardinal pad edge']
    for row in rows[:3]:
        lines.append(f"{row['variant']}: samples {','.join(row['sampled_filled'])}; full area {','.join(row['area_covered']) or 'none'}")
    lines += ['Controls detect a 1 um slit and missing outer bridge width that samples miss.',
              'Diagnostic only: strip coverage does not prove native spoke count or plane connectivity.']
    import html
    svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="440"><rect width="1400" height="440" fill="#f4f6f8"/>']
    for i,line in enumerate(lines):
        svg.append(f'<text x="25" y="{40+i*48}" font-family="sans-serif" font-size="{26 if i==0 else 20}" fill="#152033">{html.escape(line)}</text>')
    (out/'comparison.svg').write_text('\n'.join(svg+['</svg>'])+'\n')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, required=True)
    run(parser.parse_args().out.resolve())
