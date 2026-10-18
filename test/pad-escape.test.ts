import { expect, test } from "bun:test";
import { route, checkDrc } from "../src/api.ts";
import { padEscapeBoard } from "./helpers/pad-escape.ts";

for (const reverse of [false, true]) {
  test(`routes the narrow SMD escape regardless of terminal id order (reverse=${reverse})`, () => {
    const layout = padEscapeBoard(reverse);
    const retained = structuredClone([...layout.barrels]);
    const report = route(layout, {
      maxPasses: 3, fanoutEnabled: false, optimizerEnabled: false,
      copperToEdgeClearanceUm: 500, holeClearanceUm: 250, neckWidthUm: 0,
      ignoreNetGroups: ["obstacles"],
    });
    expect(report.incompleteAfter).toBe(0);
    expect(report.violationsAdded).toBe(0);
    expect(checkDrc(layout).counts.violations).toBe(0);
    expect(layout.barrels.filter(b => b.hold === "locked")).toEqual(retained);
  });
}

for (const limits of [{ viasAllowed: false }, { maxItems: 1 }]) {
  test(`reverse retry respects routing limits ${JSON.stringify(limits)}`, () => {
    const layout = padEscapeBoard();
    const report = route(layout, {
      maxPasses: 1, fanoutEnabled: false, optimizerEnabled: false,
      copperToEdgeClearanceUm: 500, holeClearanceUm: 250, neckWidthUm: 0,
      ignoreNetGroups: ["obstacles"], ...limits,
    });
    expect(report.incompleteAfter).toBe(1);
    expect(report.added.barrels).toBe(0);
    expect(report.violationsAdded).toBe(0);
  });
}
