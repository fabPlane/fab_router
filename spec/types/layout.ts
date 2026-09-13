/**
 * The public, read-only view of a Layout. Implementations may keep richer internal structures but
 * every function in spec/api/contract.md accepts and returns objects satisfying these interfaces.
 * Coordinates are integers in layout units (LU); see Frame. Vocabulary: spec/glossary.md.
 */
export interface Pt { x: number; y: number }
export interface Box { x0: number; y0: number; x1: number; y1: number }
export type Hold = "free" | "held" | "locked";
export type Side = "front" | "back";

export interface Frame {
  /** LU per file coordinate unit (file coordinate × luPerUnit − offset = LU). */
  luPerUnit: number;
  /** Origin shift applied after scaling, in LU. */
  offset: Pt;
  /** Name of the file unit: "um" | "mil" | "mm" | "inch". */
  fileUnit: string;
  /** Number of LU per micrometre (for converting settings given in µm). */
  luPerUm: number;
}

export interface Sheet {
  id: number;
  name: string;
  role: "signal" | "plane";
  active: boolean;
  preferDir: "h" | "v" | null;
  /** For role "plane": the id of the net that owns the plane. */
  planeNet?: number;
}

export type ShapeOnSheet =
  | { kind: "disk"; c: Pt; r: number }
  | { kind: "box"; box: Box }
  | { kind: "ring"; pts: Pt[] }
  | { kind: "capsule"; a: Pt; b: Pt; r: number }
  | { kind: "path"; pts: Pt[]; halfWidth: number };

export interface PadForm {
  id: number;
  name: string;
  /** Sheet id → shapes (all relative to the pad origin, unrotated, front-side orientation). */
  perSheet: ReadonlyMap<number, readonly ShapeOnSheet[]>;
  drill?: { diameter: number; fromSheet: number; toSheet: number };
  attachAllowed: boolean;
}

export interface Part { id: number; ref: string; package: string; side: Side; at: Pt; rotationDeg: number; /** `lock_type position` in the file. */ locked?: boolean }

export interface Pad {
  id: number; part: number; pinName: string; net: number | null; form: number;
  at: Pt; rotationDeg: number; side: Side; sheets: readonly number[]; kind: number; hold: "locked";
}
/** origin: who put the item there — "file" (design wiring), "session" (applySes), "router" (route),
 *  "prior" (pre-existing SRJ net copper: obstacle to other nets, connective to its own net,
 *  DRC-silent against other "prior" copper — spec/rules/drc.md DR-13, clearance.md C-16, connectivity.md K-16). */
export type Origin = "file" | "session" | "router" | "prior";
export interface Barrel { id: number; net: number | null; at: Pt; form: number; fromSheet: number; toSheet: number; kind: number; hold: Hold; origin?: Origin }
export interface Track { id: number; net: number | null; sheet: number; pts: readonly Pt[]; width: number; kind: number; hold: Hold; origin?: Origin }
export interface Pour { id: number; net: number | null; sheet: number; outline: readonly Pt[]; holes: readonly (readonly Pt[])[]; kind: number; hold: Hold; origin?: Origin }
/** Fence.kind: the Kind of the keepout (`rules/keepouts.md` KO-05, `clearance.md` C-11); 0 = no Kind ("must merely not overlap"). */
export interface Fence { id: number; sheet: number | "all-signal"; scope: "track" | "barrel" | "place"; shape: ShapeOnSheet; kind: number; net?: number; /** Owning Part for image keepouts (DR-12). */ part?: number }
export interface Rim { outline: readonly Pt[]; cutouts: readonly (readonly Pt[])[]; kind: number }

export interface Net { id: number; name: string; group: number; pads: readonly number[] }
export interface NetGroup {
  id: number; name: string; nets: readonly number[];
  /** Always present: a NetGroup without its own width rule inherits the Layout default. */
  trackWidth: number;
  /** The group's Track Kind (same as categoryKinds.track). */
  kind: number;
  /** Per-category Kinds (`rules/clearance.md` C-11). */
  categoryKinds: { track: number; barrel: number; pin: number; smd: number; area: number };
  viaRule?: number; usableSheets?: readonly number[];
}
export interface SpacingTable {
  kinds: readonly string[];
  /** Required spacing in LU. `pairType` defaults to "default". Symmetric in (a, b). */
  get(kindA: number, kindB: number, sheet: number, pairType?: string): number;
  /** Largest value in the table for a given kind (used to size queries). */
  max(kind: number): number;
}
/** Ordered Barrel candidates. `entries[i].form` is the PadForm; `kind` the via definition's Kind (`rules/vias.md` V-02); `attach` per V-08. `forms` lists the same PadForms in order. */
export interface ViaRule { id: number; name: string; forms: readonly number[]; entries: readonly { form: number; kind: number; attach: boolean }[] }

/**
 * Item ids (Pad, Barrel, Track, Pour, Fence) are unique across all five arrays — one id space.
 * The Rim has no id.
 */
export interface Layout {
  name: string;
  frame: Frame;
  angleMode: "90" | "45" | "any";
  stack: readonly Sheet[];
  padForms: readonly PadForm[];
  parts: readonly Part[];
  pads: readonly Pad[];
  barrels: readonly Barrel[];
  tracks: readonly Track[];
  pours: readonly Pour[];
  fences: readonly Fence[];
  rim: Rim | null;
  nets: readonly Net[];
  netGroups: readonly NetGroup[];
  spacing: SpacingTable;
  viaRules: readonly ViaRule[];
  /** SMD pad-edge-to-first-turn distance (`smd_to_turn_gap`), 0 when the file gives none. */
  pinEdgeToTurnLu: number;
  /** Facts of the design file a session writer needs (F-S20/21/30/31). */
  file?: { unit: string; perUnit: number; quote: string; hostCad?: string; hostVersion?: string };
  settingsFromFile?: Partial<import("./settings.ts").RouteSettings>;
  warnings: readonly Diagnostic[];
}

export interface Diagnostic { level: "info" | "warning"; code: string; message: string; where?: { line?: number; column?: number; item?: number } }
export interface ParseError { line: number; column: number; message: string }
