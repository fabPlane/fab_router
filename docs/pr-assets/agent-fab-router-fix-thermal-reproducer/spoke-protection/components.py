#!/usr/bin/python3
"""Fixture-only filled-polygon component evidence; no native spoke counting.

Remote means positive copper area outside the pad bounding box expanded by 1 mm.
It does not establish a required plane size, effective rules, or native acceptance.
"""
import argparse
import hashlib
import json
from pathlib import Path
import pcbnew
from corridor import rectangle, coverage

HERE = Path(__file__).resolve().parent

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def inspect_components(copper, strip, local_box):
    rows = []
    for i in range(copper.OutlineCount()):
        component = copper.UnitSet(i)
        outside = component.CloneDropTriangulation()
        outside.BooleanSubtract(rectangle(*local_box))
        rows.append(dict(index=i, holes=component.HoleCount(0), area_nm2=component.Area(),
                         outside_local_box_area_nm2=outside.Area(),
                         **coverage(component, *strip)))
    return dict(union_strip_covered=coverage(copper, *strip)['positive_area_covered'],
                remote_covering_components=[r['index'] for r in rows
                    if r['positive_area_covered'] and r['outside_local_box_area_nm2'] > 0],
                components=rows)

def run(out):
    assert pcbnew.Version() == '10.0.6'
    out.mkdir(parents=True, exist_ok=False)
    prior_path = HERE/'area-results/native/results.json'
    prior = json.loads(prior_path.read_text())
    rows = []
    for old in prior['rows']:
        variant, repeat = old['variant'], old['repeat']
        path = (HERE/'filled-results/before.kicad_pcb' if variant == 'input' else
                HERE/'direction-results'/f'{repeat}-{variant}'/'after.kicad_pcb')
        assert digest(path) == old['board_sha256']
        board = pcbnew.LoadBoard(str(path))
        pad, = [p for p in board.GetPads() if p.GetNetname() == 'GND']
        zone, = list(board.Zones())
        assert pad.GetShape() == pcbnew.PAD_SHAPE_RECT
        assert pad.GetOrientationDegrees() % 90 == 0
        assert zone.GetThermalReliefGap() == 508000
        b = pad.GetBoundingBox()
        x,y = pad.GetPosition().x, pad.GetPosition().y
        box = (b.GetLeft()-1000000,b.GetTop()-1000000,b.GetRight()+1000000,b.GetBottom()+1000000)
        strips = dict(downward=(x-254000,b.GetBottom(),x+254000,b.GetBottom()+508000),
                      leftward=(b.GetLeft()-508000,y-254000,b.GetLeft(),y+254000))
        copper = zone.GetFilledPolysList(board.GetLayerID('F.Cu'))
        directions = {d:inspect_components(copper,s,box) for d,s in strips.items()}
        expected = ['downward', 'leftward'] if variant != 'leftward' else ['leftward']
        assert [d for d,v in directions.items() if v['remote_covering_components']] == expected
        rows.append(dict(variant=variant,repeat=repeat,board_sha256=digest(path),
                         local_box_nm=box, strips_nm=strips,directions=directions))
    result = dict(production_fix=False,routing_benchmark=False,native_spoke_counter=False,
                  source_sha256=digest(Path(__file__)),helper_sha256=digest(HERE/'corridor.py'),
                  prior_sha256=digest(prior_path),rows=rows)
    (out/'results.json').write_text(json.dumps(result,indent=2)+'\n')
    # Render the actual stored outlines and holes, with the measured short strips.
    svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1350" height="650"><rect width="1350" height="650" fill="#f4f6f8"/>']
    svg.append('<text x="25" y="35" font-family="sans-serif" font-size="24">Stored filled-copper components and 0.508 mm strips</text>')
    for n, variant in enumerate(('input','leftward','downward')):
        r = next(r for r in rows if r['variant'] == variant)
        path = HERE/'filled-results/before.kicad_pcb' if variant == 'input' else HERE/'direction-results'/f"1-{variant}"/'after.kicad_pcb'
        board = pcbnew.LoadBoard(str(path))
        zone, = list(board.Zones())
        copper = zone.GetFilledPolysList(board.GetLayerID('F.Cu'))
        points = [copper.COutline(i).CPoint(j) for i in range(copper.OutlineCount()) for j in range(copper.COutline(i).PointCount())]
        xmin,ymin = min(p.x for p in points),min(p.y for p in points)
        span = max(max(p.x for p in points)-xmin, max(p.y for p in points)-ymin)
        scale = 390/span
        svg.append(f'<text x="{25+n*445}" y="75" font-family="sans-serif" font-size="22">{variant}</text><g transform="translate({25+n*445} 100) scale({scale}) translate({-xmin} {-ymin})">')
        for i in range(copper.OutlineCount()):
            chains = [copper.COutline(i)]+[copper.CHole(i,h) for h in range(copper.HoleCount(i))]
            d = ' '.join('M '+' L '.join(f'{c.CPoint(j).x},{c.CPoint(j).y}' for j in range(c.PointCount()))+' Z' for c in chains)
            svg.append(f'<path d="{d}" fill="#8fc9b0" fill-rule="evenodd" stroke="#245342" stroke-width="6000"/>')
        for d,(l,t,rr,b) in r['strips_nm'].items():
            color = '#1155dd' if r['directions'][d]['remote_covering_components'] else '#dd3311'
            svg.append(f'<rect x="{l}" y="{t}" width="{rr-l}" height="{b-t}" fill="none" stroke="{color}" stroke-width="25000"/>')
        svg.append('</g>')
    for i,line in enumerate(('Blue: entire strip in a component extending outside pad box + 1 mm.', 'Red: strip missing. Outlines and holes are actual retained zone geometry.', 'Component extent is diagnostic; it does not establish native spoke acceptance.')):
        svg.append(f'<text x="25" y="{550+i*35}" font-family="sans-serif" font-size="20">{line}</text>')
    (out/'comparison.svg').write_text('\n'.join(svg+['</svg>'])+'\n')
    for r in rows:
        print(r['variant'],r['repeat'],{d:v['remote_covering_components'] for d,v in r['directions'].items()})

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', required=True, type=Path)
    run(parser.parse_args().out.resolve())
