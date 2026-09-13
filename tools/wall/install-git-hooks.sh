#!/bin/sh
# Installs the commit-msg trailer check into this checkout (and any worktree sharing its .git).
set -e
root=$(git rev-parse --show-toplevel)
hooks=$(git rev-parse --git-path hooks)
mkdir -p "$hooks"
cp "$root/tools/wall/commit-msg.sh" "$hooks/commit-msg"
chmod +x "$hooks/commit-msg"
echo "installed $hooks/commit-msg"
