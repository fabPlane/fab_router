/**
 * Session writer, reader and canonical tree (spec/formats/ses.md).
 *
 *   - F-S2 / F-S20 / F-S21 / F-S22 / F-S30 / F-S31 on hand-built inputs and on corpus boards of
 *     three unit systems (KiCad um 10, Eagle mil 2540, LibrePCB mm 1000000 — the examples of F-S20);
 *   - F-S34 / F-S41 / F-S43 / F-S44: which items and PadForms are written, `(type protect)`, no
 *     locked or net-less items, `includeFileWiring: false`;
 *   - F-S50: `normaliseSes` equals the runner's own canonicaliser on every corpus board and is
 *     the identity on every expected tree;
 *   - F-S60 … F-S63: `applySes` replacement, diagnostics, units, Kinds;
 *   - the contract's round trip (RV-21 / F-S61): writeSes → applySes on a fresh readDsn gives the
 *     same Track and Barrel counts and the same DRC statistics on every readable corpus board.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { applySes, checkDrc, layoutStats, readDsn, writeSes } from "../src/api.ts";
import { formatRotation, normaliseSes, resolutionOf, sesName, ROUTER_ADDED } from "../src/ses/index.ts";
import { normaliseSession } from "../tools/acceptance/sexp.ts";

const ROOT = import.meta.dir + "/..";
const BOARDS = `${ROOT}/spec/acceptance/boards`;
const SES = `${ROOT}/spec/acceptance/ses`;

async function load(name: string) {
  const r = readDsn(await Bun.file(`${BOARDS}/${name}`).text(), { name });
  if (!r.ok) throw new Error(`readDsn failed on ${name}`);
  return r;
}

describe("writer clauses", () => {
  test("F-S30 identifier quoting", () => {
    const q = (s: string) => sesName(s, "\"");
    expect(q("J2")).toBe("J2");
    expect(q("Via[0-1]_800:400_um")).toBe("\"Via[0-1]_800:400_um\"");
    expect(q("Net-(R1-Pad1)")).toBe("\"Net-(R1-Pad1)\"");
    expect(q("+5V")).toBe("+5V");
    expect(q("1")).toBe("\"1\"");
    expect(q("Modules:ESP-01")).toBe("\"Modules:ESP-01\"");
    expect(q("")).toBe("\"\"");
    expect(q("-5V")).toBe("\"-5V\"");
    expect(q("a b")).toBe("\"a b\"");
    expect(q("~{WR}")).toBe("\"~{WR}\"");
    expect(q("Ünïcode")).toBe("\"Ünïcode\"");
    expect(q("say \"hi\"")).toBe("\"say hi\"");
    expect(sesName("it's", "'")).toBe("its");
  });

  test("F-S22 rotation", () => {
    expect(formatRotation(-90)).toBe("270");
    expect(formatRotation(338.5)).toBe("338.5");
    expect(formatRotation(180.0)).toBe("180");
    expect(formatRotation(360)).toBe("0");
    expect(formatRotation(12.34567)).toBe("12.346");
    expect(formatRotation(45.0001)).toBe("45");
  });

  test("F-S2 names and F-S20 coordinates on a KiCad board (um 10)", async () => {
    const r = await load("Issue026-J2_reference.dsn");
    const text = writeSes(r.layout);
    expect(text.startsWith("(session \"Issue026-J2_reference.ses\"\n  (base_design \"Issue026-J2_reference.dsn\")")).toBe(true);
    expect(text).toContain("(place J2 1352550 -857250 front 90)");
    expect(text).toContain("(resolution um 10)");
    expect(text).toContain("(host_cad \"KiCad's Pcbnew\")");
    expect(text.match(/\(resolution um 10\)/g)!.length).toBe(2);
    expect(text).toContain("(was_is)");
    expect(resolutionOf(r.layout)).toEqual({ unit: "um", perUnit: 10, perLu: 1 });
  });

  test("F-S20 on an Eagle board (mil 2540) and a LibrePCB board (mm 1000000, coarsened Frame)", async () => {
    const eagle = await load("Issue143-rpi_splitter.dsn");
    const res = resolutionOf(eagle.layout);
    expect(res.unit).toBe("mil");
    expect(res.perUnit).toBe(2540);
    expect(res.perLu).toBe(1);
    expect(Math.round(837.007874 * eagle.layout.frame.luPerUnit) * res.perLu).toBe(2126000);
    expect(writeSes(eagle.layout)).toContain("(place J1 1016000 127000 front 90)");
    const lp = await load("Issue676-ch32v-tx118s.dsn");
    const r2 = resolutionOf(lp.layout);
    expect(r2).toEqual({ unit: "mm", perUnit: 1000000, perLu: 10 });
    expect(writeSes(lp.layout)).toContain("(place J3 2540000 17145000 front 180)"); // 2.54 mm
    expect(Math.round(21.59 * lp.layout.frame.luPerUnit) * r2.perLu).toBe(21590000);
  });

  test("F-S31: no parser entries gives an empty (parser)", async () => {
    const r = await load("Issue313-FastTest.dsn");
    const tree = normaliseSes(writeSes(r.layout))!;
    const routes = tree[5] as unknown[];
    const parser = (routes as unknown[][]).find((x) => Array.isArray(x) && x[0] === "parser");
    expect(parser === undefined || (parser as unknown[]).length === 1).toBe(true);
    expect(writeSes(r.layout)).toContain("(parser)");
  });

  test("F-S40 … F-S44: what is written", async () => {
    const r = await load("Issue026-J2_reference.dsn");
    const L = r.layout;
    applySes(L, await Bun.file(`${BOARDS}/Issue026-J2_reference.ses`).text());
    const text = writeSes(L);
    expect(text.match(/\(wire/g)!.length).toBe(89);
    expect(text.match(/\(via /g)!.length).toBe(10);
    expect(text.match(/\(type protect\)/g)!.length).toBe(99); // every applied item is held
    expect(text).toContain("(via \"Via[0-1]_800:400_um\" 1156570 -920643 (type protect))");
    // locked and net-less items are never written; router-added items always are
    const mut = L as unknown as { tracks: typeof L.tracks; barrels: typeof L.barrels };
    mut.tracks = [
      ...L.tracks.map((t) => ({ ...t, hold: "locked" as const })),
      { id: 90001, net: null, sheet: 0, pts: [{ x: 0, y: 0 }, { x: 10000, y: 0 }], width: 2500, kind: 1, hold: "free" as const },
      { id: 90002, net: 0, sheet: 0, pts: [{ x: 0, y: 0 }, { x: 10000, y: 0 }], width: 2500, kind: 1, hold: "free" as const, origin: ROUTER_ADDED } as typeof L.tracks[number],
      { id: 90003, net: 0, sheet: 0, pts: [{ x: 5, y: 5 }, { x: 5, y: 5 }], width: 2500, kind: 1, hold: "free" as const },
    ];
    mut.barrels = L.barrels.map((b, i) => (i === 0 ? { ...b, hold: "free" as const } : { ...b, hold: "locked" as const }));
    const t2 = writeSes(L);
    expect(t2.match(/\(wire/g)!.length).toBe(1);
    expect(t2.match(/\(via /g)!.length).toBe(1);
    expect(t2).not.toContain("(type protect)");
    const t3 = writeSes(L, { includeFileWiring: false });
    expect(t3.match(/\(wire/g)!.length).toBe(1);
    expect(t3.match(/\(via /g) ?? []).toHaveLength(0);
  });

  test("F-S34: library_out lists the structure via list, use_via entries and written Barrels' PadForms once each", async () => {
    const r = await load("Issue015-StackOverflow.dsn");
    const tree = normaliseSes(writeSes(r.layout))!;
    const lib = (tree[5] as unknown[][]).find((x) => x[0] === "library_out") as unknown[];
    const names = lib.slice(1).map((p) => (p as unknown[])[1] as string);
    expect(new Set(names).size).toBe(names.length);
    expect(names.length).toBeGreaterThan(0);
    for (const p of lib.slice(1) as unknown[][]) {
      const shapes = p.filter((x) => Array.isArray(x) && x[0] === "shape");
      expect(shapes.length).toBeGreaterThan(0);
    }
  });
});

describe("canonical tree (F-S50)", () => {
  const boards = readdirSync(BOARDS).filter((f) => f.endsWith(".dsn")).sort();
  test("normaliseSes agrees with the acceptance runner's canonicaliser on every corpus board", async () => {
    let n = 0;
    for (const name of boards) {
      const r = readDsn(await Bun.file(`${BOARDS}/${name}`).text(), { name });
      if (!r.ok) continue;
      const text = writeSes(r.layout);
      expect(normaliseSes(text)).toEqual(normaliseSession(text));
      n++;
    }
    expect(n).toBeGreaterThan(140);
  });
  test("normaliseSes is the identity on every expected tree re-serialised as text", async () => {
    // Re-serialise a canonical tree as an s-expression and normalise it again.
    const ser = (x: unknown): string => {
      if (!Array.isArray(x)) return typeof x === "number" ? String(x) : `"${x}"`;
      if (x[0] === "parser") return `(parser ${x.slice(1).map((h) => `(${String(h)} x)`).join(" ")})`; // the tree keeps only the entry heads
      return `(${String(x[0])} ${x.slice(1).map(ser).join(" ")})`;
    };
    let n = 0;
    for (const f of readdirSync(SES).filter((x) => x.endsWith(".sexp.json"))) {
      const tree = JSON.parse(await Bun.file(`${SES}/${f}`).text()).tree;
      expect(normaliseSes(ser(tree))).toEqual(tree);
      n++;
    }
    expect(n).toBeGreaterThan(140);
  });
  test("no session head", () => {
    expect(normaliseSes("(pcb x)")).toBeNull();
    expect(normaliseSes("")).toBeNull();
  });
});

describe("applySes (F-S60 … F-S63)", () => {
  test("text without a session head is refused", async () => {
    const r = await load("Issue026-J2_reference.dsn");
    const a = applySes(r.layout, "(pcb nothing)");
    expect(a.ok).toBe(false);
    expect(a.diagnostics.some((d) => d.code === "session-missing")).toBe(true);
  });

  test("unknown nets, layers and padstacks are skipped with one diagnostic each; the rest applies", async () => {
    const r = await load("Issue026-J2_reference.dsn");
    const text = `(session x (routes (resolution um 10) (network_out
      (net GND (wire (path F.Cu 2500 0 0 10000 0)) (wire (path Nowhere 2500 0 0 10000 0)) (via Unknown 0 0) (via "Via[0-1]_800.0:400_um" 1000 1000 (type protect)))
      (net NoSuchNet (wire (path F.Cu 2500 0 0 10000 0))))))`;
    const a = applySes(r.layout, text);
    expect(a.ok).toBe(true);
    expect(a.applied).toEqual({ tracks: 1, barrels: 1 });
    expect(a.diagnostics.map((d) => d.code).sort()).toEqual(["layer-unknown", "net-unknown", "padstack-unknown"]);
    const t = r.layout.tracks[0]!, b = r.layout.barrels[0]!;
    expect(t).toMatchObject({ sheet: 0, width: 2500, hold: "held", pts: [{ x: 0, y: 0 }, { x: 10000, y: 0 }] });
    expect(b).toMatchObject({ at: { x: 1000, y: 1000 }, hold: "held", fromSheet: 0, toSheet: 1 });
    expect(t.net).toBe(r.layout.nets.find((n) => n.name === "GND")!.id);
    expect(t.kind).toBe(r.layout.netGroups.find((g) => g.id === r.layout.nets[t.net!]!.group)!.categoryKinds.track);
  });

  test("the session's resolution scales the coordinates; a missing one means the design file's", async () => {
    const r = await load("Issue026-J2_reference.dsn");
    applySes(r.layout, "(session x (routes (resolution mm 1000) (network_out (net GND (wire (path F.Cu 250 0 0 1000 0))))))");
    expect(r.layout.tracks[0]).toMatchObject({ width: 2500, pts: [{ x: 0, y: 0 }, { x: 10000, y: 0 }] });
    applySes(r.layout, "(session x (routes (network_out (net GND (wire (path F.Cu 2500 0 0 10000 0))))))");
    expect(r.layout.tracks.length).toBe(1);
    expect(r.layout.tracks[0]).toMatchObject({ width: 2500, pts: [{ x: 0, y: 0 }, { x: 10000, y: 0 }] });
  });

  test("F-S61: free and held items are replaced, locked ones stay", async () => {
    const r = await load("Issue753-CPU-85_r104.dsn"); // fix-only wiring
    const locked = r.layout.tracks.length;
    expect(locked).toBeGreaterThan(0);
    expect(r.layout.tracks.every((t) => t.hold === "locked")).toBe(true);
    const a = applySes(r.layout, "(session x (routes (network_out)))");
    expect(a.applied).toEqual({ tracks: 0, barrels: 0 });
    expect(r.layout.tracks.length).toBe(locked);
    const r2 = await load("Issue313-FastTest.dsn"); // protect wiring: held
    expect(r2.layout.tracks.every((t) => t.hold === "held")).toBe(true);
    applySes(r2.layout, "(session x (routes (network_out)))");
    expect(r2.layout.tracks.length).toBe(0);
    expect(r2.layout.barrels.length).toBe(0);
  });

  test("polygon wires become Pours, polyline_path wires become Tracks through their corners", async () => {
    const r = await load("Issue026-J2_reference.dsn");
    const a = applySes(r.layout, `(session x (routes (resolution um 10) (network_out (net GND
      (wire (polygon F.Cu 0 0 0 100000 0 100000 100000 0 100000) (window (polygon F.Cu 0 40000 40000 60000 40000 60000 60000 40000 60000)))
      (wire (polyline_path B.Cu 2500 0 0 1 0 100000 0 100000 1 100000 100000 100001 100000))))))`);
    expect(a.applied).toEqual({ tracks: 1, barrels: 0 });
    expect(r.layout.pours.length).toBe(1);
    expect(r.layout.pours[0]).toMatchObject({ hold: "held", holes: [[{ x: 40000, y: 40000 }, { x: 60000, y: 40000 }, { x: 60000, y: 60000 }, { x: 40000, y: 60000 }]] });
    expect(r.layout.tracks[0]!.pts).toEqual([{ x: 100000, y: 0 }, { x: 100000, y: 100000 }]);
  });
});

describe("round trip (contract RV-21 / F-S61)", () => {
  const boards = readdirSync(BOARDS).filter((f) => f.endsWith(".dsn")).sort();
  test("writeSes → applySes on a fresh readDsn reproduces counts and DRC statistics on every board", async () => {
    let n = 0;
    for (const name of boards) {
      const text = await Bun.file(`${BOARDS}/${name}`).text();
      const a = readDsn(text, { name }), b = readDsn(text, { name });
      if (!a.ok || !b.ok) continue;
      const ses = writeSes(a.layout);
      const applied = applySes(b.layout, ses);
      expect(applied.ok).toBe(true);
      expect(applied.diagnostics.filter((d) => d.level === "warning")).toEqual([]);
      const sa = layoutStats(a.layout), sb = layoutStats(b.layout);
      expect(sb.items.tracks).toBe(sa.items.tracks);
      expect(sb.items.barrels).toBe(sa.items.barrels);
      expect(sb.items.pours).toBe(sa.items.pours);
      expect(sb.connections).toEqual(sa.connections);
      expect(sb.violations).toEqual(sa.violations);
      expect(checkDrc(b.layout).counts).toEqual(checkDrc(a.layout).counts);
      expect(sb.tracks.totalLengthLu).toBeCloseTo(sa.tracks.totalLengthLu, 3);
      n++;
    }
    expect(n).toBeGreaterThan(140);
  });
});
