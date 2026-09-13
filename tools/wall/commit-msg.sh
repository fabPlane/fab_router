#!/bin/sh
# commit-msg hook: every commit carries Wall-Role / Agent-Id / Spec-Tree trailers, and the role
# matches the paths touched. Installed by tools/wall/install-git-hooks.sh.
msg="$1"
role=$(grep -E '^Wall-Role: ' "$msg" | head -1 | sed 's/^Wall-Role: //')
agent=$(grep -E '^Agent-Id: ' "$msg" | head -1)
tree=$(grep -E '^Spec-Tree: ' "$msg" | head -1)
if [ -z "$role" ] || [ -z "$agent" ] || [ -z "$tree" ]; then
  echo "commit-msg: missing trailer(s). Required: Wall-Role: <orchestrator|spec-curator|implementer|verifier>, Agent-Id: <id>, Spec-Tree: <sha>" >&2
  exit 1
fi
case "$role" in orchestrator|spec-curator|implementer|verifier) ;; *) echo "commit-msg: bad Wall-Role '$role'" >&2; exit 1;; esac
# A merge commit by the orchestrator may bring src/ in from an implementer branch; the branch's own
# commits carry the implementer trailers (audited by check-trailers.sh).
if [ -f "$(git rev-parse --git-path MERGE_HEAD)" ] && [ "$role" = "orchestrator" ]; then exit 0; fi
files=$(git diff --cached --name-only)
impl=$(echo "$files" | grep -E '^(src/|test/|tools/acceptance/)' | head -1)
spec=$(echo "$files" | grep -E '^spec/' | head -1)
if [ -n "$impl" ] && [ "$role" != "implementer" ]; then
  echo "commit-msg: $impl may only be committed with Wall-Role: implementer" >&2; exit 1
fi
if [ -n "$spec" ] && [ "$role" != "orchestrator" ] && [ "$role" != "spec-curator" ]; then
  echo "commit-msg: spec/ may only be committed by orchestrator or spec-curator" >&2; exit 1
fi
exit 0
