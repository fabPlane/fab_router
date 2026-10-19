#!/usr/bin/python3
"""Diagnostic geometry-derived proposals with native transaction validation.

Stored zone gap sets a bounded search scale, not an effective clearance rule.
No fixed pad/track UUID or displacement; no production adapter integration.
"""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import uuid
import native
import transaction

geometry = transaction.module('geometry', 'geometry-doglegs.py')


def proposals(nodes, info, gap):
    for scale in (-.2, .2, -.4, .4, -.6, .6, -.8, .8, -1., 1.):
        delta = [round(scale * gap * v) for v in info['normal']]
        result = copy.deepcopy(nodes)
        track = next(n for n in result if isinstance(n, list) and native.uid(n) == info['uuid'])
        original = copy.deepcopy(track)
        for key in ('start', 'end'):
            before, after = native.child(original, key), native.child(track, key)
            after[1:] = [f'{float(before[i+1])+delta[i]/1e6:.6f}' for i in (0, 1)]
            link = copy.deepcopy(original)
            native.child(link, 'start')[1:] = before[1:]
            native.child(link, 'end')[1:] = after[1:]
            native.child(link, 'uuid')[1] = '"'+str(uuid.uuid5(uuid.NAMESPACE_URL,
                f'generated-transaction-{info["uuid"]}-{scale}-{key}'))+'"'
            result.append(link)
        yield scale, delta, (native.dump(result)+'\n').encode()


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source', type=Path, required=True)
    p.add_argument('--out', type=Path, required=True)
    p.add_argument('--all-targets', action='store_true',
                   help='Measure each failing pad independently; allow no safe candidate')
    a = p.parse_args()
    a.out.mkdir(parents=True, exist_ok=False)
    assert native.pcbnew.Version() == '10.0.6'
    native.SRC, native.D, native.TARGET = a.source, a.out, ''
    sha = lambda data: hashlib.sha256(data).hexdigest()
    inputs = {str(a.source.with_suffix(ext)): sha(a.source.with_suffix(ext).read_bytes())
              for ext in ('.kicad_pcb', '.kicad_pro', '.kicad_dru')}
    original = a.source.read_bytes()
    nodes = native.parse(original.decode())
    def check(data, name):
        row = native.check(native.parse(data.decode()), name)
        row['groups'] = transaction.terminals.partition(
            native.pcbnew.LoadBoard(str(a.out/name/'board.kicad_pcb')))
        return row
    rows = []
    for repeat in range(1, 4):
        baseline = check(original, f'baseline-{repeat}')
        board = native.pcbnew.LoadBoard(str(a.out/f'baseline-{repeat}'/'board.kicad_pcb'))
        pad_ids = {pad.m_Uuid.AsString(): pad for pad in board.GetPads()}
        targets = sorted({item['uuid'] for error in baseline['errors']
                          if error['type'] == 'starved_thermal' for item in error['items']
                          if item['uuid'] in pad_ids})
        assert targets
        assert a.all_targets or len(targets) == 1, 'Use --all-targets for multiple failing pads'
        for target_index, target in enumerate(targets):
            pad = pad_ids[target]
            zones = [z for z in board.Zones() if z.GetNetCode() == pad.GetNetCode()
                     and any(z.IsOnLayer(layer) for layer in pad.GetLayerSet().Seq())]
            gap = min(z.GetThermalReliefGap() for z in zones)
            assert gap > 0
            nearby = geometry.nearby(board, pad, 1)
            assert nearby
            attempts = []
            selected = original
            for index, (scale, delta, candidate) in enumerate(proposals(nodes, nearby[0], gap)):
                name = f'candidate-{repeat}-{target_index}-{index}' if a.all_targets else f'candidate-{repeat}-{index}'
                output, accepted, row, exception = transaction.transact(original, candidate, baseline,
                    lambda data: check(data, name))
                assert output == (candidate if accepted else original)
                attempts.append(dict(name=name, scale=scale, delta_nm=delta, accepted=accepted,
                    exception=exception, candidate_sha256=sha(candidate), row=row))
                if accepted:
                    selected = output
                    break
            selected_name = (f'selected-{repeat}-{target_index}.kicad_pcb' if a.all_targets
                             else f'selected-{repeat}.kicad_pcb')
            (a.out/selected_name).write_bytes(selected)
            rows.append(dict(repeat=repeat, target_index=target_index, pad_uuid=target, nearby=nearby,
                stored_gap_nm=gap, baseline=baseline, attempts=attempts,
                accepted=selected != original, selected_sha256=sha(selected)))
    assert inputs == {name: sha(Path(name).read_bytes()) for name in inputs}
    if not a.all_targets:
        assert all(r['accepted'] for r in rows), 'No safe candidate found'
    for target in {r['pad_uuid'] for r in rows}:
        group = [r for r in rows if r['pad_uuid'] == target]
        assert len(group) == 3 and len({r['selected_sha256'] for r in group}) == 1
    (a.out/'summary.json').write_text(json.dumps(dict(production_fix=False,
        routing_benchmark=False, all_targets=a.all_targets, input_sha256=inputs, rows=rows), indent=2)+'\n')
    (a.out/'manifest.json').write_text(json.dumps({
        str(path.relative_to(a.out)): sha(path.read_bytes())
        for path in sorted(a.out.rglob('*')) if path.is_file()
        and path.suffix != '.kicad_prl'}, indent=2)+'\n')
    print(f'PASS: {sum(r["accepted"] for r in rows)}/{len(rows)} independent target transactions accepted')


if __name__ == '__main__':
    main()
