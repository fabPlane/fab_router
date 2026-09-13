# Task I4b — drop the traceLengthMm /10 workaround in test/applied-ses.test.ts

Role: implementer. Write set: `test/`.

S6 corrected every `spec/acceptance/reference/*.applied-ses.json` so `traceLengthMm` is now the
true millimetre value (previously it was one tenth; ruling Q-I2-58 in `spec/api/contract.md`).
`test/applied-ses.test.ts` still asserts `after.tracks.totalLengthMm / 10 ≈ want.traceLengthMm`
(the old workaround), so all 34 applied-ses references now fail.

Fix: assert `after.tracks.totalLengthMm ≈ want.traceLengthMm` directly (both are true mm now), and
remove the stale `/10` comment. Keep the `totalLengthMm === totalLengthLu / 10000` check.

Done when `bun test test/applied-ses.test.ts` is green (38/38) and `bun run test` has no
applied-ses failures. Commit with implementer trailers.
