"""Discover deletion causes from native markers, then revalidate bounded repairs.

Offline complete-board diagnostic. No cause UUID, label or findings file is input.
Deletion probes are hypotheses only; lost connectivity never authorizes publication.
"""
import argparse, hashlib, importlib.util, json, shutil, sys
from pathlib import Path
from discovery import rank_vias
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'c182-causal-detours'))
import probe as m
spec=importlib.util.spec_from_file_location('via_geometry',ROOT/'c181-via-displacement/geometry.py')
g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
native,transaction=m.m.native,m.m.transaction
sha=lambda b:hashlib.sha256(b).hexdigest()

def candidates(data, original, errors):
    nodes=native.parse(data.decode());items={native.uid(n):n for n in nodes if isinstance(n,list)}
    result={}
    for error in errors:
        if error['type']!='starved_thermal':raise ValueError('unsupported source error')
        for uid in m.m.search.rank_segments(nodes,original,[error],8)+rank_vias(nodes,original,error,8):
            assert uid not in original
            result[uid]=items[uid][0]
    return sorted(result.items())

def remove(data,uid):
    nodes=native.parse(data.decode())
    return (native.dump([n for n in nodes if not(isinstance(n,list) and native.uid(n)==uid)])+'\n').encode()

def proposals(data,uid,kind,original):
    yield 'delete',remove(data,uid)
    nodes=native.parse(data.decode())
    if kind=='segment':
        for i,value in enumerate(m.proposals(nodes,uid)):yield f'detour-{i}',value
    else:
        for i,(dx,dy) in enumerate(((.5,0),(-.5,0),(0,.5),(0,-.5),(1,0),(-1,0),(0,1),(0,-1))):
            yield f'move-{i}',(native.dump(g.relocate(nodes,uid,dx,dy,protected_ids=original))+'\n').encode()

def main():
    p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--input',type=Path,required=True);p.add_argument('--out',type=Path,required=True);x=p.parse_args()
    assert native.pcbnew.Version()=='10.0.6'
    x.out.mkdir(parents=True,exist_ok=False)
    for name,board in [('source',x.source),('input',x.input)]:
        (x.out/name).mkdir()
        for ext in ('.kicad_pcb','.kicad_pro','.kicad_dru'):shutil.copyfile(board.with_suffix(ext),x.out/name/('board'+ext))
    native.SRC=x.out/'source/board.kicad_pcb';native.D=x.out/'native';native.D.mkdir()
    source=native.SRC.read_bytes();original={native.uid(n) for n in native.parse(x.input.read_text()) if isinstance(n,list)}
    source_hashes={str(p.relative_to(x.out)):sha(p.read_bytes()) for d in ('source','input') for p in (x.out/d).iterdir()}
    repeats=[]
    for repeat in range(3):
        baseline=transaction.checked_native(source,f'baseline-{repeat}');pool=candidates(source,original,baseline['errors']);discovery=[];causes=[]
        for index,(uid,kind) in enumerate(pool):
            name=f'discovery-{repeat}-{index}';data=remove(source,uid)
            (native.D/(name+'.proposal.kicad_pcb')).write_bytes(data)
            try:row=transaction.checked_native(data,name);failure=None
            except ValueError as exc:
                if str(exc)!='checked board differs from proposed design':raise
                row=None;failure=str(exc)
            causal=bool(row and transaction.errors(row)<transaction.errors(baseline))
            discovery.append(dict(name=name,uid=uid,kind=kind,row=row,failure=failure,causal=causal))
            if causal:causes.append((uid,kind))
        print(f'repeat {repeat}: {len(pool)} candidates, {len(causes)} causes',flush=True)
        current=source;prior=baseline;attempts=[]
        for index,(uid,kind) in enumerate(causes):
            for variant,data in proposals(current,uid,kind,original):
                name=f'repair-{repeat}-{index}-{variant}'
                (native.D/(name+'.proposal.kicad_pcb')).write_bytes(data)
                selected,accepted,row,failure=transaction.transact(current,data,prior,lambda value:transaction.checked_native(value,name))
                attempts.append(dict(name=name,uid=uid,kind=kind,variant=variant,row=row,failure=failure,accepted=accepted,before_sha256=sha(current)))
                assert selected==(data if accepted else current)
                if accepted:current=selected;prior=row;break
        # Partial progress is diagnostic only. Publish source unless the whole board is clean.
        complete=not prior['errors'];published=current if complete else source
        (x.out/f'selected-{repeat}.kicad_pcb').write_bytes(published)
        repeats.append(dict(baseline=baseline,pool=pool,discovery=discovery,causes=causes,attempts=attempts,final=prior,complete=complete,selected_sha256=sha(published)))
        (x.out/'summary.json').write_text(json.dumps(dict(production_fix=False,routing_benchmark=False,source_hashes=source_hashes,repeats=repeats),indent=2)+'\n')
        print(f'repeat {repeat}: {len(prior["errors"])} errors, {prior["opens"]} opens, complete={complete}',flush=True)
    assert len({r['selected_sha256'] for r in repeats})==1
    assert source_hashes=={path:sha((x.out/path).read_bytes()) for path in source_hashes}
    print('PASS: selected bytes repeat 3/3; source and sidecars unchanged')
if __name__=='__main__':main()
