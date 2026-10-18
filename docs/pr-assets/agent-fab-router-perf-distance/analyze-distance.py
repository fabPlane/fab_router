"""Validate trace/session identity and summarize diagnostic allocation counts.
TRACE_JSON PROFILE_LOG PROFILE_DIRECTORY NEW_OUTPUT_JSON
"""
from collections import Counter
from pathlib import Path
import hashlib, json, sys, subprocess
trace_path, log_path, profiles_path, output = map(Path, sys.argv[1:])
if output.exists():
    raise SystemExit('Output already exists')
trace = json.loads(trace_path.read_text())
assert trace['dist2Calls'] == 0, 'Reassess wrapper usage before interpreting this experiment'
assert trace['coreCalls'] == sum(v['calls'] for v in trace['kinds'].values())
assert sum(trace['sampledCallers'].values()) == trace['coreCalls'] // 4096
assert all(len(v['samples']) == min(64,v['calls']) for v in trace['kinds'].values())
routes = [json.loads(line) for line in log_path.read_text().splitlines() if line.startswith('{')]
assert len(routes) == 3
assert all(r['input_sha256'] == trace['input_sha256'] and r['settings'] == trace['settings'] for r in routes), 'Profile input/settings differ'
baseline_distance = subprocess.check_output(['git','-C',str(Path(__file__).resolve().parents[3]),'show',trace['instrumentation']['revision']+':src/geom/distance.ts'])
assert all(r['distance_sha256'] == hashlib.sha256(baseline_distance).hexdigest() for r in routes), 'Profile distance source differs'
assert not trace['report']['timedOut'] and all(not r['report']['timedOut'] for r in routes), 'Incomplete timed run'
assert all(r['ses_sha256'] == trace['ses_sha256'] for r in routes), 'Instrumentation changed session'
profiles = []
for path in sorted(profiles_path.glob('*.cpuprofile')):
    data = json.loads(path.read_text())
    frames = {n['id']: n['callFrame'] for n in data['nodes']}
    counts = Counter((frames[i]['functionName'],frames[i]['url']) for i in data['samples'])
    profiles.append({'file':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
                     'samples':len(data['samples']),
                     'geometry_self':[{'function':name,'url':url,'samples':count}
                                      for (name,url),count in counts.most_common() if '/geom/' in url]})
assert len(profiles) == 1, 'Expected one process with three routes'
# Paths are provenance, but collapse instrumented archive prefix for readable caller names.
callers = {key.split('/src/')[-1].rstrip(')'):value for key,value in trace['sampledCallers'].items()}
result = {'trace_sha256':hashlib.sha256(trace_path.read_bytes()).hexdigest(),
          'instrumentation':trace['instrumentation'],'started_utc':trace['started_utc'],
          'finished_utc':trace['finished_utc'],'bun':trace['bun'],
          'input_sha256':trace['input_sha256'],'ses_sha256':trace['ses_sha256'],
          'dist2_calls':trace['dist2Calls'],'core_calls':trace['coreCalls'],
          'kinds':{key:value['calls'] for key,value in trace['kinds'].items()},
          'systematic_caller_samples':callers,'caller_sample_stride':4096,
          'routes':routes,'profiles':profiles}
output.write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'core_calls':result['core_calls'],'kinds':result['kinds'],'callers':callers}))
