"""Verify all six complete replays against the independent native-workload control."""
from pathlib import Path
import copy,gzip,hashlib,importlib.util,json,statistics,sys
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('control',HERE.parent/'lattice-census/verify.py')
control=importlib.util.module_from_spec(spec);spec.loader.exec_module(control)
def verify(records):
    assert len(records)==6,'six complete records'
    assert [(r['mode'],r['repeat']) for r in records]==[('original',1),('candidate',1),('candidate',2),('original',2),('original',3),('candidate',3)],'alternating order'
    for r in records:
        control.module.verify(r['result'],control.REFERENCE,r['ses'].encode(),control.DSN)
        assert control.logs(r['result']['logs'])==control.logs(control.CONTROL['logs']),'recovery decisions'
        assert r['result']['seconds']>0,'elapsed time'
    return {mode:{'seconds':[r['result']['seconds'] for r in records if r['mode']==mode],'median_s':statistics.median(r['result']['seconds'] for r in records if r['mode']==mode),'max_s':max(r['result']['seconds'] for r in records if r['mode']==mode)} for mode in ('original','candidate')}
def source_check(audit,candidate):
    baseline=json.loads((HERE.parent/'native-profile/source-hashes.json').read_text())
    assert len(audit)==1536 and set(audit)<=set(baseline),'inventory'
    assert all(v['original']==baseline[k] for k,v in audit.items()),'independent source'
    assert [k for k,v in audit.items() if v['original']!=v['candidate']]==['src/lattice/grid.ts'],'one changed module'
    assert hashlib.sha256(candidate).hexdigest()==audit['src/lattice/grid.ts']['candidate'],'candidate bytes'
def controls(records):
    rejected=[]
    for name in ('session','stats','settings','logs','repeat'):
        bad=copy.deepcopy(records)
        if name=='session':bad[3]['ses']+='x'
        if name=='stats':bad[4]['result']['stats']['unrouted']=999
        if name=='settings':bad[1]['result']['settings']['localRecovery']=False
        if name=='logs':bad[2]['result']['logs'].append('wrong')
        if name=='repeat':bad[5]['repeat']=2
        try:verify(bad)
        except (AssertionError,KeyError):rejected.append(name)
        else:raise AssertionError('accepted corruption '+name)
    return rejected
if __name__=='__main__':
    for name,digest in json.loads((HERE/'manifest.json').read_text()).items():
        assert hashlib.sha256((HERE/name).read_bytes()).hexdigest()==digest,name
    source_check(json.loads((HERE/'source-audit.json').read_text()),gzip.decompress((HERE/'grid-candidate.ts.gz').read_bytes()))
    records=json.loads(gzip.decompress((HERE/'records.json.gz').read_bytes()))
    result={'scope':'one complete engine workload; three alternating repeats per source; no fresh native check or full-suite speed claim','parity':True,'timings':verify(records),'rejected_controls':controls(records)}
    Path(sys.argv[1]).write_text(json.dumps(result,indent=2)+'\n')
