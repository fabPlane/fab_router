"""Exercise preservation checks with corrupt session/report/log controls."""
from pathlib import Path
import gzip, json, shutil, subprocess, sys, tempfile

a = Path(__file__).resolve().parent
with tempfile.TemporaryDirectory(prefix='predicate-controls-') as tmp:
    out = Path(tmp)
    for mutation in ['session', 'report', 'log']:
        p = out / mutation
        shutil.copytree(a, p)
        if mutation == 'session':
            f = p / '1-candidate/board.ses.gz'
            f.write_bytes(gzip.compress(gzip.decompress(f.read_bytes()) + b'\n', mtime=0))
        else:
            f = p / 'aquarius-records.json.gz'
            rows = json.loads(gzip.decompress(f.read_bytes()))
            r = rows[0]
            if mutation == 'report':
                r['report']['incompleteAfter'] += 1
            else:
                index = next(i for i, s in enumerate(r['logs']) if s.startswith('local-recovery result '))
                prefix = 'local-recovery result '
                log = json.loads(r['logs'][index][len(prefix):])
                log['pair']['net'] += 1
                r['logs'][index] = prefix + json.dumps(log)
            f.write_bytes(gzip.compress(json.dumps(rows).encode(), mtime=0))
            # Keep duplicate raw metadata consistent so rejection requires the parity check.
            f = p / f"aquarius-{r['pair']}-{r['mode']}.jsonl.gz"
            f.write_bytes(gzip.compress(json.dumps({k: v for k, v in r.items() if k not in ['pair', 'mode']}).encode(), mtime=0))
        result = subprocess.run([sys.executable, a / 'verify.py', p], capture_output=True)
        assert result.returncode != 0, mutation
    source = out / 'source/src/lattice'
    source.mkdir(parents=True)
    (source / 'grid.ts').write_bytes(gzip.decompress((a / 'original-grid.ts.gz').read_bytes()))
    subprocess.run([sys.executable, a / 'lift.py', source.parent.parent], check=True)
    before = (source / 'grid.ts').read_bytes()
    assert subprocess.run([sys.executable, a / 'lift.py', source.parent.parent], capture_output=True).returncode != 0
    assert (source / 'grid.ts').read_bytes() == before
print('PASS three corrupt controls refused; exact generator and overwrite guard')
