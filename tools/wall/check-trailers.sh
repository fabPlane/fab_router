#!/bin/sh
# Audit trailers over a commit range: tools/wall/check-trailers.sh <from>..<to>
range="${1:-HEAD~1..HEAD}"
bad=0
for c in $(git rev-list "$range"); do
  body=$(git log -1 --format=%B "$c")
  role=$(printf '%s' "$body" | grep -E '^Wall-Role: ' | sed 's/^Wall-Role: //')
  if [ -z "$role" ] || ! printf '%s' "$body" | grep -qE '^Agent-Id: ' || ! printf '%s' "$body" | grep -qE '^Spec-Tree: '; then
    echo "MISSING trailers: $c $(git log -1 --format=%s "$c")"; bad=1; continue
  fi
  files=$(git diff-tree --no-commit-id --name-only -r "$c")
  if echo "$files" | grep -qE '^(src/|test/|tools/acceptance/)' && [ "$role" != "implementer" ]; then
    # merge commits by the orchestrator are allowed to bring src/ in
    if [ "$(git rev-list --parents -n1 "$c" | wc -w)" -lt 3 ]; then echo "ROLE MISMATCH ($role touched src/test): $c"; bad=1; fi
  fi
  if echo "$files" | grep -qE '^spec/' && [ "$role" != "orchestrator" ] && [ "$role" != "spec-curator" ]; then
    echo "ROLE MISMATCH ($role touched spec/): $c"; bad=1
  fi
done
[ $bad -eq 0 ] && echo "check-trailers: ok ($range)"
exit $bad
