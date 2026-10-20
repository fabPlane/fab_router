import json,pathlib,sys,subprocess
root=pathlib.Path(sys.argv[1]);before=pathlib.Path(sys.argv[2]);repo=pathlib.Path(sys.argv[3])
a=json.loads((before/'results.json').read_text());b=json.loads((root/'full-router/results.json').read_text())
key=lambda r:(r['case'],r['seed'])
a={key(r):r for r in a};b={key(r):r for r in b}
assert a.keys()==b.keys() and len(b)==78
fields=['status','passed','opens','new_errors','new_error_types','failed_fidelity']
for k in a:
 for f in fields:assert a[k][f]==b[k][f],(k,f,a[k][f],b[k][f])
controls_a=json.loads((before/'controls.json').read_text());controls_b=json.loads((root/'full-router/controls.json').read_text())
for field in ['inputs_sha256','configs_sha256','harness_sha256','runtime_sha256','runtime_source_sha256','seeds','allowed_cpus']:assert controls_a[field]==controls_b[field],field
assert controls_a['candidate']['source_sha256']==controls_b['candidate']['source_sha256']
assert subprocess.check_output(['git','diff','69cf598','--','src'],cwd=repo)==b''
s=json.loads((root/'full-router/summary.json').read_text());assert s['complete'] and s['controls_preserved'] and s['completed_runs']==78
out=dict(cases=26,runs=78,passed=sum(r['passed'] for r in b.values()),valid_cases_3of3=sum(all(r['passed'] for k,r in b.items() if k[0]==c) for c in {k[0] for k in b}),opens=sum(r['opens'] for r in b.values()),new_errors=sum(r['new_errors'] for r in b.values()),all_78_outcomes_equal=True,engine_source_equal_to_before=True,before_source='69cf598',router_invokes_search=False)
(root/'router-comparison.json').write_text(json.dumps(out,indent=2)+'\n');print(out)
