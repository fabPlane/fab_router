from pathlib import Path
import json,sys
s=json.loads(Path(sys.argv[1]).read_text());c=s['census']
rows=[('Queries',c['queries']),('Cell lookups',c['cells']),('Bucket slot visits',c['visits']),('Duplicate visits skipped',c['duplicates']),('Unique bucket overlap tests',c['bucketTests']),('Shelf overlap tests',c['shelfTests']),('Bucket overlap hits',c['bucketHits']),('Shelf overlap hits',c['shelfHits']),('Filter rejections',c['filterRejected']),('Returned references',c['results'])]
text=['# Complete-board lattice census','', 'Three observer repeats, one board; counters identical. No native rerun or speed comparison.','', '| Counter | Count per replay |','|---|---:|']
text += [f'| {label} | {value:,} |' for label,value in rows]
text += ['', '| Returned references per query | Query count |', '|---|---:|']
text += [f'| {key} | {c["histogram"].get(key,0):,} |' for key in ['0','1','2-7','8-31','32-127','128+']]
text += ['',f'Shelf share of tests: {s["shelf_test_percent"]:.4f}%; shelf hit rate: {s["shelf_hit_percent"]:.4f}%; bucket duplicate visit rate: {s["duplicate_visit_percent"]:.4f}%; mean returned references: {s["mean_results_per_query"]:.4f}.', '', 'The histogram counts returned references after filters, before the unchanged sort. Missing sheets would be counted separately (none on this input).', '']
Path(sys.argv[2]).write_text('\n'.join(text))
