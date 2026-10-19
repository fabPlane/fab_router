#!/usr/bin/python3
"""Fixture-only native polygon erosion sensitivity, not a thermal acceptance gate.

Rounded native offsets use an explicit approximation error. Surviving paths do
not establish effective spoke rules or guarantee native DRC acceptance.
"""
import argparse
import json
from pathlib import Path
import pcbnew
from corridor import rectangle
from components import digest, HERE


def remote_after_erosion(copper, anchor, local_box, radius, max_error):
    if radius < 0 or max_error <= 0 or (radius > 0 and max_error > radius):
        raise ValueError('require nonnegative radius and positive error no larger than radius')
    inset = copper.CloneDropTriangulation()
    if radius:
        inset.Inflate(-radius, pcbnew.CORNER_STRATEGY_ROUND_ALL_CORNERS, max_error)
    point = pcbnew.VECTOR2I(*anchor)
    indices = []
    for i in range(inset.OutlineCount()):
        part = inset.UnitSet(i)
        if not part.Contains(point):
            continue
        part.BooleanSubtract(rectangle(*local_box))
        if part.Area() > 0:
            indices.append(i)
    return dict(radius_nm=radius, offset_max_error_nm=max_error,
                eroded_area_nm2=inset.Area(), eroded_components=inset.OutlineCount(),
                anchor_present=inset.Contains(point), remote_reachable=bool(indices))


def run(out):
    assert pcbnew.Version() == '10.0.6'
    out.mkdir(parents=True, exist_ok=False)
    prior_path = HERE/'component-results/native/results.json'
    prior = json.loads(prior_path.read_text())
    rows = []
    for old in prior['rows']:
        variant,repeat = old['variant'],old['repeat']
        path = HERE/'filled-results/before.kicad_pcb' if variant == 'input' else HERE/'direction-results'/f'{repeat}-{variant}'/'after.kicad_pcb'
        assert digest(path) == old['board_sha256']
        board = pcbnew.LoadBoard(str(path))
        zone, = list(board.Zones())
        copper = zone.GetFilledPolysList(board.GetLayerID('F.Cu'))
        directions = {}
        for direction,strip in old['strips_nm'].items():
            l,t,r,b = strip
            anchor = ((l+r)//2,(t+b)//2)
            directions[direction] = dict(anchor_nm=anchor, observations=[
                remote_after_erosion(copper,anchor,old['local_box_nm'],radius,1000)
                for radius in (0, 100000, 200000, 250000, 260000)])
        # Fixed observations for these retained boards, not a general width rule.
        expected_down = ([True,True,True,True,False] if variant == 'input' else
                         [True,True,True,False,False] if variant == 'downward' else [False]*5)
        assert [o['remote_reachable'] for o in directions['downward']['observations']] == expected_down
        assert [o['remote_reachable'] for o in directions['leftward']['observations']] == [True,True,True,True,False]
        if variant == 'downward':
            assert directions['downward']['observations'][3]['anchor_present']
        assert digest(path) == old['board_sha256']
        rows.append(dict(variant=variant,repeat=repeat,board_sha256=digest(path),directions=directions))
    result = dict(production_fix=False,native_spoke_counter=False,routing_benchmark=False,
                  source_sha256=digest(Path(__file__)),prior_sha256=digest(prior_path),
                  dependency_sha256={p:digest(HERE/p) for p in ('corridor.py','components.py','test_necks.py','run_neck_controls.py')},rows=rows)
    (out/'results.json').write_text(json.dumps(result,indent=2)+'\n')
    # Render actual native polygons before/after the 0.25 mm offset, same scale.
    svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1350" height="650"><rect width="1350" height="650" fill="#f4f6f8"/>',
           '<text x="25" y="35" font-family="sans-serif" font-size="23">Native filled copper after 0.25 mm erosion (1 um offset error)</text>']
    for n,variant in enumerate(('input','downward','leftward')):
        row = next(r for r in rows if r['variant'] == variant)
        path = HERE/'filled-results/before.kicad_pcb' if variant == 'input' else HERE/'direction-results'/f'1-{variant}'/'after.kicad_pcb'
        board = pcbnew.LoadBoard(str(path))
        zone, = list(board.Zones())
        copper = zone.GetFilledPolysList(board.GetLayerID('F.Cu'))
        points = [copper.COutline(i).CPoint(j) for i in range(copper.OutlineCount()) for j in range(copper.COutline(i).PointCount())]
        xmin,ymin = min(p.x for p in points),min(p.y for p in points)
        span = max(max(p.x for p in points)-xmin,max(p.y for p in points)-ymin)
        svg.append(f'<text x="{25+n*445}" y="75" font-family="sans-serif" font-size="22">{variant}</text><g transform="translate({25+n*445} 100) scale({390/span}) translate({-xmin} {-ymin})">')
        inset = copper.CloneDropTriangulation()
        inset.Inflate(-250000,pcbnew.CORNER_STRATEGY_ROUND_ALL_CORNERS,1000)
        for polys,color in ((copper,'#d5dedb'),(inset,'#408e71')):
            for i in range(polys.OutlineCount()):
                chains = [polys.COutline(i)]+[polys.CHole(i,h) for h in range(polys.HoleCount(i))]
                d = ' '.join('M '+' L '.join(f'{c.CPoint(j).x},{c.CPoint(j).y}' for j in range(c.PointCount()))+' Z' for c in chains)
                svg.append(f'<path d="{d}" fill="{color}" fill-rule="evenodd"/>')
        for direction,value in row['directions'].items():
            x,y = value['anchor_nm']
            color = '#1155dd' if value['observations'][3]['remote_reachable'] else '#dd3311'
            svg.append(f'<circle cx="{x}" cy="{y}" r="55000" fill="{color}"/>')
        svg.append('</g>')
    for i,line in enumerate(('Gray: original copper. Green: eroded copper. Dots: strip-center anchors.',
                             'Blue: anchor reaches remote copper. Red: absent or disconnected after erosion.',
                             'Downward guard retains its down anchor but loses remote access; native DRC previously accepted it.')):
        svg.append(f'<text x="25" y="{550+i*35}" font-family="sans-serif" font-size="18">{line}</text>')
    (out/'comparison.svg').write_text('\n'.join(svg+['</svg>'])+'\n')
    for row in rows:
        print(row['variant'],row['repeat'],{d:[o['remote_reachable'] for o in v['observations']] for d,v in row['directions'].items()})

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out',type=Path,required=True)
    run(parser.parse_args().out.resolve())
