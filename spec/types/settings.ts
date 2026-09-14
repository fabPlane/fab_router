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
};
