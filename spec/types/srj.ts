/** tscircuit SimpleRouteJson (public format). Units: mm. */
export interface SrjPoint { x: number; y: number; layer?: string }
export interface SrjObstacle {
  type: "rect" | "oval" | "polygon";
  layers: string[];
  center: { x: number; y: number };
  width: number; height: number;
  outline?: Array<{ x: number; y: number }>;
  connectedTo: string[];
}
export interface SrjConnection { name: string; pointsToConnect: SrjPoint[]; source_trace_id?: string; netName?: string }
export interface SrjDifferentialPair { p: string; n: string; gapMm?: number; skewToleranceMm?: number }
export interface SimpleRouteJson {
  layerCount: number;
  minTraceWidth: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  obstacles: SrjObstacle[];
  connections: SrjConnection[];
  differentialPairs?: SrjDifferentialPair[];
  minViaPadDiameter?: number; minViaHoleDiameter?: number;
  traces?: SrjTrace[];
}
export type SrjRouteStep =
  | { route_type: "wire"; x: number; y: number; width: number; layer: string }
  | { route_type: "via"; x: number; y: number; from_layer: string; to_layer: string };
export interface SrjTrace { type: "pcb_trace"; pcb_trace_id: string; connection_name: string; route: SrjRouteStep[] }
export interface SrjRouteResult {
  ok: boolean;
  srj: SimpleRouteJson;
  report: import("./results.ts").RouteReport;
  pairs?: Array<{ p: string; n: string; lengthP: number; lengthN: number; skewMm: number; withinTolerance: boolean }>;
  diagnostics: import("./layout.ts").Diagnostic[];
}
