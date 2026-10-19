#!/usr/bin/python3
"""Offline additive pad-to-plane link search; no production routing changes."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import uuid
import native
import transaction
TARGET='12cbe2ed-3861-4e0e-89f1-6c66f25e5228'

def plane_layer(board,pad):
    layers={z.GetLayer() for z in board.Zones()
            if z.GetNetCode()==pad.GetNetCode() and pad.IsOnLayer(z.GetLayer())}
    if len(layers)!=1:raise ValueError('one pad-connected plane layer required')
    return '"'+board.GetLayerName(layers.pop())+'"'

def proposals(nodes,centre,angle,net,layer,gap,width_scales=(0.25,0.5,1.)):
    """Append one same-net ray per proposal; keep every existing design node."""
    if gap<=0:raise ValueError('positive search scale required')
    for width_scale in width_scales:
        width=round(gap*width_scale)
        for direction in range(8):
            radians=math.radians(direction*45-angle)
            end=tuple(round(c+3*gap*f(radians)) for c,f in zip(centre,(math.cos,math.sin)))
            metadata=dict(direction=direction,width_nm=width,end_nm=end)
            identity=str(uuid.uuid5(uuid.NAMESPACE_URL,f'thermal-link-{TARGET}-{centre}-{end}-{width}-{net}-{layer}'))
            coord=lambda p:[f'{v/1e6:.6f}' for v in p]
            track=['segment',['start',*coord(centre)],['end',*coord(end)],
                   ['width',f'{width/1e6:.6f}'],['layer',layer],['net',net],['uuid','"'+identity+'"']]
            yield metadata,(native.dump(nodes+[track])+'\n').encode()

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',type=Path,required=True);parser.add_argument('--out',type=Path,required=True)
    args=parser.parse_args();args.out.mkdir(parents=True,exist_ok=False)
    native.SRC,native.D,native.TARGET=args.source,args.out,TARGET
    assert native.pcbnew.Version()=='10.0.6'
    sha=lambda data:hashlib.sha256(data).hexdigest()
    original=args.source.read_bytes();nodes=native.parse(original.decode())
    sources={str(args.source.with_suffix(e)):sha(args.source.with_suffix(e).read_bytes()) for e in ('.kicad_pcb','.kicad_pro','.kicad_dru')}
    board=native.pcbnew.LoadBoard(str(args.source));pad=next(p for p in board.GetPads() if p.m_Uuid.AsString()==TARGET)
    centre=tuple(pad.GetPosition());angle=pad.GetOrientationDegrees()
    gap=min(z.GetThermalReliefGap() for z in board.Zones() if z.GetNetCode()==pad.GetNetCode() and any(z.IsOnLayer(l) for l in pad.GetLayerSet().Seq()))
    net='"'+pad.GetNetname()+'"';layer=plane_layer(board,pad)
    rows=[]
    for repeat in range(1,4):
        baseline=transaction.checked_native(original,f'baseline-{repeat}');assert baseline['target']
        attempts=[];selected=original
        for metadata,candidate in proposals(nodes,centre,angle,net,layer,gap):
            name=f'candidate-{repeat}-{len(attempts)}'
            output,accepted,row,exception=transaction.transact(original,candidate,baseline,lambda data:transaction.checked_native(data,name))
            assert output==(candidate if accepted else original)
            attempts.append(dict(name=name,**metadata,candidate_sha256=sha(candidate),accepted=accepted,row=row,exception=exception))
            if accepted:selected=output;break
        (args.out/f'selected-{repeat}.kicad_pcb').write_bytes(selected)
        rows.append(dict(repeat=repeat,baseline=baseline,attempts=attempts,accepted=selected!=original,selected_sha256=sha(selected)))
    assert sources=={f:sha(Path(f).read_bytes()) for f in sources}
    assert len({r['selected_sha256'] for r in rows})==1
    (args.out/'summary.json').write_text(json.dumps(dict(production_fix=False,routing_benchmark=False,input_sha256=sources,centre_nm=centre,angle=angle,net=net,layer=layer,gap_nm=gap,width_scales=[0.25,0.5,1.],rows=rows),indent=2)+'\n')
    (args.out/'manifest.json').write_text(json.dumps({str(f.relative_to(args.out)):sha(f.read_bytes())
        for f in sorted(args.out.rglob('*')) if f.is_file() and f.name!='manifest.json' and f.suffix!='.kicad_prl'},indent=2)+'\n')
    print(f'PASS: {sum(r["accepted"] for r in rows)}/3 thermal link searches accepted')

if __name__=='__main__':main()
