from pathlib import Path
import sys
w=Path(sys.argv[1]); p=w/'candidate/src/lattice/grid.ts';s=p.read_text()
s=s.replace('export interface IndexedItem { cat: ItemCat; item: LatticeItem }','export interface IndexedItem { cat: ItemCat; item: LatticeItem; drill?: DrillDisk | undefined }')
a='    directory.set(id, { cat, item, cache: new Map() });'
b='''    // Prepared geometry shares the existing remove/reinsert invalidation boundary.
    const drill = cat === "pad" ? drillOfPad(layout, item as Pad)
      : cat === "barrel" ? drillOfBarrel(layout, item as Barrel) : undefined;
    directory.set(id, { cat, item, drill, cache: new Map() });'''
assert a in s;s=s.replace(a,b)
s=s.replace('padBoundsOn(layout, pad, sheet), drillOfPad(layout, pad)', 'padBoundsOn(layout, pad, sheet), drill')
s=s.replace('barrelBoundsOn(layout, barrel, sheet), drillOfBarrel(layout, barrel)', 'barrelBoundsOn(layout, barrel, sheet), drill')
s=s.replace('return e ? { cat: e.cat, item: e.item } : undefined;', 'return e ? { cat: e.cat, item: e.item, drill: e.drill } : undefined;')
p.write_text(s)
p=w/'candidate/src/route/clear.ts';s=p.read_text()
a='const pd = drillOfPad(layout, pad);';assert a in s;s=s.replace(a,'const pd = entry.drill;')
a='const drill = entry.cat === "pad" ? drillOfPad(layout, item as Pad) : entry.cat === "barrel" ? drillOfBarrel(layout, item as Barrel) : undefined;';assert a in s;s=s.replace(a,'const drill = entry.drill;')
p.write_text(s)
