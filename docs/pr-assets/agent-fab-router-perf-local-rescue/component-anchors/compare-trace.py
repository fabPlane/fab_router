"""Verify ordinary point-target charged work is identical on actual L2 routing."""
from pathlib import Path
import json,sys
source,out=map(Path,sys.argv[1:]);assert not out.exists();rows=json.loads(source.read_text())['rows'];assert [r['mode']for r in rows]==['before','after']
a,b=rows;assert a['settings']==b['settings']and a['inputSha256']==b['inputSha256']
def targets(r):
 t=[json.loads(s.removeprefix('local-recovery result '))for s in r['logs']if s.startswith('local-recovery result ')]
 for x in t:x.pop('seconds',None)
 return t
old,new=map(targets,rows);assert len(old)==len(new)==16 and old==new
assert a['sesSha256']==b['sesSha256']and a['stats']==b['stats']
assert all(r['report']['incompleteAfter']==21 and not r['report']['timedOut']and r['report']['violationsAdded']==0 and r['stats']['violations']['total']==0 for r in rows)
out.write_text(json.dumps({'scope':'One L2 trace/source at original2pass/600s and recovery budgets, no native/timing claim','targets':16,'identical_targets_trials_proposals_expansions':True,'identical_statistics':True,'identical_session':True,'inputSha256':a['inputSha256']},indent=2)+'\n')
