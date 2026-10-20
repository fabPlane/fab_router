# Complete-board lattice census

Three observer repeats, one board; counters identical. No native rerun or speed comparison.

| Counter | Count per replay |
|---|---:|
| Queries | 42,711,408 |
| Cell lookups | 85,374,181 |
| Bucket slot visits | 348,572,028 |
| Duplicate visits skipped | 51,666,932 |
| Unique bucket overlap tests | 296,905,096 |
| Shelf overlap tests | 140,889,510 |
| Bucket overlap hits | 33,669,909 |
| Shelf overlap hits | 42,777,737 |
| Filter rejections | 416,892 |
| Returned references | 76,030,754 |

| Returned references per query | Query count |
|---|---:|
| 0 | 90 |
| 1 | 28,030,978 |
| 2-7 | 14,048,919 |
| 8-31 | 607,514 |
| 32-127 | 23,056 |
| 128+ | 851 |

Shelf share of tests: 32.1816%; shelf hit rate: 30.3626%; bucket duplicate visit rate: 14.8225%; mean returned references: 1.7801.

The histogram counts returned references after filters, before the unchanged sort. Missing sheets would be counted separately (none on this input).
