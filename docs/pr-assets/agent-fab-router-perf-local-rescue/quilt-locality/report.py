"""Validate diagnostic replay parity and bounded slot accounting; never score timings."""
from pathlib import Path
import copy,gzip,hashlib,importlib.util,json,sys
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('prior',HERE.parent/'quilt-census/report.py')
prior=importlib.util.module_from_spec(spec);spec.loader.exec_module(prior)
def check(records):
    assert len(records)==3
    for r in records:
        prior.parity.module.verify(r['result'],prior.parity.REFERENCE,r['ses'].encode(),prior.parity.DSN)
        assert prior.parity.logs(r['result']['logs'])==prior.parity.logs(prior.parity.CONTROL['logs'])
        c=r['census'];assert set(c)=={'quilts','calls','mapHits','invalidations','slots'}
        assert all(type(c[k]) is int and c[k]>=0 for k in ('quilts','calls','mapHits','invalidations'))
        # Independently measured whole-board census from the previous cycle.
        old=json.loads((HERE.parent/'quilt-census/summary.json').read_text())['census']
        assert c['quilts']==old['quilts'] and c['calls']==old['calls']
        assert c['mapHits']==old['hitsFree']+old['hitsBlocked']
        assert c['invalidations']==old['invalidations']
        assert [s['size'] for s in c['slots']]==[64,256,1024]
        for s in c['slots']:
            assert set(s)=={'size','hits','cold','collisions'}
            assert all(type(v) is int and v>=0 for v in s.values())
            assert s['hits']+s['cold']+s['collisions']==c['calls']
            assert s['hits']<=c['mapHits']
            assert s['cold']<=c['quilts']*s['size'] # workload has zero invalidation
        assert c==records[0]['census']
    return {'scope':'three complete diagnostic replays; simulated front slots, no speed prediction', 'repeats':3,'parity':True,'census':records[0]['census']}
def source_check(audit,observer):
    prior.source_check(audit,observer)
    # Removing precisely the observer additions must restore the unchanged module.
    from ast import literal_eval,parse,Assign
    tree=parse((HERE/'prepare.py').read_text())
    replacements=next(literal_eval(n.value) for n in tree.body if isinstance(n,Assign) and any(getattr(t,'id','')=='replacements' for t in n.targets))
    original=observer.decode()
    for old,new in reversed(replacements):
        assert original.count(new)==1
        original=original.replace(new,old)
    assert hashlib.sha256(original.encode()).hexdigest()==audit['src/route/quilt.ts']['original']
def emit(records,out):
    summary=check(records);c=summary['census']
    (out/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
    (out/'table.md').write_text('| Slots per quilt | Simulated hits | Cold slots | Collisions | Calls covered |\n|---:|---:|---:|---:|---:|\n'+''.join(f"| {s['size']} | {s['hits']:,} | {s['cold']:,} | {s['collisions']:,} | {100*s['hits']/c['calls']:.2f}% |\n" for s in c['slots']))
    svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="380"><rect width="1200" height="380" fill="white"/><g font-family="sans-serif" fill="#172536"><text x="35" y="40" font-size="25">Simulated quilt front-cache locality</text><text x="35" y="75" font-size="17">Three identical complete-board counts; no lookup savings or speed measured</text>']
    for i,s in enumerate(c['slots']):
        y=110+i*75;ratio=s['hits']/c['calls'];w=750*ratio
        svg.append(f'<text x="35" y="{y+25}" font-size="20">{s["size"]} slots</text><rect x="180" y="{y}" width="{w:.4f}" height="38" fill="#327b9e"/><text x="{190+w:.4f}" y="{y+25}" font-size="20">{ratio:.2%}</text>')
    (out/'chart.svg').write_text('\n'.join(svg+['</g></svg>'])+'\n')
    return summary
if __name__=='__main__':
    work=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(exist_ok=True)
    records=[{'result':json.loads((work/f'replay{i}/result.json').read_text()),'ses':(work/f'replay{i}/board.ses').read_text(),'census':json.loads((work/f'replay{i}/census.json').read_text())} for i in (1,2,3)]
    mutations=[('session',lambda r:r[0].update(ses='bad')),('accounting',lambda r:r[0]['census']['slots'][0].update(hits=1)),('schema',lambda r:r[0]['census'].update(bad=1)),('repeat',lambda r:r[1]['census']['slots'][0].update(size=128)),('map',lambda r:r[0]['census'].update(mapHits=0)),('negative',lambda r:r[0]['census']['slots'][0].update(cold=-1))]
    controls=[]
    for name,mutate in mutations:
        altered=copy.deepcopy(records);mutate(altered)
        try:check(altered)
        except (AssertionError,ValueError):controls.append(name)
        else:raise AssertionError('accepted '+name)
    audit=json.loads((work/'work/source-audit.json').read_text());observer=gzip.decompress((work/'work/quilt-observer.ts.gz').read_bytes())
    source_check(audit,observer)
    for label,bad in [('bytes',observer+b'\n'),('decision',observer.replace(b'return cached;',b'return "free";'))]:
        altered=copy.deepcopy(audit)
        if label=="decision":altered["src/route/quilt.ts"]["observer"]=hashlib.sha256(bad).hexdigest()
        try:source_check(altered,bad)
        except AssertionError:controls.append('source-'+label)
        else:raise AssertionError('accepted source '+label)
    emit(records,out)
    (out/'controls.json').write_text(json.dumps(controls,indent=2)+'\n')
    (out/'records.json.gz').write_bytes(gzip.compress(json.dumps(records).encode(),mtime=0))
    for name in ('source-audit.json','quilt-observer.ts.gz'):(out/name).write_bytes((work/'work'/name).read_bytes())
    print((out/'table.md').read_text())
