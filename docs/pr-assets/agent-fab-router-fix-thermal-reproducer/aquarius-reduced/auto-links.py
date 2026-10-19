#!/usr/bin/python3
"""Offline bounded thermal search from native findings, without a supplied pad UUID.

Diagnostic prototype only. Never applies to a live board or changes source files.
All candidates pass the existing saved-design/rule/native/connectivity transaction.
"""
import argparse
import hashlib
import json
from pathlib import Path
import native
import transaction

straight=transaction.module('auto_straight','thermal-links.py')
bent=transaction.module('auto_bent','thermal-doglegs.py')
sha=lambda data:hashlib.sha256(data).hexdigest()


def targets(row):
    return sorted({item['uuid'] for error in row['errors'] if error['type']=='starved_thermal'
                   for item in error['items'] if item['uuid'] in row['groups']})


def search(original,check,proposals,budget):
    if budget < 1:raise ValueError('positive candidate budget required')
    current=original
    baseline=check(current,'baseline')
    initial=baseline
    attempts=[];skipped=[]
    while True:
        pending=targets(baseline)
        if not pending:stop='no-thermal-targets';break
        if len(attempts)>=budget:stop='budget';break
        accepted=False
        for target in pending:
            try:
                for metadata,candidate in proposals(current,baseline,target):
                    if len(attempts)>=budget:break
                    name=f'candidate-{len(attempts)}'
                    output,ok,row,exception=transaction.transact(current,candidate,baseline,
                        lambda data:check(data,name))
                    assert output==(candidate if ok else current)
                    attempts.append(dict(name=name,target=target,metadata=metadata,
                        input_sha256=sha(current),candidate_sha256=sha(candidate),
                        accepted=ok,row=row,exception=exception))
                    if ok:
                        current=output;baseline=row;accepted=True;break
            except ValueError as exc:
                # Unsupported metadata is an explicit target outcome, not success.
                skipped.append(dict(target=target,reason=str(exc),input_sha256=sha(current)))
            if accepted or len(attempts)>=budget:break
        if accepted:continue
        stop='budget' if len(attempts)>=budget else 'exhausted';break
    return current,dict(baseline=initial,final=baseline,attempts=attempts,skipped=skipped,
        stop=stop,selected_sha256=sha(current))


def native_proposals(data,row,target):
    board=native.pcbnew.LoadBoard(str(native.D/row['name']/'board.kicad_pcb'))
    pad=next(p for p in board.GetPads() if p.m_Uuid.AsString()==target)
    layer=straight.plane_layer(board,pad)
    gap=min(z.GetThermalReliefGap() for z in board.Zones()
            if z.GetNetCode()==pad.GetNetCode()
            and any(z.IsOnLayer(l) for l in pad.GetLayerSet().Seq()))
    nodes=native.parse(data.decode())
    net=json.dumps(str(pad.GetNetname()),ensure_ascii=False)
    for kind,helper in (('straight',straight),('bent',bent)):
        helper.TARGET=target
        for metadata,candidate in helper.proposals(nodes,tuple(pad.GetPosition()),
                pad.GetOrientationDegrees(),net,layer,gap):
            yield dict(kind=kind,**metadata),candidate


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',required=True,type=Path)
    parser.add_argument('--out',required=True,type=Path)
    parser.add_argument('--budget',type=int,default=128)
    args=parser.parse_args()
    if args.budget<1:parser.error('--budget must be positive')
    assert native.pcbnew.Version()=='10.0.6'
    args.out.mkdir(parents=True,exist_ok=False)
    sources={ext:args.source.with_suffix(ext).read_bytes()
             for ext in ('.kicad_pcb','.kicad_pro','.kicad_dru')}
    original=sources['.kicad_pcb'];rows=[]
    native.SRC=args.source
    for repeat in range(1,4):
        native.D=args.out/f'repeat-{repeat}';native.D.mkdir()
        selected,report=search(original,transaction.checked_native,native_proposals,args.budget)
        (native.D/'selected.kicad_pcb').write_bytes(selected)
        for ext in ('.kicad_pro','.kicad_dru'):(native.D/('selected'+ext)).write_bytes(sources[ext])
        rows.append(report)
        assert all(args.source.with_suffix(ext).read_bytes()==data for ext,data in sources.items())
    assert len({r['selected_sha256'] for r in rows})==1
    (args.out/'summary.json').write_text(json.dumps(dict(production_fix=False,routing_benchmark=False,
        input_sha256={ext:sha(data) for ext,data in sources.items()},budget=args.budget,rows=rows),indent=2)+'\n')
    print('PASS: deterministic native-guided searches; final errors:',[len(r['final']['errors']) for r in rows])

if __name__=='__main__':main()
