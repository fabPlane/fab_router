"""Check complete-board decision parity and count ordered endpoint opportunities."""
from pathlib import Path
import copy,gzip,hashlib,importlib.util,json,sys
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('parity',HERE.parent/'clearance-census/verify.py')
parity=importlib.util.module_from_spec(spec);spec.loader.exec_module(parity)
def check(records):
    assert len(records)==3
    for r in records:
        parity.module.verify(r['result'],parity.REFERENCE,r['ses'].encode(),parity.DSN)
        assert parity.logs(r['result']['logs'])==parity.logs(parity.CONTROL['logs'])
        assert r['census']==records[0]['census']
        assert r['census']
        for k,v in r['census'].items():
            a,b,mode,stage=k.split(':')
            assert a in ('capsule','box','rounded','hull') and b in ('capsule','box','rounded','hull')
            assert mode in ('touch','spacing') and stage in ('intersection','intersection-reject','1','2','3','4','none')
            assert type(v) is int and v>0
    counts={k:0 for k in ('intersection','intersection-reject','1','2','3','4','none')}
    for k,v in records[0]['census'].items():counts[k.split(':')[-1]]+=v
    total=sum(counts.values())
    independent=json.loads((HERE.parent/'clearance-census/summary.json').read_text())['census']['pairs']
    assert total==sum(v for k,v in independent.items() if k.split(':')[1:3]==['capsule','capsule'])
    assert all(k.startswith('capsule:capsule:spacing:') for k in records[0]['census'])
    disjoint=total-counts['intersection']-counts['intersection-reject']
    needed=sum(int(k)*counts[k] for k in ('1','2','3','4'))+4*counts['none']
    return dict(scope='One complete board, three repeats; diagnostic counts, no timing prediction or native DRC claim',repeats=3,comparisons=total,stages=counts,original_endpoint_evaluations=4*disjoint,hypothetical_endpoint_evaluations=needed,avoidable_endpoint_evaluations=4*disjoint-needed)
def main():
    work=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(exist_ok=True)
    records=[dict(result=json.loads((work/f'replay{i}/result.json').read_text()),ses=(work/f'replay{i}/board.ses').read_text(),census=json.loads((work/f'replay{i}/census.json').read_text())) for i in (1,2,3)]
    summary=check(records)
    controls=[]
    for name,mutate in [('session',lambda r:r[0].update(ses='bad')),('stats',lambda r:r[0]['result']['stats'].update(unrouted=-1)),('counter',lambda r:r[0]['census'].update(bad=1)),('zero',lambda r:[x['census'].update({next(iter(x['census'])):0}) for x in r])]:
        altered=copy.deepcopy(records);mutate(altered)
        try:check(altered)
        except (AssertionError,ValueError):controls.append(name)
        else:raise AssertionError('accepted '+name)
    audit=json.loads((work/'work/source-audit.json').read_text()); observer=gzip.decompress((work/'work/clear-observer.ts.gz').read_bytes())
    parity.source_check(audit,observer)
    for name,value in [('summary.json',summary),('controls.json',controls)]: (out/name).write_text(json.dumps(value,indent=2)+'\n')
    (out/'records.json.gz').write_bytes(gzip.compress(json.dumps(records).encode(),mtime=0))
    for name in ('source-audit.json','clear-observer.ts.gz'):(out/name).write_bytes((work/'work'/name).read_bytes())
    lines=['| First accepting stage | Comparisons |','|---|---:|']+[f'| {k} | {v:,} |' for k,v in summary['stages'].items()]
    (out/'table.md').write_text('\n'.join(lines)+'\n')
    print(json.dumps(summary,indent=2))
if __name__=='__main__':main()
