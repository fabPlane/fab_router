#!/usr/bin/python3
"""Offline coherent-junction thermal experiment; no production routing changes."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import native
import transaction
geometry = transaction.module('junction_geometry', 'geometry-doglegs.py')

def point(node, key):
    return tuple(round(float(v)*1e6) for v in native.child(node,key)[1:3])

def move_junction(nodes, track_uuid, junction, delta):
    """Move all coincident same-net/layer straight-track endpoints together.

    Pads, vias, arcs and interior contacts are not moved. Native terminal checks
    remain mandatory; matching endpoint coordinates alone do not prove safety.
    """
    tracks = [n for n in nodes if isinstance(n,list) and n[0]=='segment']
    source = next((n for n in tracks if native.uid(n)==track_uuid),None)
    if source is None or junction not in (point(source,'start'),point(source,'end')) or not any(delta):
        raise ValueError('invalid source endpoint or displacement')
    moved = []
    result = copy.deepcopy(nodes)
    for node in result:
        if not isinstance(node,list) or node[0]!='segment': continue
        if any(native.child(node,k)!=native.child(source,k) for k in ('net','layer')): continue
        keys = [k for k in ('start','end') if point(node,k)==junction]
        if not keys: continue
        for key in keys:
            native.child(node,key)[1:3] = [f'{(v+d)/1e6:.6f}' for v,d in zip(junction,delta)]
        if point(node,'start')==point(node,'end'):
            raise ValueError('displacement collapses a segment')
        moved.append(native.uid(node))
    return result,sorted(moved)

def shared_junction(nodes, track_uuid, centre):
    track=next(n for n in nodes if isinstance(n,list) and native.uid(n)==track_uuid)
    endpoints=[]
    for junction in (point(track,'start'),point(track,'end')):
        _,moved=move_junction(nodes,track_uuid,junction,(1,1))
        if len(moved)>1:endpoints.append(junction)
    if not endpoints:raise ValueError('no shared straight-track junction')
    return min(endpoints,key=lambda pt:sum((a-b)**2 for a,b in zip(pt,centre)))

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source',type=Path,required=True)
    p.add_argument('--out',type=Path,required=True)
    p.add_argument('--pad',required=True)
    args=p.parse_args(); args.out.mkdir(parents=True,exist_ok=False)
    native.SRC,native.D,native.TARGET=args.source,args.out,args.pad
    assert native.pcbnew.Version()=='10.0.6'
    sha=lambda data:hashlib.sha256(data).hexdigest()
    original=args.source.read_bytes(); nodes=native.parse(original.decode())
    sources={str(args.source.with_suffix(ext)):sha(args.source.with_suffix(ext).read_bytes())
             for ext in ('.kicad_pcb','.kicad_pro','.kicad_dru')}
    rows=[]
    for repeat in range(1,4):
        baseline=transaction.checked_native(original,f'baseline-{repeat}')
        assert baseline['target']
        board=native.pcbnew.LoadBoard(str(args.out/f'baseline-{repeat}'/'board.kicad_pcb'))
        pad=next(p for p in board.GetPads() if p.m_Uuid.AsString()==args.pad)
        centre=tuple(pad.GetPosition())
        gap=min(z.GetThermalReliefGap() for z in board.Zones() if z.GetNetCode()==pad.GetNetCode()
                and any(z.IsOnLayer(l) for l in pad.GetLayerSet().Seq()))
        nearby=geometry.nearby(board,pad,2)
        attempts=[];selected=original
        for rank,info in enumerate(nearby,1):
            track=next(n for n in nodes if isinstance(n,list) and native.uid(n)==info['uuid'])
            junction=shared_junction(nodes,info['uuid'],centre)
            for scale in (-.2,.2,-.4,.4,-.6,.6,-.8,.8,-1.,1.):
                delta=tuple(round(gap*scale*v) for v in info['normal'])
                changed,moved=move_junction(nodes,info['uuid'],junction,delta)
                candidate=(native.dump(changed)+'\n').encode()
                name=f'candidate-{repeat}-{len(attempts)}'
                output,accepted,row,exception=transaction.transact(original,candidate,baseline,
                    lambda data:transaction.checked_native(data,name))
                assert output==(candidate if accepted else original)
                attempts.append(dict(name=name,rank=rank,track_uuid=info['uuid'],junction_nm=junction,
                    delta_nm=delta,scale=scale,moved=moved,candidate_sha256=sha(candidate),
                    accepted=accepted,row=row,exception=exception))
                if accepted: selected=output;break
            if selected!=original:break
        (args.out/f'selected-{repeat}.kicad_pcb').write_bytes(selected)
        rows.append(dict(repeat=repeat,baseline=baseline,centre_nm=centre,gap_nm=gap,nearby=nearby,
                         attempts=attempts,accepted=selected!=original,selected_sha256=sha(selected)))
    assert sources=={name:sha(Path(name).read_bytes()) for name in sources}
    assert len({r['selected_sha256'] for r in rows})==1
    (args.out/'summary.json').write_text(json.dumps(dict(production_fix=False,routing_benchmark=False,
        pad_uuid=args.pad,input_sha256=sources,rows=rows),indent=2)+'\n')
    (args.out/'manifest.json').write_text(json.dumps({str(f.relative_to(args.out)):sha(f.read_bytes())
        for f in sorted(args.out.rglob('*')) if f.is_file() and f.suffix!='.kicad_prl'},indent=2)+'\n')
    print(f'PASS: {sum(r["accepted"] for r in rows)}/3 coherent junction searches accepted')

if __name__=='__main__':main()
