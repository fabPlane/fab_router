#!/usr/bin/python3
"""Render measured local detour coverage and native outcomes."""
import gzip
import html
import json
from pathlib import Path
import subprocess
import sys
root=Path(sys.argv[1])
def load(path):
    return json.loads(path.read_bytes() if path.exists() else gzip.decompress(Path(str(path)+'.gz').read_bytes()))
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1160" height="570"><rect width="1160" height="570" fill="white"/>']
def text(x,y,s,size=20):svg.append(f'<text x="{x}" y="{y}" font-family="sans-serif" font-size="{size}">{html.escape(str(s))}</text>')
text(30,44,'Endpoint-preserving local detours: native thermal diagnostic',27)
text(30,80,'Composed full board; two nearest tracks; three repeats on the same host',19)
for idx,(name,label) in enumerate((('u153','U1.53'),('u148','U1.48'))):
    s=load(root/name/'summary.json');r=s['rows'][0]; y=135+idx*175
    text(30,y,label,24)
    text(30,y+32,f'Per repeat: {len(r["attempts"])} checked; {len(r["skipped"])} endpoint/length skips',20)
    text(30,y+62,f'Accepted: {sum(x["accepted"] for x in s["rows"])}/3 searches',20)
    vals=[len(x['row']['errors']) for x in r['attempts'] if x['row']]
    text(30,y+92,f'Candidate native errors: {min(vals)}–{max(vals)}' if vals else 'No eligible interior interval',19)
    text(30,y+122,f'Selected board: {len(r["baseline"]["errors"])} errors; {r["baseline"]["opens"]} opens (unchanged)' if not r['accepted'] else 'Selected a validated repair',19)
text(30,523,'Diagnostic only. No production repair or routing benchmark improvement claimed.',20)
svg.append('</svg>');(root/'comparison.svg').write_text('\n'.join(svg)+'\n')
subprocess.run(['rsvg-convert','-w','1600',str(root/'comparison.svg'),'-o',str(root/'comparison.png')],check=True)
