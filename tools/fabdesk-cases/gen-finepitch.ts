#!/usr/bin/env bun
/**
 * Generate fine-pitch fanout SimpleRouteJson fixtures for fab_router, matching the geometry of the
 * fabdesk router-cases that the tscircuit capacity-autorouter fails on (docs/router-issues.md R1):
 * a 0.5 mm-pitch QFN and a 0.5 mm-pitch USB-C, each with 0603 fanout resistors on a common net set.
 *
 * Pure geometry from the standard KiCad footprints (public):
 *   QFN-28-1EP_5x5mm_P0.5mm — 7 pads/side, 0.5 mm pitch, pad ~0.28 x 0.60 mm, centre offset ~2.45 mm.
 *   R_0603_1608Metric       — two pads ~0.90 x 0.95 mm, centre-to-centre ~1.60 mm.
 *   USB-C 16-pin, 0.5 mm pitch — two rows of 8, pad ~0.30 x 1.20 mm.
 * No fabdesk / KiCad / reference-router contact; this only emits board data (SimpleRouteJson).
 *
 * Output: two .srj.json files under spec/acceptance/boards/ (data, like the other corpus boards).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SimpleRouteJson, SrjObstacle, SrjConnection } from "../../spec/types/srj.ts";

const F = "F.Cu", B = "B.Cu";
const rect = (net: string, cx: number, cy: number, w: number, h: number, layers = [F, B]): SrjObstacle =>
  ({ type: "rect", layers, center: { x: +cx.toFixed(4), y: +cy.toFixed(4) }, width: w, height: h, connectedTo: net ? [net] : [] });

/** A QFN-28 P0.5mm at the origin: 7 pads/side, returns pad centres in KiCad order (1..28, CCW from top-left). */
function qfnPads(pitch = 0.5, perSide = 7, off = 2.45, padLong = 0.6, padShort = 0.28) {
  const span = (perSide - 1) * pitch; // 3.0
  const half = span / 2;
  const pads: { n: number; x: number; y: number; w: number; h: number }[] = [];
  let n = 1;
  // left side: top->bottom, pads horizontal (long in x)
  for (let i = 0; i < perSide; i++) pads.push({ n: n++, x: -off, y: half - i * pitch, w: padLong, h: padShort });
  // bottom side: left->right, pads vertical (long in y)
  for (let i = 0; i < perSide; i++) pads.push({ n: n++, x: -half + i * pitch, y: -off, w: padShort, h: padLong });
  // right side: bottom->top
  for (let i = 0; i < perSide; i++) pads.push({ n: n++, x: off, y: -half + i * pitch, w: padLong, h: padShort });
  // top side: right->left
  for (let i = 0; i < perSide; i++) pads.push({ n: n++, x: half - i * pitch, y: off, w: padShort, h: padLong });
  return pads;
}

/** R_0603 at (cx,cy) rotated 0 (pads left/right) or 90 (up/down). Pad1 first. */
function r0603(cx: number, cy: number, rot: 0 | 90) {
  const g = 0.8; // pad centre from body centre
  const pw = 0.9, ph = 0.95;
  return rot === 0
    ? [{ x: cx - g, y: cy, w: pw, h: ph }, { x: cx + g, y: cy, w: pw, h: ph }]
    : [{ x: cx, y: cy - g, w: ph, h: pw }, { x: cx, y: cy + g, w: ph, h: pw }];
}

// ---------------------------------------------------------------- QFN fanout
function qfnFanout(): SimpleRouteJson {
  const obstacles: SrjObstacle[] = [];
  const connections: SrjConnection[] = [];
  const pads = qfnPads();
  // Fan every second pin (14 of 28) to a 0603 on a ring; common GND on 4 corners' neighbours.
  const ringR = 4.5;
  let ri = 0;
  for (let k = 0; k < pads.length; k += 2) {
    const p = pads[k]!;
    const net = `N${p.n}`;
    obstacles.push(rect(net, p.x, p.y, p.w, p.h));                // the QFN pad (this net)
    // place its 0603 radially outward
    const ang = Math.atan2(p.y, p.x);
    const cx = Math.cos(ang) * ringR, cy = Math.sin(ang) * ringR;
    const rot: 0 | 90 = Math.abs(Math.cos(ang)) > Math.abs(Math.sin(ang)) ? 0 : 90;
    const rp = r0603(cx, cy, rot);
    obstacles.push(rect(net, rp[0]!.x, rp[0]!.y, rp[0]!.w, rp[0]!.h));    // R pad1 (this net)
    obstacles.push(rect(`R${ri}_2`, rp[1]!.x, rp[1]!.y, rp[1]!.w, rp[1]!.h)); // R pad2 (other net, obstacle)
    connections.push({ name: net, pointsToConnect: [{ x: p.x, y: p.y }, { x: rp[0]!.x, y: rp[0]!.y }] });
    ri++;
  }
  // the odd (un-fanned) QFN pads are obstacles of their own nets
  for (let k = 1; k < pads.length; k += 2) { const p = pads[k]!; obstacles.push(rect(`Q${p.n}`, p.x, p.y, p.w, p.h)); }
  return { layerCount: 2, minTraceWidth: 0.15, bounds: { minX: -12.5, maxX: 12.5, minY: -12.5, maxY: 12.5 },
    obstacles, connections, minViaPadDiameter: 0.6, minViaHoleDiameter: 0.3 };
}

// ---------------------------------------------------------------- USB-C 0.5mm fanout
function usbcFanout(): SimpleRouteJson {
  const obstacles: SrjObstacle[] = [];
  const connections: SrjConnection[] = [];
  const pitch = 0.5, perRow = 8;
  const span = (perRow - 1) * pitch, half = span / 2;
  const rowY = 1.1; // two rows of 8, 0.5mm pitch, front/back of the connector
  let ci = 0;
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < perRow; i++) {
      const x = -half + i * pitch, y = row === 0 ? -rowY : rowY;
      const net = `U${row}_${i}`;
      obstacles.push(rect(net, x, y, 0.3, 1.2));
      // fan alternate pins to a 0603 above/below
      if (i % 2 === 0 && ci < 6) {
        const cy = y + (row === 0 ? -2.6 : 2.6);
        const rp = r0603(x, cy, 90);
        obstacles.push(rect(net, rp[0]!.x, rp[0]!.y, rp[0]!.w, rp[0]!.h));
        obstacles.push(rect(`RU${ci}_2`, rp[1]!.x, rp[1]!.y, rp[1]!.w, rp[1]!.h));
        connections.push({ name: net, pointsToConnect: [{ x, y }, { x: rp[0]!.x, y: rp[0]!.y }] });
        ci++;
      }
    }
  }
  return { layerCount: 2, minTraceWidth: 0.15, bounds: { minX: -12.5, maxX: 12.5, minY: -10, maxY: 10 },
    obstacles, connections, minViaPadDiameter: 0.6, minViaHoleDiameter: 0.3 };
}

const dir = resolve(import.meta.dir, "../../spec/acceptance/boards");
mkdirSync(dir, { recursive: true });
const header = (name: string, src: string) => ({ _generated: `fine-pitch fanout fixture for ${name}, generated from standard KiCad ${src} geometry (tools/fabdesk-cases/gen-finepitch.ts); board data only.` });
for (const [name, srj, src] of [["fabdesk-qfn28-fanout", qfnFanout(), "QFN-28-1EP_5x5mm_P0.5mm + R_0603"], ["fabdesk-usbc-fanout", usbcFanout(), "USB-C 0.5mm 16-pin + R_0603"]] as const) {
  writeFileSync(resolve(dir, `${name}.srj.json`), JSON.stringify({ ...header(name, src), ...srj }, null, 2) + "\n");
  console.log(`wrote ${name}.srj.json — ${srj.connections.length} nets, ${srj.obstacles.length} obstacles`);
}
