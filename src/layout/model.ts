/**
 * The concrete Layout built by the DSN reader (docs/DESIGN.md §2; public contract in
 * spec/types/layout.ts). `LayoutX` is a structural subtype of the public `Layout` that carries
 * what the rules documents (spec/rules/*.md) and the parse summary
 * (spec/acceptance/parse/README.md) need beyond the public fields: per-category item Kinds and
 * per-Sheet widths of NetGroups (clearance.md C-11, nets.md N-06), subnet numbers and plane-net
 * flags of Nets (nets.md N-03, layers.md L-06), Fence owners and Kinds (keepouts.md KO-02, KO-05),
 * via definitions (vias.md V-02), padstack normalised names (padstack-names.md P-1) and the
 * mutable SpacingTable so that a rules file can extend it (rules.md).
 *
 * Pad geometry convention (dsn.md §11): a Pad's copper is its PadForm's shapes, mirrored across
 * the y axis when `side` is `back`, then rotated by `rotationDeg` counter-clockwise, then
 * translated to `at`. `rotationDeg` already folds the pin's own rotation and the flip style in.
 *
 * Public surface: LayoutX, NetX, NetGroupX, FenceX, RimX, PadFormX, ViaDef, ItemCategory, CATEGORIES,
 * BUILTIN_WIDTH_LU, BUILTIN_TURN_GAP_LU, newLayoutX.
 */
import type { Barrel, Fence, Frame, Layout, Net, NetGroup, Pad, PadForm, Part, Pour, Pt, Rim, Sheet, Track, ViaRule, Diagnostic } from "../../spec/types/layout.ts";
import type { RouteSettings } from "../../spec/types/settings.ts";
import { SpacingTableX } from "./spacing.ts";

export type ItemCategory = "track" | "barrel" | "pin" | "smd" | "area";
export const CATEGORIES: readonly ItemCategory[] = ["track", "barrel", "pin", "smd", "area"];

export interface NetX extends Net {
  subnet: number;
  plane: boolean;
  /** Pads of this net (mutable during build). */
  pads: number[];
}

export interface NetGroupX extends NetGroup {
  nets: number[];
  /** Track width per Sheet (LU); `trackWidth` mirrors index 0. */
  widthBySheet: number[];
  /** Kind per item category (clearance.md C-11). `kind` mirrors `categoryKinds.track`. */
  categoryKinds: Record<ItemCategory, number>;
  /** Sheets this group may route on (usable = signal Sheets ∩ use_layer list). */
  usable: number[];
  /** True when a `use_layer` list restricted the usable Sheets. */
  useLayerGiven: boolean;
  minLength?: number;
  maxLength?: number;
  shoveFixed: boolean;
  pullTight: boolean;
  ignored: boolean;
}

/** The Rim with every outer ring: `outline` is the first outer ring, `outers` lists them all. */
export interface RimX extends Rim {
  outers: Pt[][];
  cutouts: Pt[][];
}

export interface FenceX extends Fence {
  owner: "board" | "part";
  kind: number;
  hold: "locked";
}

export interface PadFormX extends PadForm {
  /** P-1 normalised spelling (fractional digits removed, case kept). */
  normName: string;
  /** Lower-cased normalised form used for lookup. */
  normKey: string;
  /** Sheets that carry copper, ascending. */
  sheets: number[];
  attachOff: boolean;
  /** `absolute on`: the layer order is not flipped on back-side Parts (F-114). */
  absolute: boolean;
}

/** A via definition (vias.md V-02): a named PadForm with a Kind and an attach flag. */
export interface ViaDef { name: string; form: number; kind: number; attach: boolean }

export interface LayoutX extends Layout {
  stack: Sheet[];
  padForms: PadFormX[];
  parts: Part[];
  pads: Pad[];
  barrels: Barrel[];
  tracks: Track[];
  pours: Pour[];
  fences: FenceX[];
  rim: RimX | null;
  nets: NetX[];
  netGroups: NetGroupX[];
  spacing: SpacingTableX;
  viaRules: ViaRule[];
  viaDefs: ViaDef[];
  /** PadForms usable for Barrels, in first-mention order (vias.md V-01). */
  viaForms: number[];
  /** True once a structure-level width rule has been read (clearance.md C-12 uses it). */
  defaultWidthSet: boolean;
  /** The structure-level width per Sheet (LU): the "default half-width" of C-12 is half of this. */
  structureWidth: number[];
  /** True once a `smd_to_turn_gap` rule has been read. */
  turnGapSet: boolean;
  /** Name of the boundary's clearance class, when the file gives one. */
  rimClass?: string;
  /** Diagnostics collected while building and applying rules. */
  warnings: Diagnostic[];
  settingsFromFile?: Partial<RouteSettings>;
  /** The board file name passed to readDsn (parse summaries), when given. */
  boardName?: string;
  /** Ids of items whose Kind was named explicitly by a `clearance_class` (never recomputed). */
  explicitKinds: Set<number>;
  /** Next item id. */
  nextId: number;
}

/** Built-in default Track width (LU) when the file gives no width rule (nets.md N-06). */
export const BUILTIN_WIDTH_LU = 3000;
/** Built-in upper bound of the turn gap when the file gives neither (clearance.md C-12). */
export const BUILTIN_TURN_GAP_LU = 100000;

export function newLayoutX(name: string, frame: Frame, sheetCount: number): LayoutX {
  const spacing = new SpacingTableX(sheetCount);
  const L: LayoutX = {
    name,
    frame,
    angleMode: "45",
    stack: [],
    padForms: [],
    parts: [],
    pads: [],
    barrels: [],
    tracks: [],
    pours: [],
    fences: [],
    rim: null,
    nets: [],
    netGroups: [],
    spacing,
    viaRules: [],
    viaDefs: [],
    viaForms: [],
    pinEdgeToTurnLu: 0,
    warnings: [],
    defaultWidthSet: false,
    structureWidth: new Array(Math.max(1, sheetCount)).fill(BUILTIN_WIDTH_LU),
    turnGapSet: false,
    explicitKinds: new Set(),
    nextId: 1,
  };
  return L;
}
