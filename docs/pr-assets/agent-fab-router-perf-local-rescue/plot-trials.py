import json,sys
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
rows=json.loads(Path(sys.argv[1]).read_text())
endpoints=json.loads(Path(sys.argv[2]).read_text())['rows']
bykey={(r['case'],r['key']):r for r in endpoints}
fig,axes=plt.subplots(1,2,figsize=(14,6))
labels=[r['case'].split('-')[0]+' '+r['net'] for r in rows];y=list(range(len(rows)))
a,b=axes
failed=[r['owner_net']['rejected'] for r in rows];ok=[r['owner_net']['legalised'] for r in rows]
a.barh(y,failed,label='Rejected owner-net trail');a.barh(y,ok,left=failed,label='Legalised owner-net partial trail')
a.set_yticks(y,labels);a.invert_yaxis();a.set_xlabel('Observed trail calls (one replay per board)');a.legend(loc='lower right')
a.set_title('Every trial uses its owning residual net')
original=[bykey[(r['case'],r['key'])]['counts']['original_endpoint_segment'] for r in rows]
other=[bykey[(r['case'],r['key'])]['counts']['other_trial_endpoint_segment'] for r in rows]
inside=[r['owner_net']['failed_variant_interior_segments'] for r in rows]
b.barh(y,original,label='Original pad/barrel endpoint');b.barh(y,other,left=original,label='Other trial endpoint')
b.barh(y,inside,left=[a+b for a,b in zip(original,other)],label='Interior segment')
b.set_yticks(y,labels);b.invert_yaxis();b.set_xlabel('First blocked segment per failed shaping variant');b.legend(loc='lower right')
b.set_title('Failed trail ends include proposed intermediate sites')
fig.suptitle('Nine residual connections remain open; all three sessions unchanged\nLegalised partial trials are enclosed by failed via-routing attempts')
fig.tight_layout();fig.savefig(sys.argv[3],dpi=150)
