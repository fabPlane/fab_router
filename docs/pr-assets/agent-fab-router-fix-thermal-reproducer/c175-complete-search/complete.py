#!/usr/bin/python3
"""Offline bounded multi-cause search; publish only a completely clean result.

This diagnostic does not modify the engine or an editor and does not route nets.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'aquarius-reduced'))
import native
import transaction

def load(name,path):
    spec=importlib.util.spec_from_file_location(name,ROOT/path)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    return module
single=load('single','c171-marker-search/search.py')
pair=load('pair','c174-pair-discovery/discover.py')
sha=lambda b:hashlib.sha256(b).hexdigest()

def repair(original,baseline,propose,check,max_stages):
    """Refresh discovery after strict progress; roll back the whole search on failure."""
    assert 1<=max_stages<=8
    current=original
    stages=[]
    for stage in range(max_stages):
        if not baseline['errors']:return current,True,stages
        attempts=[]
        accepted=False
        for index,(label,candidate) in enumerate(propose(current,baseline)):
            name=f'stage-{stage}-candidate-{index}'
            output,accepted,row,exception=transaction.transact(current,candidate,baseline,
                lambda data:check(data,name))
            attempts.append(dict(name=name,label=label,accepted=accepted,row=row,
                exception=exception,candidate_sha256=sha(candidate)))
            assert output==(candidate if accepted else current)
            if accepted:
                current,baseline=output,row
                break
        stages.append(dict(attempts=attempts,accepted=accepted))
        if not accepted:break
    clean=not baseline['errors']
    return (current if clean else original),clean,stages

def candidates(data,baseline,original_ids):
    nodes=native.parse(data.decode())
    for uid in single.rank_segments(nodes,original_ids,baseline['errors'],8):
        for candidate in single.proposals(nodes,uid):yield ['segment',uid],candidate
    for ids in pair.rank_pairs(nodes,original_ids,baseline['errors'],16):
        for candidate in pair.proposals(nodes,ids):yield ['pair',list(ids)],candidate

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source',type=Path,required=True)
    p.add_argument('--input',type=Path,required=True)
    p.add_argument('--out',type=Path,required=True)
    x=p.parse_args();x.out.mkdir(parents=True,exist_ok=False)
    assert native.pcbnew.Version()=='10.0.6'
    native.SRC,native.D=x.source,x.out
    sources={str(b.with_suffix(ext)):sha(b.with_suffix(ext).read_bytes())
        for b in (x.source,x.input) for ext in ('.kicad_pcb','.kicad_pro','.kicad_dru')}
    (x.out/'sources').mkdir()
    for name,digest in sources.items():(x.out/'sources'/digest).write_bytes(Path(name).read_bytes())
    for ext in ('.kicad_pro','.kicad_dru'):
        assert x.source.with_suffix(ext).read_bytes()==x.input.with_suffix(ext).read_bytes()
    original=x.source.read_bytes()
    ids={native.uid(n) for n in native.parse(x.input.read_text()) if isinstance(n,list)}
    rows=[]
    for repeat in range(3):
        baseline=transaction.checked_native(original,f'baseline-{repeat}')
        def check(data,name):
            name=f'repeat-{repeat}-{name}'
            (x.out/(name+'.proposal.kicad_pcb')).write_bytes(data)
            return transaction.checked_native(data,name)
        output,clean,stages=repair(original,baseline,
            lambda data,row:candidates(data,row,ids),check,8)
        (x.out/f'selected-{repeat}.kicad_pcb').write_bytes(output)
        rows.append(dict(repeat=repeat,baseline=baseline,clean=clean,stages=stages,
            selected_sha256=sha(output)))
    assert len({r['selected_sha256'] for r in rows})==1
    assert sources=={name:sha(Path(name).read_bytes()) for name in sources}
    (x.out/'summary.json').write_text(json.dumps(dict(production_fix=False,
        routing_benchmark=False,native_version=native.pcbnew.Version(),source_sha256=sources,rows=rows),indent=2)+'\n')
    print(f'PASS: {sum(r["clean"] for r in rows)}/3 completely clean selections; source bytes preserved')
if __name__=='__main__':main()
