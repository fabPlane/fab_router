"""Validate paired saved-session invariance and summarize full native timings."""
from pathlib import Path
from statistics import median
import gzip,json,math,sys
here=Path(__file__).resolve().parent

def clean(x):
 if isinstance(x,dict):return {k:clean(v)for k,v in x.items()if k!='seconds'}
 if isinstance(x,list):return [clean(v)for v in x]
 return x

def saved_report(data):
 reference=json.loads(gzip.decompress((here/'../deferred-kind-spacing/results.json.gz').read_bytes()))['before'][0]
 assert set(data)=={'before','after'}
 for mode in data:
  assert len(data[mode])==3
  for run in data[mode]:
   assert clean(run)==clean(reference),'Archived coordinator drift'
   assert clean(run)==clean(data['before'][0]),'Coordinator drift'
   r=run['rows'][0];assert len(run['rows'])==1 and r['before']==r['after']==4
   assert r['rewind']and not r['changed']and r['copperBefore']==r['copperAfter']
   assert len(r['attempts'])==4 and sum(a['result']['work']for a in r['attempts'])==279946
   assert all(a['exact']==0 and a['result']['status']=='exhausted'for a in r['attempts'])
 return {mode:{'repeats':3,'median_s':median(sum(a['result']['seconds']for r in run['rows']for a in r['attempts'])for run in runs),'p95_s':max(sum(a['result']['seconds']for r in run['rows']for a in r['attempts'])for run in runs)}for mode,runs in data.items()}

def report(native,saved,out):
 assert len(native['attempts'])==78 and len({r['case']for r in native['attempts']})==26
 assert not native['regressions'],'Native regression'
 assert native['same_sessions']==78,'Copper changed'
 for key in ['passed','opens','new_errors','vias','length_mm','valid_cases_3of3']:
  assert native['summary']['before'][key]==native['summary']['after'][key],key
 saved=saved_report(saved)
 rows=[]
 for case in sorted({r['case']for r in native['attempts']}):
  runs=[r for r in native['attempts']if r['case']==case];assert len(runs)==3
  row={'case':case}
  for mode in ['before','after']:
   row[mode]={'median_s':median(r[mode]['seconds']for r in runs),'p95_s':max(r[mode]['seconds']for r in runs),'total_s':sum(r[mode]['seconds']for r in runs),'passed':sum(r[mode]['passed']for r in runs),'opens':sum(r[mode]['opens']for r in runs),'new_errors':sum(r[mode]['new_errors']for r in runs)}
  rows.append(row)
 for mode in ['before','after']:
  native['summary'][mode]['sum_case_medians_s']=sum(r[mode]['median_s']for r in rows)
  native['summary'][mode]['sum_case_p95_s']=sum(r[mode]['p95_s']for r in rows)
 out.mkdir(parents=True,exist_ok=True)
 (out/'summary.json').write_text(json.dumps({'native':native['summary'],'same_sessions':78,'saved':saved,'cases':rows,'adopted':False,'suite_speed_nonregression':all(native['summary']['after'][k]<=native['summary']['before'][k]for k in ['median_s','total_s'])},indent=2)+'\n')
 table='| Case (3 repeats) | Median s before | after | p95 s before | after | Passed before/after | Opens before/after | New errors before/after |\n|---|---:|---:|---:|---:|---:|---:|---:|\n'
 for r in rows:
  a,b=r['before'],r['after'];table+=f"| {r['case']} | {a['median_s']:.4f} | {b['median_s']:.4f} | {a['p95_s']:.4f} | {b['p95_s']:.4f} | {a['passed']}/{b['passed']} | {a['opens']}/{b['opens']} | {a['new_errors']}/{b['new_errors']} |\n"
 (out/'table.md').write_text(table)
 svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="1150"><rect width="100%" height="100%" fill="white"/><g font-family="sans-serif" fill="#20313d"><text x="35" y="40" font-size="26">REJECTED negative shaping cache: full native 26 × 3 comparison</text><text x="35" y="75" font-size="19">Identical sessions in all 78 pairs; same completion, opens, errors and geometry.</text><text x="35" y="105" font-size="18">Shared host, sequential sweeps. Bars show per-case median route seconds.</text>']
 maximum=max(r[m]['median_s']for r in rows for m in ['before','after'])
 for i,r in enumerate(rows):
  y=135+i*35
  svg.append(f'<text x="35" y="{y+16}" font-size="16">{r["case"]}</text>')
  for j,(mode,color)in enumerate([('before','#87939b'),('after','#217e93')]):
   v=r[mode]['median_s'];svg.append(f'<rect x="525" y="{y+j*13}" width="{v/maximum*760:.3f}" height="11" fill="{color}"/>')
  svg.append(f'<text x="1310" y="{y+18}" font-size="15">{r["before"]["median_s"]:.3f} / {r["after"]["median_s"]:.3f}</text>')
 svg.append('<text x="35" y="1090" font-size="19">Gray: uncached. Blue: failed-edge cache. Median / total regress; no production adoption.</text></g></svg>')
 (out/'timings.svg').write_text(''.join(svg)+'\n')
 return {'native':native['summary'],'saved':saved}

if __name__=='__main__':
 native=json.loads(Path(sys.argv[1]).read_text());saved=json.loads(gzip.decompress(Path(sys.argv[2]).read_bytes()))
 print(json.dumps(report(native,saved,Path(sys.argv[3]))))
