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
        assert all(isinstance(v,int) and v>=0 for k,v in c.items() if k!='histogram'), 'nonnegative integer counters'
        assert c['visits']==c['duplicates']+c['bucketTests'], 'visit partition'
        assert c['results']+c['filterRejected']==c['bucketHits']+c['shelfHits'], 'hit partition'
        assert sum(c['histogram'].values())+c['missing']==c['queries'], 'query partition'
        assert c['nonempty']<=c['cells'] and c['bucketHits']<=c['bucketTests'] and c['shelfHits']<=c['shelfTests'], 'subset counts'
        assert record['census']==records[0]['census'], 'repeat counters'
        assert logs(record['result']['logs'])==logs(CONTROL['logs']), 'independent recovery structure'
    c=records[0]['census']; tests=c['bucketTests']+c['shelfTests']
    return {'scope':'one complete-board observer, three repeats; no timing or native safety claim','parity':True,'repeats':3,'census':c,'shelf_test_percent':100*c['shelfTests']/tests,'duplicate_visit_percent':100*c['duplicates']/c['visits'],'shelf_hit_percent':100*c['shelfHits']/c['shelfTests'],'mean_results_per_query':c['results']/c['queries']}
def source_check(audit,observer):
    baseline=json.loads((HERE.parent/'native-profile/source-hashes.json').read_text())
    assert len(audit)==1536 and set(audit)<=set(baseline), 'source inventory'
    assert all(v['original']==baseline[k] for k,v in audit.items()), 'independent source hashes'
    assert [k for k,v in audit.items() if v['original']!=v['observer']]==['src/lattice/grid.ts'], 'one observer module'
    assert hashlib.sha256(observer).hexdigest()==audit['src/lattice/grid.ts']['observer'], 'observer bytes'
if __name__=='__main__':
    manifest=json.loads((HERE/'manifest.json').read_text())
    for name,digest in manifest.items():
        assert hashlib.sha256((HERE/name).read_bytes()).hexdigest()==digest, 'archive digest: '+name
    source_check(json.loads((HERE/'source-audit.json').read_text()),gzip.decompress((HERE/'grid-observer.ts.gz').read_bytes()))
    records=json.loads(gzip.decompress((HERE/'records.json.gz').read_bytes()))
    summary=check(records)
    Path(sys.argv[1]).write_text(json.dumps(summary,indent=2)+'\n')
