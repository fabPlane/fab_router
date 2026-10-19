#!/usr/bin/python3
"""Offline local thermal detour experiment; no production routing changes."""
import argparse
import copy
import hashlib
import json
import math
from pathlib import Path
import uuid
import native
import transaction
geometry = transaction.module('geometry_local', 'geometry-doglegs.py')


def detour(track, centre, radius, shift):
    """Replace only the interior interval nearest centre; retain both endpoints.

    Return no proposal if the full interval does not fit in the straight track.
    Units are integer nanometres. Stored zone gap is a search scale only.
    """
    a, b = [tuple(round(float(v)*1e6) for v in native.child(track, k)[1:3]) for k in ('start', 'end')]
    dx, dy = b[0]-a[0], b[1]-a[1]
    length = math.hypot(dx, dy)
    if not length or radius <= 0 or not shift:
        return None
    along = ((centre[0]-a[0])*dx+(centre[1]-a[1])*dy)/length
    if along-radius <= 0 or along+radius >= length:
        return None
    cuts = [tuple(round(a[i]+(along+s*radius)*(dx,dy)[i]/length) for i in (0,1)) for s in (-1,1)]
    offset = (round(-dy/length*shift), round(dx/length*shift))
    route = [a, cuts[0], tuple(cuts[0][i]+offset[i] for i in (0,1)),
             tuple(cuts[1][i]+offset[i] for i in (0,1)), cuts[1], b]
    if any(p == q for p,q in zip(route,route[1:])):
        return None
    result = []
    for index, (p,q) in enumerate(zip(route,route[1:])):
        part = copy.deepcopy(track)
        for key, point in (('start',p), ('end',q)):
            native.child(part,key)[1:3] = [f'{v/1e6:.6f}' for v in point]
        if index:
            native.child(part,'uuid')[1] = '"'+str(uuid.uuid5(uuid.NAMESPACE_URL,
                f'local-detour-{native.uid(track)}-{centre}-{radius}-{shift}-{index}'))+'"'
        result.append(part)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--pad', required=True)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=False)
    native.SRC, native.D, native.TARGET = args.source, args.out, args.pad
    assert native.pcbnew.Version() == '10.0.6'
    sha = lambda data: hashlib.sha256(data).hexdigest()
    original = args.source.read_bytes()
    nodes = native.parse(original.decode())
    sources = {str(args.source.with_suffix(ext)): sha(args.source.with_suffix(ext).read_bytes())
               for ext in ('.kicad_pcb','.kicad_pro','.kicad_dru')}
    rows = []
    for repeat in range(1,4):
        baseline = transaction.checked_native(original, f'baseline-{repeat}')
        assert any(e['type']=='starved_thermal' and any(i['uuid']==args.pad for i in e['items']) for e in baseline['errors'])
        board = native.pcbnew.LoadBoard(str(args.out/f'baseline-{repeat}'/'board.kicad_pcb'))
        pad = next(p for p in board.GetPads() if p.m_Uuid.AsString()==args.pad)
        centre = tuple(pad.GetPosition())
        zones = [z for z in board.Zones() if z.GetNetCode()==pad.GetNetCode() and any(z.IsOnLayer(l) for l in pad.GetLayerSet().Seq())]
        gap = min(z.GetThermalReliefGap() for z in zones)
        nearby = geometry.nearby(board,pad,2)
        attempts, skipped = [], []
        selected = original
        for rank, info in enumerate(nearby,1):
            track = next(n for n in nodes if isinstance(n,list) and native.uid(n)==info['uuid'])
            for radius_scale in (1.,2.):
                for scale in (-.2,.2,-.4,.4,-.6,.6,-.8,.8,-1.,1.):
                    radius, shift = round(gap*radius_scale), round(gap*scale)
                    parts = detour(track,centre,radius,shift)
                    metadata = dict(rank=rank,track_uuid=info['uuid'],radius_nm=radius,shift_nm=shift)
                    if parts is None:
                        skipped.append(metadata)
                        continue
                    changed = copy.deepcopy(nodes)
                    idx = next(i for i,n in enumerate(changed) if isinstance(n,list) and native.uid(n)==info['uuid'])
                    changed[idx:idx+1] = parts
                    candidate = (native.dump(changed)+'\n').encode()
                    name = f'candidate-{repeat}-{len(attempts)}'
                    output, accepted, row, exception = transaction.transact(original,candidate,baseline,
                        lambda data: transaction.checked_native(data,name))
                    assert output == (candidate if accepted else original)
                    attempts.append(dict(name=name,**metadata,candidate_sha256=sha(candidate),accepted=accepted,row=row,exception=exception))
                    if accepted:
                        selected = output
                        break
                if selected != original: break
            if selected != original: break
        (args.out/f'selected-{repeat}.kicad_pcb').write_bytes(selected)
        rows.append(dict(repeat=repeat,baseline=baseline,centre_nm=centre,gap_nm=gap,nearby=nearby,
                         skipped=skipped,attempts=attempts,accepted=selected!=original,selected_sha256=sha(selected)))
    assert sources == {name: sha(Path(name).read_bytes()) for name in sources}
    assert len({r['selected_sha256'] for r in rows})==1
    (args.out/'summary.json').write_text(json.dumps(dict(production_fix=False,routing_benchmark=False,
        pad_uuid=args.pad,input_sha256=sources,rows=rows),indent=2)+'\n')
    (args.out/'manifest.json').write_text(json.dumps({str(p.relative_to(args.out)):sha(p.read_bytes())
        for p in sorted(args.out.rglob('*')) if p.is_file() and p.suffix!='.kicad_prl'},indent=2)+'\n')
    print(f'PASS: {sum(r["accepted"] for r in rows)}/3 local transactions accepted')

if __name__=='__main__': main()
