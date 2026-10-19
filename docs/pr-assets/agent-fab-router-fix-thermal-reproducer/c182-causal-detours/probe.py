"""Causal-track detours on complete output; offline diagnostic, never scored routing."""
import argparse, copy, hashlib, json, shutil, sys, uuid
from pathlib import Path
from geometry import paths
sys.path.insert(0,str(Path(__file__).resolve().parent.parent/'c178-causal-tracks'))
import ablate as m

def proposals(nodes, uid):
    witness=next(n for n in nodes if isinstance(n,list) and n[0]=='segment' and m.native.uid(n)==uid)
    a,b=[tuple(map(float,m.native.child(witness,k)[1:3])) for k in ('start','end')]
    for index,points in enumerate(paths(a,b)):
        result=copy.deepcopy(nodes)
        result.remove(next(n for n in result if isinstance(n,list) and n[0]=='segment' and m.native.uid(n)==uid))
        for j,(a,b) in enumerate(zip(points,points[1:])):
            track=copy.deepcopy(witness)
            for key,point in [('start',a),('end',b)]:m.native.child(track,key)[1:3]=[format(v,'.6f') for v in point]
            m.native.child(track,'uuid')[1]='"'+str(uuid.uuid5(uuid.NAMESPACE_URL,f'c182-{uid}-{index}-{j}'))+'"'
            result.append(track)
        yield (m.native.dump(result)+'\n').encode()

def main():
    p=argparse.ArgumentParser();p.add_argument('--previous',type=Path,required=True);p.add_argument('--out',type=Path,required=True);x=p.parse_args()
    x.out.mkdir(parents=True,exist_ok=False)
    assert m.native.pcbnew.Version()=='10.0.6'
    base=x.previous/'connected' if (x.previous/'connected').is_dir() else x.previous
    for name in ('source','input'):
        shutil.copytree(base/name,x.out/name)
    m.native.SRC=x.out/'source/board.kicad_pcb';m.native.D=x.out/'native';m.native.D.mkdir()
    source=m.native.SRC.read_bytes();nodes=m.native.parse(source.decode())
    original_ids={m.native.uid(n) for n in m.native.parse((x.out/'input/board.kicad_pcb').read_text()) if isinstance(n,list)}
    findings=json.loads((Path(__file__).resolve().parent.parent/'c178-causal-tracks/findings.json').read_text())
    causes=[(f['label'],c['item']) for f in findings['findings'] for c in f['causes'] if c['kind']=='segment']
    assert len(causes)==5 and all(uid not in original_ids for _,uid in causes)
    hashes={str(path.relative_to(x.out)):hashlib.sha256(path.read_bytes()).hexdigest() for name in ('source','input') for path in (x.out/name).iterdir() if path.suffix in ('.kicad_pcb','.kicad_pro','.kicad_dru')}
    repeats=[]
    for repeat in range(3):
        baseline=m.transaction.checked_native(source,f'baseline-{repeat}');assert len(baseline['errors'])==6 and baseline['opens']==15
        attempts=[]
        for label,uid in causes:
            for index,data in enumerate(proposals(nodes,uid)):
                name=f'candidate-{repeat}-{label}-{index}';(m.native.D/(name+'.proposal.kicad_pcb')).write_bytes(data)
                try:row=m.transaction.checked_native(data,name);failure=None
                except ValueError as exc:
                    if str(exc)!='checked board differs from proposed design':raise
                    row=None;failure=str(exc)
                lost=m.transaction.terminals.lost_pairs(baseline['groups'],row['groups']) if row else None
                accepted=bool(row and m.transaction.errors(row)<m.transaction.errors(baseline) and baseline['groups'].keys()==row['groups'].keys() and not lost and row['opens']<=baseline['opens'])
                attempts.append(dict(name=name,label=label,uid=uid,index=index,row=row,failure=failure,lost_pairs=lost,accepted=accepted))
                if accepted:break
        repeats.append(dict(baseline=baseline,attempts=attempts))
        (x.out/'summary.json').write_text(json.dumps(dict(repeats=repeats,source_hashes=hashes,production_fix=False,routing_benchmark=False),indent=2)+'\n')
    def signature(r):
        return [(a['label'],a['index'],a['accepted'],a['failure'],a['lost_pairs'],dict(errors=sorted(m.transaction.errors(a['row']).items()),opens=a['row']['opens'],groups=a['row']['groups']) if a['row'] else None) for a in r['attempts']]
    assert all(signature(r)==signature(repeats[0]) for r in repeats[1:])
    assert hashes=={path:hashlib.sha256((x.out/path).read_bytes()).hexdigest() for path in hashes}
    print('PASS: exact error multisets, opens, terminal partitions and acceptance repeat 3/3; sources unchanged')
    print(json.dumps([(a['label'],a['index'],len(a['row']['errors']),a['row']['opens']) for a in repeats[0]['attempts'] if a['accepted']]))
if __name__=='__main__':main()
