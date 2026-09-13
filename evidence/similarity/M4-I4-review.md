# Similarity review — M4-I4 (orchestrator)

Gate `bun run similarity -- --milestone M4-I4`. The only router-specific finding is
`src/route/legalise.ts` ~ an unrelated pairs module: a 48-token run that is a generic accumulator
prologue (`const out = []; if (empty) return out; let start = 0; for (…)`) — boilerplate, not
copying. Everything else is the previously-reviewed generic runs/constants. A*, Theta*,
PathFinder rip-up and the uniform-grid Quilt are designed from the cited literature
(`spec/glossary.md`); no reference structure (expansion rooms/doors, MazeSearch*, ShapeSearchTree)
appears. **No copying indicated.**
