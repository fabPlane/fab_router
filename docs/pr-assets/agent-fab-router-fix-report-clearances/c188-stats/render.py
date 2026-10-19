"""Render reporting accuracy and the unchanged native benchmark outcomes."""
import json, subprocess
from pathlib import Path
from xml.sax.saxutils import escape
here=Path(__file__).resolve().parent
z=json.loads((here/'comparison.json').read_text())
rows=[('Before-statistics mismatches',z['before']['stats_before_mismatches'],z['after']['stats_before_mismatches']),
      ('After-statistics mismatches',z['before']['stats_after_mismatches'],z['after']['stats_after_mismatches']),
      ('Clearance regressions passing',0,4),
      ('Native passing runs',z['before']['passed'],z['after']['passed']),
      ('Cases passing 3/3',z['before']['valid_cases_3of3'],z['after']['valid_cases_3of3']),
      ('Native opens',z['before']['opens'],z['after']['opens']),
      ('New native DRC errors',z['before']['new_drc_errors'],z['after']['new_drc_errors'])]
s=['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="740" viewBox="0 0 1200 740">',
   '<rect width="1200" height="740" fill="#f4f7fb"/>',
   '<g font-family="sans-serif" fill="#16243a">',
   '<text x="60" y="65" font-size="31" font-weight="bold">Use the route rules for snapshot statistics</text>',
   '<text x="60" y="105" font-size="20">26 frozen cases × 3 seeds · same host and cores · identical returned sessions</text>',
   '<text x="760" y="164" font-size="22" font-weight="bold">Before</text>',
   '<text x="980" y="164" font-size="22" font-weight="bold">After</text>']
for i,(label,before,after) in enumerate(rows):
 y=218+i*57
 s.extend([f'<rect x="45" y="{y-34}" width="1110" height="49" rx="8" fill="{"#ffffff" if i%2==0 else "#e8eef6"}"/>',
 f'<text x="65" y="{y}" font-size="23">{escape(label)}</text>',
 f'<text x="790" y="{y}" text-anchor="middle" font-size="26">{before}</text>',
 f'<text x="1015" y="{y}" text-anchor="middle" font-size="26" fill="{"#146c43" if after!=before else "#16243a"}">{after}</text>'])
s.extend(['<text x="60" y="665" font-size="21">Reporting correction only: native thermal failures remain unresolved.</text>',
          '<text x="60" y="700" font-size="18">Both snapshots checked against direct DRC with each run’s effective settings. No speed claim.</text>',
          '</g></svg>'])
(here/'comparison.svg').write_text('\n'.join(s)+'\n')
subprocess.run(['rsvg-convert','-w','1600',str(here/'comparison.svg'),'-o',str(here/'comparison.png')],check=True)
