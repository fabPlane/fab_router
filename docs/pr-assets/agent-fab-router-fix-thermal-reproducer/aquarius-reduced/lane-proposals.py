#!/usr/bin/python3
"""Offline pad-oriented lane search; no production routing changes."""
import argparse
import copy
import hashlib
import json
import math
from pathlib import Path
import uuid
import native
import transaction

PAIR=('9ec8b353-4e41-40b5-9afc-9acbb83d07fa','8eb8d491-19e8-4eed-bc7b-03693b673699')
TARGET='12cbe2ed-3861-4e0e-89f1-6c66f25e5228'

def point(node,key):return tuple(round(float(v)*1e6) for v in native.child(node,key)[1:3])

def transform(point,centre,angle):
    a=math.radians(angle);x,y=point
    return (round(centre[0]+x*math.cos(a)-y*math.sin(a)),
            round(centre[1]+x*math.sin(a)+y*math.cos(a)))

def parts(track,points):
    if len(points)<2 or any(a==b for a,b in zip(points,points[1:])):
        raise ValueError('lane must contain nonzero connected segments')
    result=[]
    for index,(a,b) in enumerate(zip(points,points[1:])):
        item=copy.deepcopy(track)
        for key,p in (('start',a),('end',b)):native.child(item,key)[1:3]=[f'{v/1e6:.6f}' for v in p]
        if index:native.child(item,'uuid')[1]='"'+str(uuid.uuid5(uuid.NAMESPACE_URL,f'lane-{native.uid(track)}-{points}-{index}'))+'"'
        result.append(item)
    return result

def proposals(nodes,centre,angle,gap):
    tracks=[next(n for n in nodes if isinstance(n,list) and native.uid(n)==u) for u in PAIR]
    assert all(native.child(tracks[0],k)==native.child(tracks[1],k) for k in ('width','layer','net'))
    assert point(tracks[0],'end')==point(tracks[1],'start')
    a,b=point(tracks[0],'start'),point(tracks[1],'end')
    # Native angles use the opposite sign from Cartesian rotation. This axis
    # is the pad's narrow axis; the exact remote endpoints are retained.
    local=lambda p:transform(tuple(p[i]-centre[i] for i in (0,1)),(0,0),angle)
    la,lb=local(a),local(b)
    for lane_scale in (1.,1.5,2.,2.5):
        for turn_scale in (0.,1.):
            lane=round(lb[0]+gap*lane_scale)
            turn=round(lb[1]+gap*turn_scale)
            points=[a,transform((lane,la[1]),centre,-angle),
                    transform((lane,turn),centre,-angle),
                    transform((lb[0],turn),centre,-angle),b]
            # At zero turn the last corner equals the remote endpoint.
            points=[p for i,p in enumerate(points) if i==0 or p!=points[i-1]]
            changed=[copy.deepcopy(n) for n in nodes if not (isinstance(n,list) and native.uid(n) in PAIR)]
            changed.extend(parts(tracks[0],points))
            yield dict(lane_scale=lane_scale,turn_scale=turn_scale,points_nm=points), (native.dump(changed)+'\n').encode()

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
    rows=[]
    for repeat in range(1,4):
        baseline=transaction.checked_native(original,f'baseline-{repeat}');assert baseline['target']
        attempts=[];selected=original
        for metadata,candidate in proposals(nodes,centre,angle,gap):
            name=f'candidate-{repeat}-{len(attempts)}'
            output,accepted,row,exception=transaction.transact(original,candidate,baseline,lambda data:transaction.checked_native(data,name))
            assert output==(candidate if accepted else original)
            attempts.append(dict(name=name,**metadata,candidate_sha256=sha(candidate),accepted=accepted,row=row,exception=exception))
            if accepted:selected=output;break
        (args.out/f'selected-{repeat}.kicad_pcb').write_bytes(selected)
        rows.append(dict(repeat=repeat,baseline=baseline,attempts=attempts,accepted=selected!=original,selected_sha256=sha(selected)))
    assert sources=={f:sha(Path(f).read_bytes()) for f in sources}
    assert len({r['selected_sha256'] for r in rows})==1
    (args.out/'summary.json').write_text(json.dumps(dict(production_fix=False,routing_benchmark=False,input_sha256=sources,centre_nm=centre,angle=angle,gap_nm=gap,rows=rows),indent=2)+'\n')
    (args.out/'manifest.json').write_text(json.dumps({str(f.relative_to(args.out)):sha(f.read_bytes())
        for f in sorted(args.out.rglob('*')) if f.is_file() and f.name!='manifest.json' and f.suffix!='.kicad_prl'},indent=2)+'\n')
    print(f'PASS: {sum(r["accepted"] for r in rows)}/3 lane searches accepted')

if __name__=='__main__':main()
