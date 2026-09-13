/**
 * Frame construction and file-unit ↔ LU conversion (docs/DESIGN.md §1, spec/formats/dsn.md
 * F-40 … F-43, spec/rules/clearance.md C-04). The layout unit is 1/perUnit of the file unit,
 * coarsened by ten while the largest absolute coordinate in LU is ≥ 2^25 / 5, and never finer
 * than 1 nm. Coordinates round to the nearest LU (halves toward +∞); spacings round to nearest
 * then up to the next even LU; widths round their half to the nearest LU and double it.
 *
 * Public surface: makeFrame, toLu, spacingLu, widthLu, halfWidthLu, fromLu, UM_PER_UNIT.
 */
import type { Frame } from "../../spec/types/layout.ts";
import type { DimensionUnit } from "../../spec/types/dsn.ts";

export const UM_PER_UNIT: Record<DimensionUnit, number> = { inch: 25400, mil: 25.4, cm: 10000, mm: 1000, um: 1 };

const COARSEN_LIMIT = 2 ** 25 / 5;

/**
 * Choose the Frame for a file with `resolution` (unit, perUnit) and coordinate unit `unit`, given
 * the largest absolute coordinate (in file units) the board contains.
 */
export function makeFrame(resolutionUnit: DimensionUnit, perUnit: number, unit: DimensionUnit, maxAbsCoord: number): Frame {
  // LU per coordinate unit: perUnit resolution steps per resolution unit, scaled by unit ratio.
  let luPerUnit = perUnit * (UM_PER_UNIT[unit] / UM_PER_UNIT[resolutionUnit]);
  // Never finer than 1 nm (1000 LU per µm).
  const luPerUmRaw = luPerUnit / UM_PER_UNIT[unit];
  if (luPerUmRaw > 1000) luPerUnit = luPerUnit * (1000 / luPerUmRaw);
  while (maxAbsCoord * luPerUnit >= COARSEN_LIMIT && luPerUnit > 1e-9) luPerUnit /= 10;
  return { luPerUnit, offset: { x: 0, y: 0 }, fileUnit: unit, luPerUm: luPerUnit / UM_PER_UNIT[unit] };
}

/** Round half toward +∞ (plain Math.round: the summaries were recorded with plain float64 products). */
function roundHalfUp(p: number): number {
  const r = Math.round(p);
  return r === 0 ? 0 : r;
}

/** A file coordinate or length to LU (nearest, halves toward +∞). */
export function toLu(frame: Frame, v: number): number {
  return roundHalfUp(v * frame.luPerUnit);
}

/** C-04: a spacing value to LU — nearest, then up to the next even integer; negatives clamp to 0. */
export function spacingLu(frame: Frame, v: number): number {
  let r = roundHalfUp(v * frame.luPerUnit);
  if (r < 0) r = 0;
  if (r % 2 === 1) r += 1;
  return r;
}

/** C-04: a width to LU — the half width rounded to the nearest LU, doubled. */
export function halfWidthLu(frame: Frame, w: number): number {
  const h = roundHalfUp((w * frame.luPerUnit) / 2);
  return h < 0 ? 0 : h;
}

export function widthLu(frame: Frame, w: number): number {
  return 2 * halfWidthLu(frame, w);
}

/** LU back to file units, rounded to six decimals (parse summaries). */
export function fromLu(frame: Frame, lu: number): number {
  const v = lu / frame.luPerUnit;
  return Math.round(v * 1e6) / 1e6;
}
