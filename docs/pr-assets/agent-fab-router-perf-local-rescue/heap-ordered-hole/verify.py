"""Replay source/output witnesses and reject corrupted records."""
from pathlib import Path
import copy,gzip,hashlib,importlib.util,json,statistics,sys
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('parity',HERE.parent/'lattice-census/verify.py')
parity=importlib.util.module_from_spec(spec);spec.loader.exec_module(parity)
def check(records):
    assert len(records)==6
    assert [(r['mode'],r['repeat']) for r in records]==[(m,i) for i in (1,2,3) for m in ('original','candidate')]
    for r in records:
        parity.module.verify(r['result'],parity.REFERENCE,r['ses'].encode(),parity.DSN)
        assert parity.logs(r['result']['logs'])==parity.logs(parity.CONTROL['logs'])
        assert r['result']['seconds']>0
    return {m:dict(seconds=(v:=[r['result']['seconds'] for r in records if r['mode']==m]),median_s=statistics.median(v),max_s=max(v)) for m in ('original','candidate')}
def source_check(audit,data):
    baseline=json.loads((HERE.parent/'native-profile/source-hashes.json').read_text())
    assert len(audit)==1536 and set(audit)<=set(baseline)
    assert all(v['original']==baseline[k] for k,v in audit.items())
    assert [k for k,v in audit.items() if v['original']!=v['candidate']]==['src/route/search.ts']
    assert hashlib.sha256(data).hexdigest()==audit['src/route/search.ts']['candidate']
def summarize(records,audit,data):
    source_check(audit,data);timings=check(records);rejected=[]
    for name in ('session','stats','settings','logs','repeat','seconds'):
        bad=copy.deepcopy(records)
        if name=='session':bad[0]['ses']+='x'
        if name=='stats':bad[0]['result']['stats']['unrouted']=-1
        if name=='settings':bad[0]['result']['settings']['localRecovery']=False
        if name=='logs':bad[0]['result']['logs'].append('wrong')
        if name=='repeat':bad[0]['repeat']=2
        if name=='seconds':bad[0]['result']['seconds']=0
        try:check(bad)
        except (AssertionError,KeyError):rejected.append(name)
        else:raise AssertionError('accepted '+name)
    for name in ('bytes','original-hash','unexpected-source'):
        bad=copy.deepcopy(audit);raw=data
        if name=='bytes':raw+=b'x'
        if name=='original-hash':bad['src/api.ts']['original']='0'*64
        if name=='unexpected-source':bad['src/api.ts']['candidate']='0'*64
        try:source_check(bad,raw)
        except AssertionError:rejected.append(name)
        else:raise AssertionError('accepted '+name)
    return dict(scope='One complete engine workload, three alternating pairs; no new native check or full-suite speed claim',parity=True,timings=timings,rejected_controls=rejected)
if __name__=='__main__':
    for name,digest in json.loads((HERE/'manifest.json').read_text()).items():assert hashlib.sha256((HERE/name).read_bytes()).hexdigest()==digest,name
    r=json.loads(gzip.decompress((HERE/'records.json.gz').read_bytes()))
    a=json.loads((HERE/'source-audit.json').read_text());data=gzip.decompress((HERE/'search-candidate.ts.gz').read_bytes())
    Path(sys.argv[1]).write_text(json.dumps(summarize(r,a,data),indent=2)+'\n')
