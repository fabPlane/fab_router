/** Router settings. Semantics: spec/api/settings.md. Distances in micrometres, times in ms. */
export type AngleMode = "90" | "45" | "any";

export interface SheetOverride {
  active?: boolean;
  preferDir?: "h" | "v";
  /** Cost per LU of a leg running along the Sheet's preferred direction. Default 1. */
  alongCost?: number;
  /** Cost per LU of a leg running against it. Default `preferredDirectionCost`. */
  againstCost?: number;
}

export interface RouteSettings {
  maxPasses: number;
  maxStagnantPasses: number;
  maxItems?: number;
  timeBudgetMs?: number;
  connectionBudgetMs?: number;
  viaCost: number;
  planeViaCost: number;
  bendCost: number;
  preferredDirectionCost: number;
  startRipupCost: number;
  ripupEnabled: boolean;
  fanoutEnabled: boolean;
  fanoutMaxPasses?: number;
  fanoutMaxItems?: number;
  routerEnabled: boolean;
  optimizerEnabled: boolean;
  optimizerPasses?: number;
  optimizerMaxItems?: number;
  strictDrc: boolean;
  neckWidthUm?: number;
  copperToEdgeClearanceUm?: number;
  holeClearanceUm?: number;
  angleMode?: AngleMode;
  layers: Record<string, SheetOverride>;
  viasAllowed: boolean;
  ignoreNetGroups: string[];
  seed: number;
  // --- M9 detailed router (docs/DESIGN.md §9); all default to legacy behaviour on the fast tier ---
  /** Push-and-shove movable free Tracks aside instead of only ripping them. Default true. */
  shoveEnabled: boolean;
  /** Max perpendicular displacement of one shoved segment, µm. */
  shoveWindowUm?: number;
  /** Cascade recursion bound for transitive shoves. */
  shoveMaxDepth?: number;
  /** Max segments moved in one shove trial (determinism / cost bound). */
  shoveMaxMoved?: number;
  /** Present-sharing weight in the PathFinder cost (McMurchie & Ebeling). 0 = history-only. */
  presentCongestionCost?: number;
  /** Route connections in descending (airline × local congestion) order. Default true. */
  orderByDifficulty: boolean;
  /** Gridless detailed router for locked channels (docs/DESIGN.md §9b). */
  detailedRouter?: "off" | "lineprobe" | "tiles";
  /** Region tile budget for the detailed router. */
  detailedMaxTiles?: number;
  /** Per-connection wall-clock cap for the detailed router, ms. */
  detailedBudgetMs?: number;
  // --- M10 global router (docs/DESIGN.md §10); default "off" reproduces the M9 loop exactly ---
  /** Two-phase global+detailed routing: coarse negotiated-congestion plan drives the detailed router. */
  globalPlan?: "off" | "plan";
  /** Mesh bin size override, µm (else derived from track pitch). */
  globalBinUm?: number;
  /** Coarse PathFinder iteration cap. */
  globalMaxIterations?: number;
  /** PathFinder history and present weights, and the per-iteration history ramp, on the Mesh. */
  globalHistoryWeight?: number; globalPresentWeight?: number; globalHistoryRamp?: number;
  /** Directional / per-Sheet layer assignment in the global phase. */
  globalLayerBias?: boolean;
  /** SPIKE (I17): full detailed negotiated-congestion loop — rip and reroute ALL nets each pass
   *  against escalating present+history cost. Experimental; default false. R-1 unchanged (exact
   *  predicate stays the sole gate). */
  detailedNegotiation?: boolean;
  /** Apply layout.settingsFromFile underneath the caller's settings. Default false. */
  useFileSettings?: boolean;
}

export const DEFAULT_ROUTE_SETTINGS: RouteSettings = {
  maxPasses: 100,
  maxStagnantPasses: 3,
  viaCost: 50,
  planeViaCost: 5,
  bendCost: 0,
  preferredDirectionCost: 1.5,
  startRipupCost: 100,
  ripupEnabled: true,
  fanoutEnabled: false,
  routerEnabled: true,
  optimizerEnabled: true,
  strictDrc: false,
  layers: {},
  viasAllowed: true,
  ignoreNetGroups: [],
  seed: 1,
  shoveEnabled: true,
  orderByDifficulty: true,
  detailedRouter: "off",
  globalPlan: "off",
};
