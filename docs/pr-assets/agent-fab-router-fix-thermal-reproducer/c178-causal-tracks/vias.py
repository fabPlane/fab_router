#!/usr/bin/python3
"""Check eight nearest generated through-vias for the unresolved C1 thermal marker."""
import argparse,json
from pathlib import Path
import ablate as m
PAD='0058b9c6-73af-4ba8-a061-fb00a457a84f'

def candidates(data, input_data, errors):
    nodes=m.native.parse(data.decode())
    original={m.native.uid(n) for n in m.native.parse(input_data.decode()) if isinstance(n,list)}
    error=next(e for e in errors if e['type']=='starved_thermal' and any(i['uuid']==PAD for i in e['items']))
    point=next(i['pos'] for i in error['items'] if i['uuid']==PAD)
    vias=[n for n in nodes if isinstance(n,list) and n[0]=='via' and m.native.uid(n) not in original
          and m.native.child(n,'layers')[1:]==['"F.Cu"','"B.Cu"']]
    def key(n):
        x,y=map(float,m.native.child(n,'at')[1:3])
        return (x-point['x'])**2+(y-point['y'])**2,m.native.uid(n)
    for via in sorted(vias,key=key)[:8]:
        yield m.native.uid(via),(m.native.dump([n for n in nodes if n is not via])+'\n').encode()

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source',type=Path,required=True);p.add_argument('--input',type=Path,required=True);p.add_argument('--out',type=Path,required=True)
    x=p.parse_args();x.out.mkdir(parents=True,exist_ok=False)
    assert m.native.pcbnew.Version()=='10.0.6'
    m.native.SRC,m.native.D=x.source,x.out
    data,inp=x.source.read_bytes(),x.input.read_bytes()
    sources={str(b.with_suffix(ext)):m.sha(b.with_suffix(ext).read_bytes()) for b in (x.source,x.input) for ext in ('.kicad_pcb','.kicad_pro','.kicad_dru')}
    (x.out/'sources').mkdir()
    for path,digest in sources.items():(x.out/'sources'/digest).write_bytes(Path(path).read_bytes())
    rows=[]
    for repeat in range(3):
        base=m.transaction.checked_native(data,f'baseline-{repeat}')
        attempts=[]
        for i,(uid,proposal) in enumerate(candidates(data,inp,base['errors'])):
            name=f'via-{repeat}-{i}';row=m.transaction.checked_native(proposal,name)
            attempts.append(dict(name=name,via=uid,proposal_sha256=m.sha(proposal),row=row,
                removed_errors=list((m.transaction.errors(base)-m.transaction.errors(row)).elements()),
                added_errors=list((m.transaction.errors(row)-m.transaction.errors(base)).elements()),
                lost_pairs=m.transaction.terminals.lost_pairs(base['groups'],row['groups'])))
        rows.append(dict(repeat=repeat,baseline=base,attempts=attempts))
    signatures=[json.dumps([(a['via'],a['row']['errors'],a['row']['opens'],a['row']['groups']) for a in r['attempts']],sort_keys=True) for r in rows]
    assert len(set(signatures))==1
    assert sources=={path:m.sha(Path(path).read_bytes()) for path in sources}
    (x.out/'summary.json').write_text(json.dumps(dict(production_fix=False,routing_benchmark=False,pad=PAD,native_version='10.0.6',source_sha256=sources,rows=rows),indent=2)+'\n')
    print('PASS: 8 generated through-via deletions x 3; source bytes preserved')
if __name__=='__main__':main()
