/** Three repeated real write/apply round trips, with complete copper records retained. */
import { SESSION_QUOTE_DSN } from "../../../test/helpers/session-quotes.ts";
const root = process.argv[2];
if (!root) throw new Error("usage: bun run audit.ts ABSOLUTE_SOURCE_ROOT");
const { readDsn, writeSes, applySes } = await import(`${root}/src/api.ts`);
const runs = [];
const expectMissing = process.argv.includes("--expect-missing");
for (let repeat = 1; repeat <= 3; repeat++) {
  const input = readDsn(SESSION_QUOTE_DSN);
  if (!input.ok) throw new Error("fixture failed");
  const L = input.layout;
  const before = structuredClone(L.tracks);
  const session = writeSes(L);
  const result = applySes(L, session);
  if (!result.ok || before.length !== 1 || L.tracks.length !== (expectMissing ? 0 : 1)) throw new Error("unexpected import count");
  if (expectMissing) {
    if (!result.diagnostics.some((d: { code: string }) => d.code === "net-unknown")) throw new Error("missing expected diagnostic");
  } else {
    if (result.diagnostics.length || JSON.stringify(before.map(({ id, origin, ...rest }: Record<string, unknown>) => rest)) !== JSON.stringify(L.tracks.map(({ id, origin, ...rest }: Record<string, unknown>) => rest))) throw new Error("copper changed");
  }
  runs.push({ repeat, before, session, result, after: L.tracks });
}
console.log(JSON.stringify(runs, null, 2));
