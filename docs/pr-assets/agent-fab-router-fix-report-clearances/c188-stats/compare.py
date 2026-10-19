"""Compare complete single-router suites without discarding failing attempts."""
import argparse, collections, hashlib, json, statistics
from pathlib import Path
p=argparse.ArgumentParser()
p.add_argument('--before',type=Path,required=True)
p.add_argument('--after',type=Path,required=True)
p.add_argument('--before-audit',type=Path,required=True)
p.add_argument('--after-audit',type=Path,required=True)
p.add_argument('--out',type=Path,required=True)
a=p.parse_args()
read=lambda path:json.loads(path.read_text())
key=lambda row:(row['case'],row['seed'])
arms=[]
for root,audit in [(a.before,a.before_audit),(a.after,a.after_audit)]:
    rows=read(root/'results.json'); controls=read(root/'controls.json')
    assert len(rows)==78 and len({key(r) for r in rows})==78
    assert len({r['case'] for r in rows})==26
    assert all(r['router']=='fab-router' and r['seed'] in (1,2,3) for r in rows)
    reports={key(r):read(root/r['evidence']/'work/router-summary.json')['result'] for r in rows}
    audits={key(r):r for r in read(audit)}
    assert set(audits)==set(reports)
    by_case=collections.defaultdict(list)
    for r in rows:by_case[r['case']].append(r)
    arms.append(dict(rows=rows,reports=reports,audits=audits,controls=controls,summary=dict(
        runs=len(rows),cases=len(by_case),passed=sum(r['passed'] for r in rows),
        valid_cases_3of3=sum(len(rs)==3 and all(r['passed'] for r in rs) for rs in by_case.values()),
        opens=sum(r['opens'] for r in rows),new_drc_errors=sum(r['new_errors'] for r in rows),
        median_route_s=statistics.median(r['seconds'] for r in rows),
        stats_before_mismatches=sum(r['before']['reported']!=r['before']['expected'] for r in audits.values()),
        stats_after_mismatches=sum(r['after']['reported']!=r['after']['expected'] for r in audits.values()))))
before,after=arms
assert before['controls']['allowed_cpus']==after['controls']['allowed_cpus']==list(range(20,26))
for field in ['inputs_sha256','harness_sha256','runtime_sha256','order']:
    assert before['controls'][field]==after['controls'][field],field
assert all(r[stage]['reported']==r[stage]['expected'] for r in after['audits'].values() for stage in ('before','after'))
by_key=[{key(r):r for r in arm['rows']} for arm in arms]
records=[]
for k in sorted(before['reports']):
    old,new=[arm['reports'][k] for arm in arms]
    assert old['ses']==new['ses'],k
    for field in ['status','passed','opens','new_errors','new_error_types','failed_fidelity','vias','length_mm']:
        assert by_key[0][k][field]==by_key[1][k][field],(k,field)
    old_report,new_report=[dict(r['report']) for r in [old,new]]
    for report in [old_report,new_report]:
        report.pop('wallClockMs')
    assert old_report==new_report,k
    for stage in ['statsBefore','statsAfter']:
        old_stats,new_stats=[dict(r[stage]) for r in [old,new]]
        old_stats.pop('violations');new_stats.pop('violations')
        assert old_stats==new_stats,(k,stage)
    records.append(dict(case=k[0],seed=k[1],passed=by_key[0][k]['passed'],
        opens=by_key[0][k]['opens'],new_errors=by_key[0][k]['new_errors'],
        ses_sha256=hashlib.sha256(old['ses'].encode()).hexdigest(),
        before_report=old['report']['violationsBefore'],after_report=new['report']['violationsBefore'],
        before_stats=before['audits'][k],after_stats=after['audits'][k],
        before_added=old['report']['violationsAdded'],after_added=new['report']['violationsAdded']))
out=dict(machine='hyper-ms-lin',repeats=3,before=before['summary'],after=after['summary'],
    identical_sessions=len(records),records=records,
    candidate_sources=[arm['controls']['candidate'] for arm in arms],
    note='Reporting correction only. Native thermal errors remain unresolved. No speed claim.')
a.out.write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({k:v for k,v in out.items() if k not in ('records','candidate_sources')},indent=2))
