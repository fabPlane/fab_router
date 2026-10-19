"""Validate complete-board parity and reconcile diagnostic cache operations."""
from pathlib import Path
import copy,gzip,hashlib,importlib.util,json,sys
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('parity',HERE.parent/'clearance-census/verify.py')
parity=importlib.util.module_from_spec(spec);spec.loader.exec_module(parity)
KEYS=set('quilts calls hitsFree hitsBlocked missesFree missesBlocked invalidations emptyInvalidations clears clearedEntries deletes removed'.split())
def check(records):
    assert len(records)==3
    for r in records:
        parity.module.verify(r['result'],parity.REFERENCE,r['ses'].encode(),parity.DSN)
        assert parity.logs(r['result']['logs'])==parity.logs(parity.CONTROL['logs'])
        c=r['census'];assert set(c)==KEYS
        assert all(type(v) is int and v>=0 for v in c.values())
        assert c['quilts']>0 and c['calls']>0
        assert c['calls']==sum(c[k] for k in ('hitsFree','hitsBlocked','missesFree','missesBlocked'))
        assert c['emptyInvalidations']+c['clears']<=c['invalidations']
        assert c['removed']<=c['deletes']
        assert c['clearedEntries']+c['removed']<=c['missesFree']+c['missesBlocked']
        assert c==records[0]['census']
    return dict(scope='Complete board, three diagnostic repeats; no timing prediction or native DRC claim',repeats=3,parity=True,census=records[0]['census'])
def source_check(audit,observer):
    baseline=json.loads((HERE.parent/'native-profile/source-hashes.json').read_text())
    assert len(audit)==1536 and set(audit)<=set(baseline)
    assert all(v['original']==baseline[k] for k,v in audit.items())
    assert [k for k,v in audit.items() if v['original']!=v['observer']]==['src/route/quilt.ts']
    assert hashlib.sha256(observer).hexdigest()==audit['src/route/quilt.ts']['observer']
def emit(records,out):
    summary=check(records)
    (out/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
    c=summary['census']
    (out/'table.md').write_text('| Operation | Count |\n|---|---:|\n'+''.join(f'| {k} | {v:,} |\n' for k,v in c.items()))
    bars=['hitsFree','hitsBlocked','missesFree','missesBlocked']
    svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="420" viewBox="0 0 1200 420"><rect width="1200" height="420" fill="white"/><g font-family="sans-serif" fill="#172536"><text x="35" y="40" font-size="26">Quilt cache operations on one complete board</text><text x="35" y="73" font-size="17">Three identical diagnostic repeats; counts do not predict speed</text>']
    for i,k in enumerate(bars):
        y=110+i*65;w=700*c[k]/max(c[x] for x in bars)
        svg.append(f'<text x="35" y="{y+25}" font-size="20">{k}</text><rect x="220" y="{y}" width="{w:.4f}" height="36" fill="#327b9e"/><text x="{230+w:.4f}" y="{y+25}" font-size="18">{c[k]:,}</text>')
    svg.append('</g></svg>');(out/'chart.svg').write_text('\n'.join(svg)+'\n')
    return summary
if __name__=='__main__':
    work=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(exist_ok=True)
    records=[dict(result=json.loads((work/f'replay{i}/result.json').read_text()),ses=(work/f'replay{i}/board.ses').read_text(),census=json.loads((work/f'replay{i}/census.json').read_text())) for i in (1,2,3)]
    controls=[]
    mutations=[('session',lambda r:r[0].update(ses='bad')),('statistics',lambda r:r[0]['result']['stats'].update(unrouted=-1)),('schema',lambda r:r[0]['census'].update(bad=1)),('negative',lambda r:r[0]['census'].update(quilts=-1)),('accounting',lambda r:r[0]['census'].update(calls=1)),('repeat',lambda r:r[1]['census'].update(quilts=r[1]['census']['quilts']+1))]
    for name,mutate in mutations:
        altered=copy.deepcopy(records);mutate(altered)
        try:check(altered)
        except (AssertionError,ValueError):controls.append(name)
        else:raise AssertionError('accepted '+name)
    source_check(json.loads((work/'work/source-audit.json').read_text()),gzip.decompress((work/'work/quilt-observer.ts.gz').read_bytes()))
    print(json.dumps(emit(records,out),indent=2))
    (out/'controls.json').write_text(json.dumps(controls,indent=2)+'\n')
    (out/'records.json.gz').write_bytes(gzip.compress(json.dumps(records).encode(),mtime=0))
    for name in ('source-audit.json','quilt-observer.ts.gz'):(out/name).write_bytes((work/'work'/name).read_bytes())
