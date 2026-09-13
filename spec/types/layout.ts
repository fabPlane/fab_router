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

export interface Part { id: number; ref: string; package: string; side: Side; at: Pt; rotationDeg: number }

export interface Pad {
  id: number; part: number; pinName: string; net: number | null; form: number;
  at: Pt; rotationDeg: number; side: Side; sheets: readonly number[]; kind: number; hold: "locked";
}
export interface Barrel { id: number; net: number | null; at: Pt; form: number; fromSheet: number; toSheet: number; kind: number; hold: Hold }
export interface Track { id: number; net: number | null; sheet: number; pts: readonly Pt[]; width: number; kind: number; hold: Hold }
export interface Pour { id: number; net: number | null; sheet: number; outline: readonly Pt[]; holes: readonly (readonly Pt[])[]; kind: number; hold: Hold }
export interface Fence { id: number; sheet: number | "all-signal"; scope: "track" | "barrel" | "place"; shape: ShapeOnSheet; net?: number }
export interface Rim { outline: readonly Pt[]; cutouts: readonly (readonly Pt[])[]; kind: number }

export interface Net { id: number; name: string; group: number; pads: readonly number[] }
export interface NetGroup {
  id: number; name: string; nets: readonly number[];
  trackWidth?: number; kind: number; viaRule?: number; usableSheets?: readonly number[];
}
export interface SpacingTable {
  kinds: readonly string[];
  /** Required spacing in LU. `pairType` defaults to "default". Symmetric in (a, b). */
  get(kindA: number, kindB: number, sheet: number, pairType?: string): number;
  /** Largest value in the table for a given kind (used to size queries). */
  max(kind: number): number;
}
export interface ViaRule { id: number; name: string; forms: readonly number[] }

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
  settingsFromFile?: Partial<import("./settings.ts").RouteSettings>;
  warnings: readonly Diagnostic[];
}

export interface Diagnostic { level: "info" | "warning"; code: string; message: string; where?: { line?: number; column?: number; item?: number } }
export interface ParseError { line: number; column: number; message: string }
