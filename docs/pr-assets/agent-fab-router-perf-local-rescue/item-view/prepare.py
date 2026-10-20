from pathlib import Path
import sys
w=Path(sys.argv[1]);p=w/'candidate/src/lattice/grid.ts';s=p.read_text()
a='  itemOf(id: number): IndexedItem | undefined;';assert a in s
s=s.replace(a,a+'\n  /** Borrow a frozen category/item wrapper until remove/reinsert; item geometry remains live. */\n  itemViewOf(id: number): Readonly<IndexedItem> | undefined;')
a='const directory = new Map<number, IndexedItem & { cache: Map<number, readonly Shape[]> }>();';assert a in s
s=s.replace(a,'const directory = new Map<number, IndexedItem & { view: Readonly<IndexedItem>; cache: Map<number, readonly Shape[]> }>();')
a='directory.set(id, { cat, item, cache: new Map() });';assert a in s
s=s.replace(a,'directory.set(id, { cat, item, view: Object.freeze({ cat, item }), cache: new Map() });')
a='    shapesOf,\n';assert s.count(a)==1
s=s.replace(a,'    itemViewOf: (id) => directory.get(id)?.view,\n'+a)
p.write_text(s)
p=w/'candidate/src/route/clear.ts';s=p.read_text();a='const entry = lattice.itemOf(ref.id);';assert s.count(a)==1
p.write_text(s.replace(a,'const entry = lattice.itemViewOf(ref.id);'))
