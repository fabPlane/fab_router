"""Compare all six complete larger-input sessions without treating them as native scores."""
from pathlib import Path
import json,sys
source,out=map(Path,sys.argv[1:]);assert not out.exists();data=json.loads(source.read_text());rows=data['rows'];assert len(rows)==6
pairs=[]
for file in sorted({r['file']for r in rows}):
 a,b=[next(r for r in rows if r['file']==file and r['mode']==mode)for mode in ['before','after']]
 assert a['settings']==b['settings']and a['inputSha256']==b['inputSha256']
 for r in [a,b]:assert not r['report']['timedOut']and not r['report']['aborted']and r['report']['violationsAdded']==0 and r['stats']['violations']['total']==0
 assert a['stats']==b['stats']and a['sesSha256']==b['sesSha256']
 pairs.append({'file':Path(file).name,'inputSha256':a['inputSha256'],'sameSes':True,'stats':a['stats'],'before_s':a['seconds'],'after_s':b['seconds'],'settings':a['settings']})
out.write_text(json.dumps({'scope':'One exploratory pair/input; engine-only, not native; same full statistics and SES; no speed claim','pairs':pairs},indent=2)+'\n')
