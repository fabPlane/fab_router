"""Independent parity, arithmetic, and repeatability gates; no timing inference."""
from pathlib import Path
import gzip, hashlib, importlib.util, json, sys
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('native_verify',HERE.parent/'native-profile/verify.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
REFERENCE=json.loads(gzip.decompress((HERE.parent/'native-profile/reference.json.gz').read_bytes()))
DSN=gzip.decompress((HERE.parent/'native-profile/board.dsn.gz').read_bytes())
def structural(value):
    if isinstance(value,dict): return {k:structural(v) for k,v in value.items() if k!='seconds'}
    if isinstance(value,list): return [structural(v) for v in value]
    return value
def logs(values):
    result=[]
    for value in values:
        offset=value.find('{')
        result.append(value if offset<0 else [value[:offset],structural(json.loads(value[offset:]))])
    return result
CONTROL=json.loads(gzip.decompress((HERE.parent/'native-profile/replay.json.gz').read_bytes()))
def check(records):
    assert len(records)==3, 'three repeats required'
    for record in records:
        module.verify(record['result'],REFERENCE,record['ses'].encode(),DSN)
        c=record['census']
        assert set(c)=={'calls','blocked','pairs'}, 'counter schema'
        for counts in c.values():
            assert all(isinstance(k,str) and type(v) is int and v>0 for k,v in counts.items()), 'positive counters'
        assert set(c['blocked'])<=set(c['calls']), 'blocked categories'
        assert all(v<=c['calls'][k] for k,v in c['blocked'].items()), 'blocked subset'
        assert all(k.split(':')[0] in c['calls'] and len(k.split(':'))==4 and k.split(':')[-1] in ('touch','spacing') for k in c['pairs']), 'pair categories'
        assert record['census']==records[0]['census'], 'repeat counters'
        assert logs(record['result']['logs'])==logs(CONTROL['logs']), 'independent recovery structure'
    c=records[0]['census']
    return {'scope':'one complete-board observer, three repeats; no timing or native safety claim','parity':True,'repeats':3,'census':c,'total_candidate_calls':sum(c['calls'].values()),'total_convex_comparisons':sum(c['pairs'].values())}
def source_check(audit,observer):
    baseline=json.loads((HERE.parent/'native-profile/source-hashes.json').read_text())
    assert len(audit)==1536 and set(audit)<=set(baseline), 'source inventory'
    assert all(v['original']==baseline[k] for k,v in audit.items()), 'independent source hashes'
    assert [k for k,v in audit.items() if v['original']!=v['observer']]==['src/route/clear.ts'], 'one observer module'
    assert hashlib.sha256(observer).hexdigest()==audit['src/route/clear.ts']['observer'], 'observer bytes'
if __name__=='__main__':
    manifest=json.loads((HERE/'manifest.json').read_text())
    for name,digest in manifest.items():
        assert hashlib.sha256((HERE/name).read_bytes()).hexdigest()==digest, 'archive digest: '+name
    source_check(json.loads((HERE/'source-audit.json').read_text()),gzip.decompress((HERE/'clear-observer.ts.gz').read_bytes()))
    records=json.loads(gzip.decompress((HERE/'records.json.gz').read_bytes()))
    summary=check(records)
    Path(sys.argv[1]).write_text(json.dumps(summary,indent=2)+'\n')
