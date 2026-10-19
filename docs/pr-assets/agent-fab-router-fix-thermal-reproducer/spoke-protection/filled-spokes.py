#!/usr/bin/python3
"""Sample cardinal filled-copper corridors; fixture diagnostic, not a geometry proof."""
import argparse
import hashlib
import json
import pathlib
import pcbnew

HERE = pathlib.Path(__file__).resolve().parent

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def sample(path):
    board = pcbnew.LoadBoard(str(path))
    assert board
    pad, = [p for p in board.GetPads() if p.GetNetname() == 'GND']
    zone, = list(board.Zones())
    assert zone.GetNetname() == 'GND'
    poly = zone.GetFilledPolysList(board.GetLayerID('F.Cu'))
    box = pad.GetBoundingBox()
    x, y = pad.GetPosition().x, pad.GetPosition().y
    origins = dict(downward=(x, box.GetBottom(), 0, 1), upward=(x, box.GetTop(), 0, -1),
                   leftward=(box.GetLeft(), y, -1, 0), rightward=(box.GetRight(), y, 1, 0))
    result = {}
    # Three longitudinal lines spanning the central half of the 0.508 mm bridge.
    # 25 um samples out to 1 mm; finite sampling cannot prove full-width continuity.
    for direction, (ox, oy, dx, dy) in origins.items():
        lines = []
        for offset in (-127000, 0, 127000):
            lines.append(''.join('1' if poly.Contains(pcbnew.VECTOR2I(
                ox + dx * distance - dy * offset, oy + dy * distance + dx * offset)) else '0'
                for distance in range(0, 1000001, 25000)))
        result[direction] = dict(samples=lines, all_samples_filled=all('0' not in line for line in lines))
    return dict(board_sha256=digest(path), outline_count=poly.OutlineCount(), directions=result)

def main(before, out):
    out.mkdir(parents=True, exist_ok=False)
    rows = [dict(variant='input', repeat=0, **sample(before))]
    for repeat in range(1, 4):
        for direction in ('leftward', 'downward'):
            directory = HERE / 'direction-results' / f'{repeat}-{direction}'
            report = json.loads((directory / 'after.json').read_text())
            thermal = [v for v in report['violations'] if v['type'] == 'starved_thermal']
            if thermal:
                assert len(thermal) == 1
                assert 'zone min spoke count 2; actual 1' in thermal[0]['description']
            rows.append(dict(variant=direction, repeat=repeat, native_thermal_errors=len(thermal),
                             native_report_sha256=digest(directory / 'after.json'),
                             **sample(directory / 'after.kicad_pcb')))
    for row in rows:
        observed = [d for d, value in row['directions'].items() if value['all_samples_filled']]
        expected = ['leftward'] if row['variant'] == 'leftward' else ['downward', 'leftward']
        assert observed == expected, (row['variant'], observed)
    result = dict(step_nm=25000, extent_nm=1000000, offsets_nm=[-127000, 0, 127000],
                  production_fix=False, benchmark_score=False, rows=rows)
    (out / 'samples.json').write_text(json.dumps(result, indent=2)+'\n')
    elements = ['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400" viewBox="0 0 1200 400">',
                '<rect width="1200" height="400" fill="#f4f6f8"/>']
    def text(x, y, value, size=23):
        elements.append(f'<text x="{x}" y="{y}" fill="#152033" font-family="sans-serif" font-size="{size}">{value}</text>')
    text(30, 40, 'Preserving one existing spoke is insufficient when the native minimum is two', 26)
    text(30, 75, 'Filled-copper samples: 3 parallel lines per direction, 25 um step, 1 mm beyond pad edge', 20)
    text(400, 125, 'Down'); text(560, 125, 'Left'); text(710, 125, 'Up'); text(850, 125, 'Right');text(990,125,'Thermal errors',19)
    for i, row in enumerate((rows[0], rows[1], rows[2])):
        y = 175+i*65
        text(30, y, {'input':'Original input','leftward':'Leftward guard (3/3)','downward':'Downward guard (3/3)'}[row['variant']])
        for j, d in enumerate(('downward','leftward','upward','rightward')):
            filled = row['directions'][d]['all_samples_filled']
            text(400+j*150, y, 'filled' if filled else 'gap')
        text(1040,y,str(row.get('native_thermal_errors',0)))
    text(30, 375, 'Finite samples are diagnostic evidence only; arbitrary shapes and full bridge connectivity remain unverified.', 19)
    elements.append('</svg>')
    (out / 'comparison.svg').write_text('\n'.join(elements)+'\n')
    print(json.dumps([dict(variant=r['variant'], repeat=r['repeat'], filled=[d for d,v in r['directions'].items() if v['all_samples_filled']]) for r in rows], indent=2))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--before', type=pathlib.Path, required=True)
    parser.add_argument('--out', type=pathlib.Path, required=True)
    args = parser.parse_args()
    main(args.before.resolve(), args.out.resolve())
