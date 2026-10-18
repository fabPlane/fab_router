/** Three repeated real write/apply round trips, with complete copper records retained. */
import { SESSION_QUOTE_DSN } from "../../../test/helpers/session-quotes.ts";
const root = process.argv[2];
if (!root) throw new Error("usage: bun run audit.ts ABSOLUTE_SOURCE_ROOT");
const { readDsn, writeSes, applySes } = await import(`${root}/src/api.ts`);
const runs = [];
for (let repeat = 1; repeat <= 3; repeat++) {
  const input = readDsn(SESSION_QUOTE_DSN);
  if (!input.ok) throw new Error("fixture failed");
  const L = input.layout;
  const before = structuredClone(L.tracks);
  const session = writeSes(L);
  const result = applySes(L, session);
  runs.push({ repeat, before, session, result, after: L.tracks });
}
console.log(JSON.stringify(runs, null, 2));
