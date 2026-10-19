#!/usr/bin/python3
"""Inventory native thermal targets from an existing completed benchmark; no rerouting.

Stored native getters are observations, not effective custom-rule resolution.
Input results and original boards are read only. No native Save or refill is called.
"""
import argparse
from collections import Counter, defaultdict
import hashlib
from html import escape
import json
from pathlib import Path
import subprocess


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(results, cases, out):
    import pcbnew
    assert pcbnew.Version() == '10.0.6'
    source_hash = digest(results)
    rows = [r for r in json.loads(results.read_text()) if r['router'] == 'fab-router']
    assert len(rows) == 78
    grouped = defaultdict(list)
    for row in rows:
        assert row['status'] == 'checked' and not row['failed_fidelity']
        assert row['new_errors'] == len(row['check']['new_error_details'])
        grouped[row['case']].append(row)
    assert len(grouped) == 26
    targets, totals = [], Counter()
    for case, runs in sorted(grouped.items()):
        assert sorted(r['seed'] for r in runs) == [1, 2, 3]
        # Identity and multiplicity, not just counts, must match across repeats.
        def signature(row):
            return Counter(json.dumps(v, sort_keys=True) for v in row['check']['new_error_details'])
        assert all(signature(r) == signature(runs[0]) for r in runs)
        for r in runs:
            totals.update(r['new_error_types'])
        if not runs[0]['new_errors']:
            continue
        board_path = cases / case / 'board.kicad_pcb'
        inputs = {p.name: digest(p) for p in (board_path, board_path.with_suffix('.kicad_pro'),
                                             board_path.with_suffix('.kicad_dru'))}
        board = pcbnew.LoadBoard(str(board_path))
        pads = {p.m_Uuid.AsString(): p for p in board.GetPads()}
        zones = {z.m_Uuid.AsString(): z for z in board.Zones()}
        for finding in runs[0]['check']['new_error_details']:
            assert finding['type'] == 'starved_thermal'
            pad_item, = [i for i in finding['items'] if i['uuid'] in pads]
            zone_item, = [i for i in finding['items'] if i['uuid'] in zones]
            pad, zone = pads[pad_item['uuid']], zones[zone_item['uuid']]
            pos = pad.GetPosition()
            assert pad.GetNetname() == zone.GetNetname()
            target = dict(case=case, seeds=sorted(r['seed'] for r in runs),
                          native_finding=finding, input_sha256=inputs,
                          pad_uuid=pad_item['uuid'], zone_uuid=zone_item['uuid'],
                          reference=pad.GetParentFootprint().GetReference(), number=pad.GetNumber(),
                          input_pad_position_nm=[pos.x, pos.y],
                          report_minus_input_position_nm=[round(pad_item['pos']['x'] * 1e6) - pos.x,
                                                          round(pad_item['pos']['y'] * 1e6) - pos.y],
                          net=pad.GetNetname(), pad_orientation_degrees=pad.GetOrientationDegrees(),
                          pad_spoke_angle_degrees=pad.GetThermalSpokeAngle().AsDegrees(),
                          pad_shape_code=pad.GetShape(),
                          pad_shape_name={pcbnew.PAD_SHAPE_RECT: 'rectangle',
                                          pcbnew.PAD_SHAPE_ROUNDRECT: 'rounded rectangle'}.get(pad.GetShape(), 'other'),
                          pad_corner_radius_nm=pad.GetRoundRectCornerRadius(),
                          pad_size_nm=[pad.GetSize().x, pad.GetSize().y],
                          pad_layers=[board.GetLayerName(i) for i in pad.GetLayerSet().Seq()],
                          zone_layers=[board.GetLayerName(i) for i in zone.GetLayerSet().Seq()],
                          zone_gap_nm=zone.GetThermalReliefGap(),
                          zone_bridge_nm=zone.GetThermalReliefSpokeWidth(),
                          pad_local_gap_nm=pad.GetLocalThermalGapOverride(),
                          pad_local_bridge_nm=pad.GetLocalThermalSpokeWidthOverride(),
                          board_minimum_spokes=board.GetDesignSettings().m_MinResolvedSpokes)
            targets.append(target)
        assert inputs == {name: digest(board_path.parent / name) for name in inputs}
    assert totals == {'starved_thermal': 27}
    assert len(targets) == 9
    assert digest(results) == source_hash
    out.mkdir(parents=True, exist_ok=False)
    summary = dict(routing_benchmark=False, production_fix=False, repeats_in_existing_run=3,
                   native_version=pcbnew.Version(), results_sha256=source_hash,
                   script_sha256=digest(Path(__file__)),
                   runs=len(rows), passed=sum(r['passed'] for r in rows),
                   opens=sum(r['opens'] for r in rows), new_error_types=dict(totals),
                   unique_case_pad_zone_targets=len(targets), targets=targets)
    (out / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
    lines = ['Fresh baseline: native thermal targets',
             'Existing 26 cases x 3 repeats; 39/78 pass, 120 opens, 27 new errors',
             'Nine case/pad/zone targets; exact findings match across all three seeds']
    for t in targets:
        lines.append(f"{t['case']}: {t['reference']}.{t['number']} | zone {','.join(t['zone_layers'])} | "
                     f"{t['pad_shape_name']}, {t['pad_orientation_degrees']:g} deg | gap/bridge "
                     f"{t['zone_gap_nm']/1000:g}/{t['zone_bridge_nm']/1000:g} um")
    lines.append('Stored getters only. No effective rule resolution, spoke selection, routing or safety fix.')
    svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1450" height="650">',
           '<rect width="1450" height="650" fill="#f4f6f8"/>']
    for i, line in enumerate(lines):
        svg.append(f'<text x="24" y="{38+i*44}" font-family="sans-serif" font-size="22" fill="#152033">{escape(line)}</text>')
    (out / 'comparison.svg').write_text('\n'.join(svg + ['</svg>']) + '\n')
    subprocess.run(['rsvg-convert', out / 'comparison.svg', '-o', out / 'comparison.png'], check=True, timeout=60)
    print(json.dumps({k: v for k, v in summary.items() if k != 'targets'}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--results', required=True, type=Path)
    parser.add_argument('--cases', required=True, type=Path)
    parser.add_argument('--out', required=True, type=Path)
    args = parser.parse_args()
    run(args.results, args.cases, args.out)
