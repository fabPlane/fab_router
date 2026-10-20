"""Generate the exact rejected query-predicate experiment, refusing changed input."""
from pathlib import Path
import gzip, hashlib, sys

asset = Path(__file__).resolve().parent
def lift(source: Path):
    p = source / 'src/lattice/grid.ts'
    original = gzip.decompress((asset / 'original-grid.ts.gz').read_bytes())
    candidate = gzip.decompress((asset / 'candidate-grid.ts.gz').read_bytes())
    assert p.read_bytes() == original, 'unexpected original source'
    s = original.decode()
    a = s.index('    const test = (s: number): boolean => {', s.index('  function collect('))
    b = s.index('    const push =', a)
    body = s[a:b].replace('    const test = (s: number): boolean => {',
                         '  function intersectsSlot(s: number, q: Dop8, sweep: boolean): boolean {').replace('    };\n', '  }\n')
    s = s[:a] + s[b:]
    start = s.index('  function collect(')
    s = s[:start] + body + '\n' + s[start:]
    s = s.replace('if (test(s)) push(s);', 'if (intersectsSlot(s, q, sweep)) push(s);')
    assert s.encode() == candidate, 'candidate generator drift'
    p.write_bytes(candidate)
    print('Rejected candidate SHA256', hashlib.sha256(candidate).hexdigest())

if __name__ == '__main__':
    lift(Path(sys.argv[1]).resolve())
