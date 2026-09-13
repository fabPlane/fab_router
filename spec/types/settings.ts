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
};
