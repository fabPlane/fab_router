import json, statistics, subprocess
from pathlib import Path
p=Path(__file__).resolve().parent
before=json.loads((p/'before.json').read_text()); after=json.loads((p/'after.json').read_text())
assert len(before)==len(after)==3
assert all(r['report']['effectiveSettings'].get('extendedSearchBudget') is True for r in after)
assert all(not r['report']['effectiveSettings'].get('extendedSearchBudget',False) for r in before)
for runs,opens in [(before,5),(after,2)]:
 assert all(r['counts']=={'violations':0,'incompletes':opens} and not r['report']['timedOut'] for r in runs)
for label in ['before','after']:
 runs=json.loads((p/('native-'+label+'.json')).read_text())
 assert len(runs)==3 and all(r['passed'] and r['opens']==0 and r['new_errors']==0 for r in runs)
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="470"><rect width="1100" height="470" fill="white"/><g font-family="sans-serif" fill="#222"><text x="45" y="50" font-size="27">Bounded search budget: L1 connector routing</text><text x="45" y="90">Same input and machine; three repeats each; no instrumentation</text>']
for i,(label,runs,color) in enumerate([('Original budgets',before,'#64748b'),('Extended enabled',after,'#2563eb')]):
 y=145+i*105; count=runs[0]['counts']['incompletes']; sec=statistics.median(r['report']['wallClockMs']/1000 for r in runs)
 svg.extend([f'<text x="45" y="{y+24}">{label}</text>',f'<rect x="250" y="{y}" width="{count*100}" height="40" fill="{color}"/>',f'<text x="780" y="{y+25}">{count} opens; {sec:.3f} s median</text>'])
svg+=['<text x="45" y="390">Zero internal spacing violations; two connections remain incomplete.</text><text x="45" y="430">Native solenoid case: both pass 3/3; candidate wire length rises 1.7%.</text></g></svg>']
(p/'budgets.svg').write_text('\n'.join(svg));subprocess.run(['rsvg-convert','-w','1600',str(p/'budgets.svg'),'-o',str(p/'budgets.png')],check=True)
