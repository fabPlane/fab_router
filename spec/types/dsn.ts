/**
 * DsnDocument: the file-shaped DTO returned by readDsn and accepted by writeDsn. Transcribed
 * verbatim from spec/formats/dsn.md §13 "Document model" (that section is normative; this file
 * is its TypeScript form). All numbers are file units as read; names as spelled; unknown scopes
 * are kept as SExpr in the nearest `other` list so writeDsn can reproduce them (F-ROUNDTRIP).
 */
export interface SExpr { head: string; items: Array<SExpr | string | number>; line?: number }

export type DimensionUnit = "inch" | "mil" | "cm" | "mm" | "um";
export type DocLayerRef = string;            // a Sheet name, or the reserved "pcb" / "signal"

export type DocShape =
  | { kind: "rect"; layer: DocLayerRef; x1: number; y1: number; x2: number; y2: number }
  | { kind: "circle"; layer: DocLayerRef; diameter: number; cx: number; cy: number }
  | { kind: "polygon"; layer: DocLayerRef; aperture: number; pts: number[] }        // x0 y0 x1 y1 …
  | { kind: "path"; layer: DocLayerRef; width: number; pts: number[]; apertureType?: "round" | "square" }
  | { kind: "polyline_path"; layer: DocLayerRef; width: number; pts: number[] }     // 2 vertices per line
  | { kind: "qarc"; layer: DocLayerRef; width: number; pts: number[] };             // retained, unsupported

export type DocRuleEntry =
  | { kind: "width"; value: number }
  | { kind: "clearance"; value: number; type?: string }     // the type scope's text as written, quotes kept: "smd_smd", "\"default\"-\"1A EXTERNAL 1oz\"" (rules.md F-R12 interprets it)
  | { kind: "other"; raw: SExpr };

export interface DocLayerRule { layers: string[]; rules: DocRuleEntry[] }

export interface DocParser {
  stringQuote: string;                 // default "\""
  spaceInQuotedTokens: boolean;        // default false when absent
  hostCad?: string; hostVersion?: string;
  present: boolean;                    // false when the file has no parser scope
  other: SExpr[];                      // constant, write_resolution, case_sensitive, via_rotate_first, generated_by_*
}

export interface DocLayer {
  name: string; type: string;          // "signal" | "power" | "jumper" | "mixed" | other spelling as read; "" when absent
  useNets: string[]; rules: DocRuleEntry[]; direction?: string; other: SExpr[];
}
export interface DocBoundary { shapes: DocShape[]; clearanceClass?: string; other: SExpr[] }
export interface DocKeepout {
  kind: "keepout" | "via_keepout" | "wire_keepout" | "place_keepout" | "bend_keepout" | "elongate_keepout";
  name?: string; shape: DocShape; windows: DocShape[]; clearanceClass?: string; other: SExpr[];
}
export interface DocPlane { net: string; shape: DocShape; windows: DocShape[]; clearanceClass?: string; other: SExpr[] }
export interface DocAutorouteLayerRule {
  layer: string; active?: boolean; preferredDirection?: "horizontal" | "vertical";
  preferredDirectionTraceCosts?: number; againstPreferredDirectionTraceCosts?: number; other: SExpr[];
}
export interface DocAutorouteSettings {
  fanout?: boolean; autoroute?: boolean; postroute?: boolean; vias?: boolean;
  viaCosts?: number; planeViaCosts?: number; startRipupCosts?: number; startPassNo?: number;
  layerRules: DocAutorouteLayerRule[]; other: SExpr[];
}
export interface DocStructure {
  layers: DocLayer[]; boundaries: DocBoundary[]; keepouts: DocKeepout[]; planes: DocPlane[];
  vias: string[]; spareVias: string[];
  rules: DocRuleEntry[]; layerRules: DocLayerRule[];
  control: { viaAtSmd?: boolean; other: SExpr[] };
  snapAngle?: "ninety_degree" | "fortyfive_degree" | "none";
  flipStyle?: "rotate_first" | "mirror_first";
  autorouteSettings?: DocAutorouteSettings;
  other: SExpr[];                      // grid, place_rule, unit/resolution (F-44), unknown scopes
}

export interface DocPlace {
  ref: string; x?: number; y?: number; side?: "front" | "back"; rotation?: number;
  partNumber?: string; lockType?: string[];
  pinClearance: Array<{ pin: string; clearanceClass: string }>;
  keepoutClearance: Array<{ kind: "keepout" | "via_keepout" | "place_keepout"; name: string; clearanceClass: string }>;
  other: SExpr[];
}
export interface DocComponent { image: string; places: DocPlace[]; other: SExpr[] }
export interface DocPlacement { components: DocComponent[]; flipStyle?: "rotate_first" | "mirror_first"; other: SExpr[] }

export interface DocPin { padstack: string; name: string; x: number; y: number; rotation: number; other: SExpr[] }
export interface DocImage {
  name: string; side?: "front" | "back" | "both"; pins: DocPin[]; outlines: DocShape[];
  keepouts: DocKeepout[]; other: SExpr[];
}
export interface DocPadstackShape { shape: DocShape; other: SExpr[] }   // reduced_shape, connect, window retained
export interface DocPadstack {
  name: string; shapes: DocPadstackShape[]; attach: boolean; attachUseVia?: string;
  absolute: boolean; other: SExpr[];
}
export interface DocLibrary { images: DocImage[]; padstacks: DocPadstack[]; other: SExpr[] }

export interface DocPinRef { component: string; pin: string }
export interface DocCircuit { useVia: string[]; useLayer: string[]; other: SExpr[] }
export interface DocNet {
  name: string; subnet: number;        // subnet default 1
  pins: DocPinRef[]; ordered: boolean; // ordered = written with `order`
  fromtos: DocPinRef[][];
  rules: DocRuleEntry[]; layerRules: DocLayerRule[]; circuit?: DocCircuit; other: SExpr[];
}
export interface DocClass {
  name: string; nets: string[];        // "" entries dropped (F-102)
  circuit?: DocCircuit; rules: DocRuleEntry[]; layerRules: DocLayerRule[];
  clearanceClass?: string; viaRule?: string; other: SExpr[];
}
export interface DocClassClass { classes: string[]; rules: DocRuleEntry[]; layerRules: DocLayerRule[]; other: SExpr[] }
export interface DocViaRule { name: string; vias: string[]; other: SExpr[] }
export interface DocNetwork { nets: DocNet[]; classes: DocClass[]; classClasses: DocClassClass[]; viaRules: DocViaRule[]; other: SExpr[] }

export interface DocWire {
  shape: DocShape; windows: DocShape[]; net?: string; subnet?: number; type?: string;
  clearanceClass?: string; other: SExpr[];
}
export interface DocWireVia { padstack: string; points: number[]; net?: string; subnet?: number; type?: string; other: SExpr[] }
export interface DocWiring { wires: DocWire[]; vias: DocWireVia[]; other: SExpr[] }

export interface DsnDocument {
  name: string;                        // the pcb name token, "" when absent or empty
  parser: DocParser;
  resolution: { unit: DimensionUnit; perUnit: number; present: boolean };
  unit: { unit: DimensionUnit; present: boolean };
  structure: DocStructure;
  placement: DocPlacement;
  library: DocLibrary;
  network: DocNetwork;
  wiring: DocWiring | null;            // null when the file has no wiring scope
  other: SExpr[];                      // any other top-level scope, in file order
}

/** A `.rules` file (spec/formats/rules.md F-R3): kept as its tree; applyRules interprets it. */
export interface RulesFile { name: string; body: SExpr[] }
