"""Render measured no-via outcomes; no timing or native safety inference."""
import json
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parent
data = json.loads((root / 'comparison.json').read_text())
pairs = json.loads((root / 'pairs-comparison.json').read_text())
svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="530" viewBox="0 0 1100 530">',
       '<rect width="1100" height="530" fill="#142030"/><g font-family="sans-serif" fill="#e8eff8">',
       '<text x="40" y="48" font-size="27">No-via board: stale-entry budget fix leaves outcomes unchanged</text>',
       '<text x="40" y="82" font-size="18">Same input, settings, seed and six cores; three repeats per source</text>']
for i, variant in enumerate(('before', 'after')):
    rows = [r for r in data['runs'] if r['variant'] == variant]
    counts = [r['report']['cases'][0]['measured']['incomplete'] for r in rows]
    isolated = [sum(x['connected'] for x in r['attempts']) for r in pairs['runs'] if r['variant'] == variant]
    assert counts == [12] * 3 and isolated == [0] * 3
    y = 155 + i * 120
    label = 'Original' if i == 0 else 'Candidate'
    svg.extend([f'<text x="40" y="{y}" font-size="22">{label}</text>',
        f'<rect x="235" y="{y-28}" width="600" height="40" fill="#e6a275"/>',
        f'<text x="855" y="{y}" font-size="23">12 opens</text>',
        f'<text x="235" y="{y+42}" font-size="18">0/3 acceptance passes · isolated capped pairs connected: 0/5 each repeat</text>'])
svg.extend(['<path d="M535 106V324" stroke="#bfe5dc" stroke-width="3" stroke-dasharray="7 5"/>',
    '<text x="450" y="358" font-size="18" fill="#bfe5dc">Existing limit: 6 opens</text>',
    '<text x="40" y="415" font-size="19">Both versions: zero added engine DRC violations; zero added vias; retained copper preserved.</text>',
    '<text x="40" y="452" font-size="18">Engine-only measurements. Native refill safety and the no-via completion failure remain unresolved.</text>',
    '<text x="40" y="488" font-size="17">The synthetic grid improvement does not establish a completion gain on this board.</text></g></svg>'])
(root / 'outcomes.svg').write_text(''.join(svg))
subprocess.run(['rsvg-convert', '-w', '1600', str(root / 'outcomes.svg'), '-o', str(root / 'outcomes.png')], check=True)
