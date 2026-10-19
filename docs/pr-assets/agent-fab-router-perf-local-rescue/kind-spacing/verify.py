"""Check runtime identity and all published artifact hashes from repo root."""
import hashlib,json
from pathlib import Path
root=Path(__file__).resolve().parent
for label, entries in [('runtime',json.loads((root/'source-audit.json').read_text())['files']),('artifacts',json.loads((root/'manifest.json').read_text()))]:
    for name,expected in entries.items():
        path=Path(name) if label=='runtime' else root/name
        assert hashlib.sha256(path.read_bytes()).hexdigest()==expected, name
    print(f'{label}: {len(entries)} hashes match')
