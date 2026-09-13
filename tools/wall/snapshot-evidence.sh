#!/bin/sh
# Snapshot agent transcripts for a milestone into the private evidence directory and record a
# sha256 manifest in the repo. Usage: sh tools/wall/snapshot-evidence.sh M0
set -e
m="${1:?milestone name}"
root=$(git rev-parse --show-toplevel)
cfg="${FAB_ROUTER_WALL_CONFIG:?FAB_ROUTER_WALL_CONFIG must point at the private wall config}"
private=$(dirname "$(dirname "$cfg")")
dest="$private/evidence/transcripts/$m"
mkdir -p "$dest"
# Claude Code keeps per-project transcripts under ~/.claude/projects/<slug>/ ; the slug is the
# project path with '/' replaced by '-'.
slug=$(printf '%s' "$root" | sed 's#/#-#g')
src="$HOME/.claude/projects/$slug"
n=0
if [ -d "$src" ]; then
  for f in $(find "$src" -name '*.jsonl' -type f); do
    cp "$f" "$dest/"; n=$((n+1))
  done
fi
manifest="$root/evidence/transcripts.manifest.json"
tmp=$(mktemp)
{
  echo "{"
  echo "  \"milestone\": \"$m\", \"taken\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\", \"head\": \"$(git rev-parse HEAD 2>/dev/null || echo none)\","
  echo "  \"files\": ["
  first=1
  for f in "$dest"/*.jsonl; do
    [ -f "$f" ] || continue
    [ $first -eq 1 ] || echo ","; first=0
    printf '    {"name": "%s", "sha256": "%s", "bytes": %s}' "$(basename "$f")" "$(shasum -a 256 "$f" | cut -d' ' -f1)" "$(stat -f%z "$f")"
  done
  echo; echo "  ]"; echo "}"
} > "$tmp"
# keep a history: previous manifests are kept under evidence/manifests/
mkdir -p "$root/evidence/manifests"
cp "$tmp" "$root/evidence/manifests/$m.json"
mv "$tmp" "$manifest"
echo "snapshot $m: $n transcript(s) -> $dest; manifest $manifest"
