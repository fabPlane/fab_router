from pathlib import Path
import sys
w=Path(sys.argv[1]).resolve()
p=w/'candidate/src/lattice/grid.ts'
s=p.read_text()
s=s.replace('  function gridOf(sheet:', '''  // Experimental direct-mapped raw cache. Filtered requests retain original callback behavior.
  type Cached = { sheet: number; sweep: boolean; q: Dop8; refs: LatticeItemRef[] };
  const queries: (Cached | undefined)[] = new Array(256);
  const resetQueries = () => queries.fill(undefined);
  const copyRefs = (refs: LatticeItemRef[]) => refs.map(r => ({ ...r }));
  function cachedCollect(sheet: number, q: Dop8, sweep: boolean, filter: LatticeFilter | undefined): LatticeItemRef[] {
    if (filter) { resetQueries(); return collect(sheet, q, sweep, filter); }
    const k = (Math.imul(q.x0 | 0, 31) ^ Math.imul(q.y0 | 0, 131) ^ Math.imul(q.x1 | 0, 8191) ^ (q.y1 | 0) ^ sheet ^ (sweep ? 128 : 0)) & 255;
    const e = queries[k];
    if (e && e.sheet === sheet && e.sweep === sweep &&
        e.q.x0 === q.x0 && e.q.x1 === q.x1 && e.q.y0 === q.y0 && e.q.y1 === q.y1 &&
        (!sweep || (e.q.s0 === q.s0 && e.q.s1 === q.s1 && e.q.d0 === q.d0 && e.q.d1 === q.d1))) return copyRefs(e.refs);
    const refs = collect(sheet, q, sweep, undefined);
    queries[k] = { sheet, sweep, q: { ...q }, refs: copyRefs(refs) };
    return refs;
  }

  function gridOf(sheet:''')
for sig in ['function allocSlot(id: number, leg: number, sheet: number, b: Dop8): number {','function releaseSlot(slot: number): void {','function rebuild(size?: number): void {']:
 assert sig in s;s=s.replace(sig,sig+'\n    resetQueries();')
s=s.replace('=> collect(sheet,', '=> cachedCollect(sheet,')
p.write_text(s)
