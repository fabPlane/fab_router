#!/usr/bin/python3
"""Offline local-axis corridor audit. Does not infer native spoke counts."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import pcbnew

HERE = Path(__file__).resolve().parent

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def polygon(points):
    p = pcbnew.SHAPE_POLY_SET()
    p.NewOutline()
    for x, y in points:
        p.Append(round(x), round(y))
    return p

def strip(pad, direction, width, length):
    # KiCad board coordinates have downward y; positive pad rotation is clockwise
    # in the mathematical coordinate convention, hence the negative angle here.
    angle = math.radians(-pad.GetOrientationDegrees())
    c, s = math.cos(angle), math.sin(angle)
    x, y = pad.GetPosition().x, pad.GetPosition().y
    a, b = pad.GetSize().x / 2, pad.GetSize().y / 2
    if direction == '+x':
        pts = [(a,-width/2),(a+length,-width/2),(a+length,width/2),(a,width/2)]
    elif direction == '-x':
        pts = [(-a-length,-width/2),(-a,-width/2),(-a,width/2),(-a-length,width/2)]
    elif direction == '+y':
        pts = [(-width/2,b),(width/2,b),(width/2,b+length),(-width/2,b+length)]
    else:
        assert direction == '-y'
        pts = [(-width/2,-b-length),(width/2,-b-length),(width/2,-b),(-width/2,-b)]
    return polygon([(x+u*c-v*s,y+u*s+v*c) for u,v in pts])

def measure(requested, copper):
    missing = pcbnew.SHAPE_POLY_SET(requested)
    missing.BooleanSubtract(copper)
    return dict(requested_nm2=requested.Area(), missing_nm2=missing.Area(),
                covered=missing.Area() == 0)

def run(out):
    assert pcbnew.Version() == '10.0.6'
    out.mkdir(parents=True, exist_ok=False)
    prior = json.loads((HERE/'results/summary.json').read_text())
    rows=[]
    for old in prior['rows']:
        path=HERE/'results'/old['name']/'board.kicad_pcb'
        report=path.with_name('drc.json')
        # Bind existing results to the previously recorded native evidence.
        assert sha(path) == old['sha256']['board.kicad_pcb']
        assert sha(report) == old['sha256']['drc.json']
        board=pcbnew.LoadBoard(str(path))
        pad,=list(board.GetPads()); zone,=list(board.Zones())
        assert pad.GetShape() == pcbnew.PAD_SHAPE_ROUNDRECT
        assert pad.GetOrientationDegrees() == 315
        assert pad.GetThermalSpokeAngle().AsDegrees() == 90
        assert zone.GetLayer() == pcbnew.B_Cu
        # The long-axis point must be inside this narrow rotated pad. The
        # opposite rotation convention is an explicit rejected mutation.
        px,py=pad.GetPosition().x,pad.GetPosition().y
        def axis_point(degrees):
            a=math.radians(degrees)
            return pcbnew.VECTOR2I(round(px+500000*math.cos(a)),round(py+500000*math.sin(a)))
        assert pad.HitTest(axis_point(-315))
        assert not pad.HitTest(axis_point(315))
        copper=zone.GetFilledPolysList(pcbnew.B_Cu)
        metrics={}
        for width in (100000,508000):
            metrics[str(width)]={}
            for direction in ('+x','-x','+y','-y'):
                requested=strip(pad,direction,width,508000)
                assert requested.Area() > 0
                assert measure(requested,requested)['covered']
                assert not measure(requested,pcbnew.SHAPE_POLY_SET())['covered']
                # A half-length rotated strip cannot cover the requested one.
                half=strip(pad,direction,width,254000)
                partial=measure(requested,half)
                assert 0 < partial['missing_nm2'] < partial['requested_nm2']
                metrics[str(width)][direction]=measure(requested,copper)
        expected={
            'all': ['-x'],
            'without-track-1': ['-x','-y'],
            'without-track-2': ['+x','-x'],
            'without-track-3': ['-x','+y'],
            'without-all-tracks': ['+x','-x','+y','-y'],
        }[old['name'].rsplit('-',1)[0]]
        assert [d for d,m in metrics['100000'].items() if m['covered']] == expected
        assert not any(m['covered'] for m in metrics['508000'].values())
        row=dict(name=old['name'],board_sha256=sha(path),report_sha256=sha(report),
                 native_errors=len(old['errors']),native_opens=old['opens'],metrics=metrics)
        rows.append(row)
        print(row['name'],row['native_errors'],{w:[d for d,m in ds.items() if m['covered']] for w,ds in metrics.items()})
    for first in rows[:5]:
        group = [r for r in rows if r["name"].rsplit("-",1)[0] == first["name"].rsplit("-",1)[0]]
        assert len(group) == 3
        assert all(r["metrics"] == first["metrics"] for r in group)
    result=dict(production_fix=False,routing_benchmark=False,native_version=pcbnew.Version(),
                source_sha256=sha(Path(__file__)),prior_summary_sha256=sha(HERE/'results/summary.json'),
                strip_length_nm=508000,rows=rows)
    (out/'results.json').write_text(json.dumps(result,indent=2)+'\n')
    # Chart records measured area fractions, not a native spoke-count estimate.
    svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1300" height="560"><rect width="1300" height="560" fill="#f4f6f8"/>',
         '<text x="25" y="35" font-family="sans-serif" font-size="24">Rotated B.Cu pad: local-axis filled corridor area</text>',
         '<text x="25" y="68" font-family="sans-serif" font-size="18">0.100 mm wide × 0.508 mm long; existing native outputs; three identical repeats</text>']
    for i,row in enumerate(rows[:5]):
        y=110+i*75
        svg.append(f'<text x="25" y="{y+20}" font-family="sans-serif" font-size="17">{row["name"][:-2]} ({row["native_errors"]} errors)</text>')
        for j,(d,m) in enumerate(row['metrics']['100000'].items()):
            x=400+j*215;fraction=1-m['missing_nm2']/m['requested_nm2']
            svg += [f'<rect x="{x}" y="{y}" width="175" height="22" fill="#d9e0e8"/>',f'<rect x="{x}" y="{y}" width="{175*fraction}" height="22" fill="#247c91"/>',f'<text x="{x}" y="{y+45}" font-family="sans-serif" font-size="16">{d}: {100*fraction:.1f}% area</text>']
    svg.append('<text x="25" y="530" font-family="sans-serif" font-size="18">Area coverage does not establish a native spoke count, effective width, or plane connectivity.</text></svg>')
    (out/'comparison.svg').write_text('\n'.join(svg)+'\n')

if __name__ == '__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--out',type=Path,required=True)
    run(p.parse_args().out.resolve())
