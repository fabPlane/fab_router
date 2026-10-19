#!/usr/bin/python3
"""Fixture-only native translation sweep; does not route or preserve connectivity."""
import argparse
import copy
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import native

HERE = Path(__file__).resolve().parent

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', required=True, type=Path)
    args = parser.parse_args()
    assert native.pcbnew.Version() == '10.0.6'
    args.out.mkdir(parents=True, exist_ok=False)
    native.D = args.out
    spec = importlib.util.spec_from_file_location('corridors', HERE/'local-corridors.py')
    corridors = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(corridors)
    nodes = native.parse(native.SRC.read_text())
    tracks = [n for n in nodes if isinstance(n, list) and n[0] == 'segment']
    assert len(tracks) == 3
    source_board = native.pcbnew.LoadBoard(str(native.SRC))
    pad, = list(source_board.GetPads())
    assert pad.GetOrientationDegrees() == 315
    angle = math.radians(-pad.GetOrientationDegrees())
    c, s = math.cos(angle), math.sin(angle)
    # Directions from the previously measured single-track deletion controls.
    directions = [('-y', (s, -c)), ('+x', (c, s)), ('+y', (-s, c))]
    inputs = {p.name: sha(p) for p in (native.SRC, native.SRC.with_suffix('.kicad_pro'), native.SRC.with_suffix('.kicad_dru'))}
    rows = []
    configurations = [(None, 0)] + [(i, um) for i in range(3) for um in (25, 50, 100, 200, 400)]
    for repeat in range(1, 4):
        for index, um in configurations:
            changed = copy.deepcopy(nodes)
            name = 'all' if index is None else f'track-{index+1}-{um}um'
            displacement = (0, 0)
            if index is not None:
                direction, vector = directions[index]
                displacement = tuple(round(v*um*1000) for v in vector)
                track = next(n for n in changed if isinstance(n, list) and n[0] == 'segment' and native.uid(n) == native.uid(tracks[index]))
                original = copy.deepcopy(track)
                for key in ('start', 'end'):
                    point = native.child(track, key)
                    for axis in (0, 1):
                        point[axis+1] = f'{float(point[axis+1])+displacement[axis]/1e6:.6f}'
                # Only selected track endpoints may differ; all metadata remains.
                restored = copy.deepcopy(changed)
                restored[changed.index(track)] = original
                assert restored == nodes
                for key in ('start', 'end'):
                    before, after = native.child(original, key), native.child(track, key)
                    assert all(abs((float(after[a+1])-float(before[a+1]))*1e6-displacement[a]) < 0.001 for a in (0,1))
            row = native.check(changed, f'{name}-{repeat}')
            assert row['counts'] == dict(footprint=1, segment=3, via=0, zone=1)
            if index is None:
                assert len(row['target']) == len(row['errors']) == 1
                assert row['opens'] == 0
            directory = args.out/row['name']
            board = native.pcbnew.LoadBoard(str(directory/'board.kicad_pcb'))
            current_pad, = list(board.GetPads())
            zone, = list(board.Zones())
            copper = zone.GetFilledPolysList(native.pcbnew.B_Cu)
            coverage = {d: corridors.measure(corridors.strip(current_pad, d, 100000, 508000), copper) for d in ('+x','-x','+y','-y')}
            row.update(track_index=None if index is None else index+1, translation_um=um,
                       displacement_nm=displacement, local_direction=None if index is None else directions[index][0],
                       corridors=coverage,
                       sha256={p.name: sha(p) for p in directory.iterdir() if p.is_file() and p.suffix != '.kicad_prl'})
            rows.append(row)
    for index, um in configurations:
        group = [r for r in rows if r['track_index'] == (None if index is None else index+1) and r['translation_um'] == um]
        assert len(group) == 3
        fields = ('counts','target','errors','opens','corridors','displacement_nm')
        assert all(all(r[f] == group[0][f] for f in fields) for r in group)
    assert inputs == {name: sha(HERE/name) for name in inputs}
    result = dict(production_fix=False, routing_benchmark=False, connectivity_preserved=False,
                  native_version=native.pcbnew.Version(), repeats=3, input_sha256=inputs,
                  script_sha256=sha(Path(__file__)), rows=rows)
    (args.out/'summary.json').write_text(json.dumps(result, indent=2)+'\n')
    # Chart shows native results, not inferred corridor spoke counts.
    svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="410"><rect width="1120" height="410" fill="#f4f6f8"/>',
           '<g font-family="sans-serif" fill="#172333"><text x="25" y="35" font-size="23">Rotated thermal fixture: translate one complete track outward</text>',
           '<text x="25" y="67" font-size="17">Three fresh native checks per cell; all three tracks retained; static diagnostic only</text>']
    for j, um in enumerate((0,25,50,100,200,400)):
        svg.append(f'<text x="{260+j*135}" y="110" font-size="17">{um} µm</text>')
    for i in range(3):
        svg.append(f'<text x="25" y="{157+i*70}" font-size="19">Track {i+1} ({directions[i][0]})</text>')
        for j, um in enumerate((0,25,50,100,200,400)):
            row = next(r for r in rows if r['track_index'] == (None if um == 0 else i+1) and r['translation_um'] == um)
            errors = len(row['errors'])
            color = '#f4bd73' if errors else '#98d6b0'
            svg.append(f'<rect x="{245+j*135}" y="{125+i*70}" width="120" height="50" rx="5" fill="{color}"/><text x="{262+j*135}" y="{157+i*70}" font-size="18">{errors} errors</text>')
    svg.append('<text x="25" y="365" font-size="16">Translations alter routing endpoints; zero errors does not establish routed net completion.</text></g></svg>')
    (args.out/'comparison.svg').write_text('\n'.join(svg)+'\n')

if __name__ == '__main__':
    main()
