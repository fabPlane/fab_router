from pathlib import Path
import json,sys
p=Path(sys.argv[1]);s=json.loads((p/'summary.json').read_text())['summary']
keys=[('passed','Passed / 78'),('valid_cases_3of3','Valid cases / 26'),('opens','Opens'),('new_errors','New native errors (known, unresolved)'),('median_s','Median route seconds'),('p95_s','p95 route seconds'),('total_s','Sum route seconds'),('wall_s','Sweep wall seconds'),('sum_case_medians_s','Sum case medians seconds'),('sum_case_p95_s','Sum case p95 seconds'),('vias','Sum vias'),('length_mm','Sum length mm')]
lines=['| Full native metric (26 cases × 3 repeats) | Current control | Allocation-free rim traversal |','|---|---:|---:|']
for k,label in keys:
 values=[s[m][k] for m in ('before','after')]
 text=[f'{v:.6f}' if isinstance(v,float) else str(v) for v in values]
 lines.append(f'| {label} | {text[0]} | {text[1]} |')
(p/'aggregate-table.md').write_text('\n'.join(lines)+'\n')
