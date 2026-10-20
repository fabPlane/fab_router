"""Independent archive replay and source-integrity rejection controls."""
from pathlib import Path
import ast,copy,gzip,hashlib,importlib.util,json,tempfile
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('report',HERE/'report.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def main():
    for name,digest in json.loads((HERE/'manifest.json').read_text()).items():
        assert hashlib.sha256((HERE/name).read_bytes()).hexdigest()==digest,name
    audit=json.loads((HERE/'source-audit.json').read_text());observer=gzip.decompress((HERE/'quilt-observer.ts.gz').read_bytes())
    m.source_check(audit,observer)
    records=json.loads(gzip.decompress((HERE/'records.json.gz').read_bytes()))
    with tempfile.TemporaryDirectory() as d:
        m.emit(records,Path(d))
        for name in ('summary.json','table.md','chart.svg'):
            assert (Path(d)/name).read_bytes()==(HERE/name).read_bytes(),name
    for name,mutate in [('inventory',lambda a:a.pop(next(iter(a)))),('original hash',lambda a:a['src/route/quilt.ts'].update(original='bad')),('other module',lambda a:a[next(k for k in a if k!='src/route/quilt.ts')].update(observer='bad'))]:
        altered=copy.deepcopy(audit);mutate(altered)
        try:m.source_check(altered,observer)
        except AssertionError:print('rejected',name)
        else:raise AssertionError('accepted '+name)
    try:m.source_check(audit,observer+b'\n')
    except AssertionError:print('rejected observer bytes')
    else:raise AssertionError('accepted observer bytes')
    for p in HERE.glob('*.py'):ast.parse(p.read_text())
    print('PASS: hashes, source integrity, independent complete-board parity, exact generated replay, four rejected source corruptions, Python syntax')
if __name__=='__main__':main()
